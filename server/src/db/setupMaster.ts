/**
 * One-time setup: Create master database, run migrations, seed first tenant.
 * Usage: npx tsx src/db/setupMaster.ts
 */
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const PG_URL = process.env.DATABASE_URL || 'postgresql://restpos:restpos2026secure@localhost:5432/restpos_cloud';
const MASTER_DB = 'restpos_master';

// Parse the existing connection to get credentials
const match = PG_URL.match(/postgresql:\/\/(\w+):([^@]+)@([^:]+):(\d+)\//);
const [, dbUser, dbPass, dbHost, dbPort] = match || ['', 'restpos', 'restpos2026secure', 'localhost', '5432'];

async function setup() {
  // 1. Connect to default DB to create master database
  const adminPool = new Pool({
    user: dbUser, password: dbPass, host: dbHost, port: parseInt(dbPort), database: 'postgres',
  });

  try {
    const exists = await adminPool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [MASTER_DB]);
    if (exists.rows.length === 0) {
      await adminPool.query(`CREATE DATABASE ${MASTER_DB} OWNER ${dbUser}`);
      console.log(`✓ Created database: ${MASTER_DB}`);
    } else {
      console.log(`✓ Database ${MASTER_DB} already exists`);
    }
  } finally {
    await adminPool.end();
  }

  // 2. Run master migrations
  console.log('\nRunning migrations...');
  const { execSync } = require('child_process');
  execSync(`npx tsx ${path.join(__dirname, 'migrateMaster.ts')}`, { stdio: 'inherit', cwd: path.resolve(__dirname, '../../..') });

  // 3. Connect to master DB and seed data
  const masterPool = new Pool({
    user: dbUser, password: dbPass, host: dbHost, port: parseInt(dbPort), database: MASTER_DB,
  });

  try {
    // Create super-admin account
    const adminEmail = 'admin@restpos.com';
    const adminExists = await masterPool.query('SELECT id FROM super_admins WHERE email = $1', [adminEmail]);
    if (adminExists.rows.length === 0) {
      const hash = await bcrypt.hash('admin2026', 12);
      await masterPool.query(
        `INSERT INTO super_admins (email, password_hash, display_name) VALUES ($1, $2, $3)`,
        [adminEmail, hash, 'Super Admin']
      );
      console.log(`\n✓ Super-admin created: ${adminEmail} / admin2026`);
      console.log('  ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!');
    } else {
      console.log('\n✓ Super-admin already exists');
    }

    // Register DUO Cafe as first tenant
    const duoExists = await masterPool.query(`SELECT id FROM tenants WHERE slug = 'duo-cafe'`);
    let tenantId: string;
    if (duoExists.rows.length === 0) {
      const result = await masterPool.query(
        `INSERT INTO tenants (name, slug, db_name, latitude, longitude, address, city, state, owner_name, owner_phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        ['DUO Café', 'duo-cafe', 'restpos_cloud', 20.6736, -103.3440, 'Guadalajara, Jalisco', 'Guadalajara', 'Jalisco', 'Cap', '+523313283362']
      );
      tenantId = result.rows[0].id;
      console.log(`✓ Tenant created: DUO Café (${tenantId})`);
    } else {
      tenantId = duoExists.rows[0].id;
      console.log(`✓ Tenant DUO Café already exists (${tenantId})`);
    }

    // Generate license for DUO Cafe
    const licExists = await masterPool.query('SELECT id FROM licenses WHERE tenant_id = $1', [tenantId]);
    if (licExists.rows.length === 0) {
      const licenseCode = crypto.randomBytes(12).toString('hex').toUpperCase();
      await masterPool.query(
        `INSERT INTO licenses (tenant_id, license_code, plan, status, expires_at, monthly_price)
         VALUES ($1, $2, 'premium', 'active', NOW() + INTERVAL '1 year', 0)`,
        [tenantId, licenseCode]
      );
      console.log(`✓ License created: ${licenseCode}`);
    } else {
      console.log('✓ License already exists');
    }

    // Enable all modules for DUO Cafe
    const modules = await masterPool.query('SELECT id FROM modules');
    for (const mod of modules.rows) {
      await masterPool.query(
        `INSERT INTO tenant_modules (tenant_id, module_id, enabled) VALUES ($1, $2, true) ON CONFLICT DO NOTHING`,
        [tenantId, mod.id]
      );
    }
    console.log(`✓ All modules enabled for DUO Café`);

    console.log('\n🎉 Master database setup complete!');
  } finally {
    await masterPool.end();
  }
}

setup().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
