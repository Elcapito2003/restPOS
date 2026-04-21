import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const MASTER_URL = process.env.MASTER_DATABASE_URL || 'postgresql://restpos:restpos2026secure@localhost:5432/restpos_master';

async function migrateMaster() {
  const pool = new Pool({ connectionString: MASTER_URL });

  const migrationsDir = path.join(__dirname, 'master-migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  console.log(`Running ${files.length} master migrations...`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    try {
      await pool.query(sql);
      console.log(`  ✓ ${file}`);
    } catch (err: any) {
      if (err.code === '42P07' || err.code === '42710' || err.code === '23505') {
        console.log(`  ✓ ${file} (already exists)`);
      } else {
        console.error(`  ✗ ${file}: ${err.message}`);
        throw err;
      }
    }
  }

  console.log('Master migrations completed.');
  await pool.end();
}

migrateMaster().catch((err) => {
  console.error('Master migration failed:', err);
  process.exit(1);
});
