import { Request, Response } from 'express';
import * as service from './service';

// ─── Auth ───

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y password requeridos' });
    const result = await service.login(email, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
}

export async function verify2FA(req: Request, res: Response) {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) return res.status(400).json({ error: 'Token y código requeridos' });
    const result = await service.verify2FA(tempToken, code);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
}

export async function setup2FA(req: Request, res: Response) {
  try {
    const result = await service.setup2FA((req as any).admin.adminId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function confirm2FA(req: Request, res: Response) {
  try {
    const { code } = req.body;
    const result = await service.confirm2FA((req as any).admin.adminId, code);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── Tenants ───

export async function getTenants(_req: Request, res: Response) {
  res.json(await service.getTenants());
}

export async function getTenant(req: Request, res: Response) {
  const tenant = await service.getTenant(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Restaurante no encontrado' });
  res.json(tenant);
}

export async function createTenant(req: Request, res: Response) {
  try {
    const tenant = await service.createTenant(req.body);
    res.status(201).json(tenant);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function updateTenant(req: Request, res: Response) {
  try {
    const tenant = await service.updateTenant(req.params.id, req.body);
    res.json(tenant);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── Modules ───

export async function getModules(_req: Request, res: Response) {
  res.json(await service.getModules());
}

export async function setModulePermission(req: Request, res: Response) {
  try {
    const { module_id, enabled } = req.body;
    await service.setModulePermission(req.params.tenantId, module_id, enabled, (req as any).admin.adminId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── Licenses ───

export async function getLicenses(req: Request, res: Response) {
  const tenantId = req.query.tenant_id as string;
  res.json(await service.getLicenses(tenantId));
}

export async function generateLicense(req: Request, res: Response) {
  try {
    const license = await service.generateLicense(req.params.tenantId, req.body);
    res.status(201).json(license);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── License redeem (public) ───

export async function redeemLicense(req: Request, res: Response) {
  try {
    const { license_code } = req.body;
    if (!license_code || typeof license_code !== 'string') {
      return res.status(400).json({ error: 'license_code requerido' });
    }
    const result = await service.redeemLicense(license_code.trim().toUpperCase());
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── Impersonation ───

export async function impersonateTenant(req: Request, res: Response) {
  try {
    const result = await service.impersonateTenant((req as any).admin.adminId, req.params.tenantId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── Provisioning ───

export async function provisionTenant(req: Request, res: Response) {
  try {
    const result = await service.provisionTenant(req.params.tenantId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── Billing ───

export async function getBilling(req: Request, res: Response) {
  try {
    res.json(await service.getBillingRecords(req.params.tenantId));
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function recordBilling(req: Request, res: Response) {
  try {
    const result = await service.recordBilling(req.params.tenantId, req.body, (req as any).admin.adminId);
    res.status(201).json(result);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function renewLicense(req: Request, res: Response) {
  try {
    const months = Number(req.body.months || 1);
    const result = await service.renewLicense(req.params.tenantId, months, (req as any).admin.adminId);
    res.json(result);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function revokeLicense(req: Request, res: Response) {
  try {
    const result = await service.revokeLicense(Number(req.params.licenseId), (req as any).admin.adminId);
    res.json(result);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

// ─── Health ───

export async function getHealth(req: Request, res: Response) {
  try {
    res.json(await service.getTenantHealth(req.params.tenantId));
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

// ─── Audit log ───

export async function getAuditLog(req: Request, res: Response) {
  try {
    const limit = Number(req.query.limit || 50);
    res.json(await service.getAuditLog(limit));
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

// ─── Dashboard ───

export async function getDashboard(_req: Request, res: Response) {
  const stats = await service.getDashboardStats();
  const tenants = await service.getTenants();
  res.json({ stats, tenants });
}
