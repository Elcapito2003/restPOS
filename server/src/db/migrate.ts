import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  console.log(`Running ${files.length} migrations...`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    try {
      await pool.query(sql);
      console.log(`  ✓ ${file}`);
    } catch (err: any) {
      // Ignore "already exists" errors (42P07) so migrations are re-runnable
      if (err.code === '42P07' || err.code === '42710') {
        console.log(`  ✓ ${file} (already exists, skipped)`);
      } else {
        console.error(`  ✗ ${file}: ${err.message}`);
        throw err;
      }
    }
  }

  console.log('All migrations completed.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
