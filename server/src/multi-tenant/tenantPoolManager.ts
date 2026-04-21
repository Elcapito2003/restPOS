import { Pool } from 'pg';
import { env } from '../config/env';
import { masterQuery } from './masterDb';
import type { TenantDb, TenantInfo } from './types';

interface PoolEntry {
  pool: Pool;
  lastUsed: number;
  tenantInfo: TenantInfo;
}

const pools = new Map<string, PoolEntry>();
const POOL_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CONNECTIONS_PER_TENANT = 5;

// Parse default DB URL for credentials
const match = env.databaseUrl.match(/postgresql:\/\/(\w+):([^@]+)@/);
const [, defaultUser, defaultPass] = match || ['', 'restpos', 'restpos2026secure'];

/**
 * Get or create a connection pool for a specific tenant.
 */
export async function getTenantPool(tenantId: string): Promise<TenantDb> {
  const existing = pools.get(tenantId);
  if (existing) {
    existing.lastUsed = Date.now();
    return wrapPool(existing.pool);
  }

  // Look up tenant info from master DB
  const result = await masterQuery(
    `SELECT id, name, slug, db_name, db_host, db_port, status FROM tenants WHERE id = $1`,
    [tenantId]
  );
  if (result.rows.length === 0) throw new Error(`Tenant not found: ${tenantId}`);

  const tenant: TenantInfo = result.rows[0];
  if (tenant.status !== 'active' && tenant.status !== 'trial') {
    throw new Error(`Tenant ${tenant.name} is ${tenant.status}`);
  }

  const pool = new Pool({
    user: defaultUser,
    password: defaultPass,
    host: tenant.db_host || 'localhost',
    port: tenant.db_port || 5432,
    database: tenant.db_name,
    max: MAX_CONNECTIONS_PER_TENANT,
  });

  pools.set(tenantId, { pool, lastUsed: Date.now(), tenantInfo: tenant });
  console.log(`[tenant-pool] created pool for ${tenant.name} (${tenant.db_name})`);

  return wrapPool(pool);
}

/**
 * Get pool for the default/legacy tenant (backward compatibility).
 * Uses DATABASE_URL from env directly.
 */
let legacyPool: Pool | null = null;

export function getLegacyPool(): TenantDb {
  if (!legacyPool) {
    legacyPool = new Pool({ connectionString: env.databaseUrl, max: 10 });
  }
  return wrapPool(legacyPool);
}

function wrapPool(pool: Pool): TenantDb {
  return {
    query: (text: string, params?: any[]) => pool.query(text, params),
    getClient: () => pool.connect(),
  };
}

/**
 * Evict idle pools to free memory.
 * Called periodically.
 */
export function evictIdlePools(): void {
  const now = Date.now();
  for (const [tenantId, entry] of pools) {
    if (now - entry.lastUsed > POOL_TTL_MS) {
      entry.pool.end().catch(() => {});
      pools.delete(tenantId);
      console.log(`[tenant-pool] evicted idle pool: ${entry.tenantInfo.name}`);
    }
  }
}

/**
 * Get stats for monitoring.
 */
export function getPoolStats() {
  return {
    activePools: pools.size,
    pools: Array.from(pools.entries()).map(([id, entry]) => ({
      tenantId: id,
      name: entry.tenantInfo.name,
      idleMs: Date.now() - entry.lastUsed,
    })),
  };
}

// Evict idle pools every 5 minutes
setInterval(evictIdlePools, 5 * 60 * 1000);
