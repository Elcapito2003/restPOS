import bcrypt from 'bcrypt';
import { pool } from '../config/database';

async function seed() {
  console.log('Seeding database...');

  // Admin user with PIN 1234
  const pin = await bcrypt.hash('1234', 10);
  await pool.query(`
    INSERT INTO users (username, display_name, pin, role, avatar_color)
    VALUES ('admin', 'Administrador', $1, 'admin', '#EF4444')
    ON CONFLICT (username) DO NOTHING
  `, [pin]);

  // Sample waiter
  const waiterPin = await bcrypt.hash('1111', 10);
  await pool.query(`
    INSERT INTO users (username, display_name, pin, role, avatar_color)
    VALUES ('mesero1', 'Carlos', $1, 'waiter', '#3B82F6')
    ON CONFLICT (username) DO NOTHING
  `, [waiterPin]);

  // Sample kitchen user
  const kitchenPin = await bcrypt.hash('2222', 10);
  await pool.query(`
    INSERT INTO users (username, display_name, pin, role, avatar_color)
    VALUES ('cocina', 'Cocina', $1, 'kitchen', '#10B981')
    ON CONFLICT (username) DO NOTHING
  `, [kitchenPin]);

  // Sample cashier
  const cashierPin = await bcrypt.hash('3333', 10);
  await pool.query(`
    INSERT INTO users (username, display_name, pin, role, avatar_color)
    VALUES ('cajero1', 'María', $1, 'cashier', '#F59E0B')
    ON CONFLICT (username) DO NOTHING
  `, [cashierPin]);

  console.log('Seeding completed.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
