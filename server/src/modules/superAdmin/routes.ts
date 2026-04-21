import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import * as ctrl from './controller';

const router = Router();

// ─── Super-admin auth middleware ───
function superAdminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, env.superAdminJwtSecret) as any;
    if (payload.role !== 'super_admin') throw new Error('Not a super admin');
    (req as any).admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// ─── Public auth routes ───
router.post('/auth/login', ctrl.login);
router.post('/auth/verify-2fa', ctrl.verify2FA);

// ─── Public: license redeem (used by mobile app to resolve tenant from license code) ───
router.post('/license/redeem', ctrl.redeemLicense);

// ─── Protected routes ───
router.use(superAdminAuth);

router.post('/auth/setup-2fa', ctrl.setup2FA);
router.post('/auth/confirm-2fa', ctrl.confirm2FA);

// Dashboard
router.get('/dashboard', ctrl.getDashboard);

// Tenants CRUD
router.get('/tenants', ctrl.getTenants);
router.get('/tenants/:id', ctrl.getTenant);
router.post('/tenants', ctrl.createTenant);
router.put('/tenants/:id', ctrl.updateTenant);

// Module permissions
router.get('/modules', ctrl.getModules);
router.post('/tenants/:tenantId/modules', ctrl.setModulePermission);

// Licenses
router.get('/licenses', ctrl.getLicenses);
router.post('/tenants/:tenantId/license', ctrl.generateLicense);

// Provisioning — create database for new restaurant
router.post('/tenants/:tenantId/provision', ctrl.provisionTenant);

// Impersonation — enter a restaurant as admin
router.post('/tenants/:tenantId/enter', ctrl.impersonateTenant);

export default router;
