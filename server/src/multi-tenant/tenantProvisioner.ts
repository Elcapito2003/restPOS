import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { env } from '../config/env';
import { masterQuery } from './masterDb';

// Parse credentials from DATABASE_URL
const match = env.databaseUrl.match(/postgresql:\/\/(\w+):([^@]+)@([^:]+):(\d+)\//);
const [, dbUser, dbPass, dbHost, dbPort] = match || ['', 'restpos', 'restpos2026secure', 'localhost', '5432'];

/**
 * Provision a new tenant: create database, run migrations, seed data, generate license.
 */
export async function provisionTenant(tenantId: string): Promise<{ license_code: string; admin_pin: string }> {
  // 1. Get tenant info from master DB
  const tenantResult = await masterQuery('SELECT * FROM tenants WHERE id = $1', [tenantId]);
  if (tenantResult.rows.length === 0) throw new Error('Tenant no encontrado');
  const tenant = tenantResult.rows[0];

  if (tenant.status !== 'pending' && tenant.status !== 'active' && tenant.status !== 'trial') {
    throw new Error(`Tenant tiene status "${tenant.status}", no se puede provisionar`);
  }

  const dbName = tenant.db_name;
  console.log(`[provision] Creating database: ${dbName}`);

  // 2. Create the database
  const adminPool = new Pool({
    user: dbUser, password: dbPass, host: dbHost, port: parseInt(dbPort), database: 'postgres',
  });

  try {
    const exists = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rows.length === 0) {
      // Can't use parameterized query for CREATE DATABASE
      await adminPool.query(`CREATE DATABASE "${dbName}" OWNER ${dbUser}`);
      console.log(`[provision] Database created: ${dbName}`);
    } else {
      console.log(`[provision] Database already exists: ${dbName}`);
    }
  } finally {
    await adminPool.end();
  }

  // 3. Run all tenant migrations
  const tenantPool = new Pool({
    user: dbUser, password: dbPass, host: dbHost, port: parseInt(dbPort), database: dbName,
  });

  try {
    // In compiled JS (__dirname = dist/multi-tenant), migrations are in src/db/migrations
    const migrationsDir = path.join(__dirname, '../../src/db/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    console.log(`[provision] Running ${files.length} migrations on ${dbName}...`);
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      try {
        await tenantPool.query(sql);
        console.log(`  ✓ ${file}`);
      } catch (err: any) {
        if (err.code === '42P07' || err.code === '42710') {
          console.log(`  ✓ ${file} (already exists)`);
        } else {
          console.error(`  ✗ ${file}: ${err.message}`);
          throw err;
        }
      }
    }

    // 4. Seed default admin user
    const defaultPin = Math.floor(1000 + Math.random() * 9000).toString(); // Random 4-digit PIN
    const pinHash = await bcrypt.hash(defaultPin, 10);

    const userExists = await tenantPool.query("SELECT id FROM users WHERE username = 'admin'");
    if (userExists.rows.length === 0) {
      await tenantPool.query(
        `INSERT INTO users (username, display_name, pin, role, is_active) VALUES ($1, $2, $3, $4, true)`,
        ['admin', 'Administrador', pinHash, 'admin']
      );
      console.log(`[provision] Admin user created with PIN: ${defaultPin}`);
    } else {
      console.log('[provision] Admin user already exists');
    }

    // 5. Seed default settings
    await tenantPool.query(
      `INSERT INTO settings (key, value) VALUES ('restaurant_name', $1) ON CONFLICT (key) DO NOTHING`,
      [tenant.name]
    );

    console.log(`[provision] Database ${dbName} provisioned successfully`);

    // 6. Generate license
    const licenseCode = crypto.randomBytes(12).toString('hex').toUpperCase();
    const licExists = await masterQuery('SELECT id FROM licenses WHERE tenant_id = $1 AND status = $2', [tenantId, 'active']);
    if (licExists.rows.length === 0) {
      await masterQuery(
        `INSERT INTO licenses (tenant_id, license_code, plan, status, monthly_price, expires_at)
         VALUES ($1, $2, 'standard', 'active', 0, NOW() + INTERVAL '1 month')`,
        [tenantId, licenseCode]
      );
      console.log(`[provision] License created: ${licenseCode}`);
    }

    // 7. Enable core modules
    const coreModules = await masterQuery('SELECT id FROM modules WHERE is_core = true');
    for (const mod of coreModules.rows) {
      await masterQuery(
        'INSERT INTO tenant_modules (tenant_id, module_id, enabled) VALUES ($1, $2, true) ON CONFLICT DO NOTHING',
        [tenantId, mod.id]
      );
    }

    // 8. Update tenant status to active
    await masterQuery("UPDATE tenants SET status = 'active', updated_at = NOW() WHERE id = $1", [tenantId]);

    return { license_code: licenseCode, admin_pin: defaultPin };
  } finally {
    await tenantPool.end();
  }
}

/**
 * Delete a tenant's database (use with caution!).
 */
export async function deprovisionTenant(tenantId: string): Promise<void> {
  const tenantResult = await masterQuery('SELECT db_name FROM tenants WHERE id = $1', [tenantId]);
  if (tenantResult.rows.length === 0) throw new Error('Tenant no encontrado');

  const dbName = tenantResult.rows[0].db_name;

  // Don't delete the original restpos_cloud database!
  if (dbName === 'restpos_cloud') throw new Error('No se puede eliminar la base de datos principal');

  const adminPool = new Pool({
    user: dbUser, password: dbPass, host: dbHost, port: parseInt(dbPort), database: 'postgres',
  });

  try {
    // Terminate connections
    await adminPool.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [dbName]);
    await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    console.log(`[provision] Database dropped: ${dbName}`);
  } finally {
    await adminPool.end();
  }

  await masterQuery("UPDATE tenants SET status = 'archived', updated_at = NOW() WHERE id = $1", [tenantId]);
}
