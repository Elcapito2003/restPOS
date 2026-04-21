import { Request, Response, NextFunction } from 'express';
import { getTenantPool, getLegacyPool } from '../multi-tenant/tenantPoolManager';
import { runWithTenantDb } from '../config/database';
import type { TenantDb } from '../multi-tenant/types';

// Extend Express Request to include tenant context
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantDb?: TenantDb;
    }
  }
}

/**
 * Middleware that resolves the tenant database and sets it as the
 * AsyncLocalStorage context. All downstream query()/getClient() calls
 * automatically use the correct tenant pool — zero changes needed in services.
 */
export function resolveTenant(req: Request, res: Response, next: NextFunction) {
  const tenantId = (req as any).user?.tenantId
    || (req as any).user?.impersonatingTenant
    || req.headers['x-tenant-id'] as string;

  if (tenantId) {
    getTenantPool(tenantId)
      .then((db) => {
        req.tenantId = tenantId;
        req.tenantDb = db;
        // Set AsyncLocalStorage so query()/getClient() use this tenant's pool
        runWithTenantDb(db, () => next());
      })
      .catch((err) => {
        console.error(`[tenant] failed to resolve: ${err.message}`);
        res.status(403).json({ error: 'Tenant not available' });
      });
  } else {
    // Backward compatibility: use legacy pool via AsyncLocalStorage
    const legacyDb = getLegacyPool();
    req.tenantDb = legacyDb;
    runWithTenantDb(legacyDb, () => next());
  }
}

/**
 * Middleware that checks if a module is enabled for the current tenant.
 */
export function requireModule(moduleId: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if ((req as any).user?.role === 'super_admin') return next();
    if (!req.tenantId) return next();

    try {
      const { masterQuery } = await import('../multi-tenant/masterDb');
      const result = await masterQuery(
        `SELECT enabled FROM tenant_modules WHERE tenant_id = $1 AND module_id = $2`,
        [req.tenantId, moduleId]
      );
      if (result.rows.length === 0 || !result.rows[0].enabled) {
        return res.status(403).json({ error: 'Módulo no habilitado para este restaurante' });
      }
      next();
    } catch (err: any) {
      console.error(`[module-guard] error: ${err.message}`);
      next();
    }
  };
}
