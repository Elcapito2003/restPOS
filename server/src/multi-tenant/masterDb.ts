import { Pool, QueryResult } from 'pg';
import { env } from '../config/env';

let masterPool: Pool | null = null;

export function getMasterPool(): Pool {
  if (!masterPool) {
    masterPool = new Pool({
      connectionString: env.masterDatabaseUrl,
      max: 5,
    });
  }
  return masterPool;
}

export async function masterQuery(text: string, params?: any[]): Promise<QueryResult> {
  return getMasterPool().query(text, params);
}

export async function closeMasterPool(): Promise<void> {
  if (masterPool) {
    await masterPool.end();
    masterPool = null;
  }
}
