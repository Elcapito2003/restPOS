import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.databaseUrl,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function query(text: string, params?: any[]) {
  const result = await pool.query(text, params);
  return result;
}

export async function getClient() {
  const client = await pool.connect();
  return client;
}
