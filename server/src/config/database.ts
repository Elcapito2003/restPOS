import { Pool, PoolClient, QueryResult } from 'pg';
import { AsyncLocalStorage } from 'async_hooks';
import { env } from './env';

// ─── Legacy pool (default single-tenant, backward compatible) ───
export const pool = new Pool({
  connectionString: env.databaseUrl,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// ─── Tenant context via AsyncLocalStorage ───
// The tenant resolver middleware sets this per-request.
// Service functions call query()/getClient() as before — they automatically
// use the correct tenant pool if set, or fall back to the legacy pool.

interface TenantContext {
  query: (text: string, params?: any[]) => Promise<QueryResult>;
  getClient: () => Promise<PoolClient>;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Set the tenant DB context for the current async scope.
 * Called by the tenantResolver middleware.
 */
export function runWithTenantDb(ctx: TenantContext, fn: () => void) {
  tenantStorage.run(ctx, fn);
}

/**
 * Query the database. Uses tenant context if available, otherwise legacy pool.
 */
export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const ctx = tenantStorage.getStore();
  if (ctx) return ctx.query(text, params);
  return pool.query(text, params);
}

/**
 * Get a client from the pool. Uses tenant context if available, otherwise legacy pool.
 */
export async function getClient(): Promise<PoolClient> {
  const ctx = tenantStorage.getStore();
  if (ctx) return ctx.getClient();
  return pool.connect();
}
