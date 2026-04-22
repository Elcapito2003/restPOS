import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { masterQuery } from '../../multi-tenant/masterDb';
import { env } from '../../config/env';

const JWT_SECRET = env.superAdminJwtSecret;

// ─── Auth ───

export async function login(email: string, password: string) {
  const result = await masterQuery(
    'SELECT * FROM super_admins WHERE email = $1 AND is_active = true', [email]
  );
  if (result.rows.length === 0) throw new Error('Credenciales incorrectas');

  const admin = result.rows[0];
  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) throw new Error('Credenciales incorrectas');

  if (admin.totp_enabled) {
    // Return temp token for 2FA verification
    const tempToken = jwt.sign(
      { adminId: admin.id, purpose: '2fa-pending' },
      JWT_SECRET,
      { expiresIn: '5m' }
    );
    return { requires2FA: true, tempToken };
  }

  // No 2FA — issue full token
  return issueToken(admin);
}

export async function verify2FA(tempToken: string, code: string) {
  let payload: any;
  try {
    payload = jwt.verify(tempToken, JWT_SECRET);
  } catch {
    throw new Error('Token expirado. Inicia sesión de nuevo.');
  }
  if (payload.purpose !== '2fa-pending') throw new Error('Token inválido');

  const result = await masterQuery('SELECT * FROM super_admins WHERE id = $1', [payload.adminId]);
  if (result.rows.length === 0) throw new Error('Admin no encontrado');

  const admin = result.rows[0];
  const totp = new OTPAuth.TOTP({
    issuer: 'restPOS',
    label: admin.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(admin.totp_secret),
  });

  const valid = totp.validate({ token: code, window: 1 });
  if (valid === null) throw new Error('Código 2FA incorrecto');

  return issueToken(admin);
}

function issueToken(admin: any) {
  const token = jwt.sign(
    { adminId: admin.id, email: admin.email, role: 'super_admin' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  // Update last login
  masterQuery('UPDATE super_admins SET last_login_at = NOW() WHERE id = $1', [admin.id]);

  return {
    token,
    admin: { id: admin.id, email: admin.email, display_name: admin.display_name, totp_enabled: admin.totp_enabled },
  };
}

// ─── 2FA Setup ───

export async function setup2FA(adminId: number) {
  const result = await masterQuery('SELECT email FROM super_admins WHERE id = $1', [adminId]);
  if (result.rows.length === 0) throw new Error('Admin no encontrado');

  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: 'restPOS',
    label: result.rows[0].email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });

  const uri = totp.toString();
  const qrCodeUrl = await QRCode.toDataURL(uri);

  // Save secret (not yet enabled until confirmed)
  await masterQuery('UPDATE super_admins SET totp_secret = $1 WHERE id = $2', [secret.base32, adminId]);

  return { secret: secret.base32, qrCodeUrl, uri };
}

export async function confirm2FA(adminId: number, code: string) {
  const result = await masterQuery('SELECT totp_secret FROM super_admins WHERE id = $1', [adminId]);
  if (result.rows.length === 0) throw new Error('Admin no encontrado');
  if (!result.rows[0].totp_secret) throw new Error('Primero genera el código QR');

  const totp = new OTPAuth.TOTP({
    issuer: 'restPOS',
    label: 'restPOS',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(result.rows[0].totp_secret),
  });

  const valid = totp.validate({ token: code, window: 1 });
  if (valid === null) throw new Error('Código incorrecto. Intenta de nuevo.');

  await masterQuery('UPDATE super_admins SET totp_enabled = true WHERE id = $1', [adminId]);
  return { success: true };
}

// ─── Tenants CRUD ───

export async function getTenants() {
  const result = await masterQuery(`
    SELECT t.*,
      (SELECT license_code FROM licenses WHERE tenant_id = t.id AND status = 'active' LIMIT 1) as license_code,
      (SELECT plan FROM licenses WHERE tenant_id = t.id AND status = 'active' LIMIT 1) as plan,
      (SELECT json_agg(json_build_object('module_id', tm.module_id, 'enabled', tm.enabled))
       FROM tenant_modules tm WHERE tm.tenant_id = t.id) as modules
    FROM tenants t ORDER BY t.name
  `);
  return result.rows;
}

export async function getTenant(id: string) {
  const result = await masterQuery(`
    SELECT t.*,
      (SELECT license_code FROM licenses WHERE tenant_id = t.id AND status = 'active' LIMIT 1) as license_code,
      (SELECT plan FROM licenses WHERE tenant_id = t.id AND status = 'active' LIMIT 1) as plan,
      (SELECT json_agg(json_build_object('module_id', tm.module_id, 'enabled', tm.enabled))
       FROM tenant_modules tm WHERE tm.tenant_id = t.id) as modules
    FROM tenants t WHERE t.id = $1
  `, [id]);
  return result.rows[0];
}

export async function createTenant(data: {
  name: string; slug: string; latitude?: number; longitude?: number;
  address?: string; city?: string; state?: string;
  owner_name?: string; owner_phone?: string; owner_email?: string;
}) {
  const dbName = `restpos_tenant_${data.slug.replace(/[^a-z0-9_]/g, '_')}`;

  const result = await masterQuery(
    `INSERT INTO tenants (name, slug, db_name, latitude, longitude, address, city, state, owner_name, owner_phone, owner_email)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [data.name, data.slug, dbName, data.latitude || null, data.longitude || null,
     data.address || null, data.city || null, data.state || null,
     data.owner_name || null, data.owner_phone || null, data.owner_email || null]
  );
  return result.rows[0];
}

export async function updateTenant(id: string, data: Record<string, any>) {
  const allowed = ['name', 'latitude', 'longitude', 'address', 'city', 'state',
    'owner_name', 'owner_phone', 'owner_email', 'status', 'timezone', 'logo_url'];
  const fields = Object.keys(data).filter(k => allowed.includes(k) && data[k] !== undefined);
  if (fields.length === 0) return getTenant(id);

  const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => data[f]);
  await masterQuery(`UPDATE tenants SET ${sets}, updated_at = NOW() WHERE id = $1`, [id, ...values]);
  return getTenant(id);
}

// ─── Module Permissions ───

export async function getModules() {
  const result = await masterQuery('SELECT * FROM modules ORDER BY sort_order');
  return result.rows;
}

export async function setModulePermission(tenantId: string, moduleId: string, enabled: boolean, adminId: number) {
  await masterQuery(
    `INSERT INTO tenant_modules (tenant_id, module_id, enabled, enabled_by, enabled_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (tenant_id, module_id) DO UPDATE SET enabled = $3, enabled_by = $4, enabled_at = NOW()`,
    [tenantId, moduleId, enabled, adminId]
  );
}

// ─── Licenses ───

export async function generateLicense(tenantId: string, data: {
  plan?: string; monthly_price?: number; months?: number;
}) {
  const crypto = require('crypto');
  const code = crypto.randomBytes(12).toString('hex').toUpperCase();
  const months = data.months || 1;

  const result = await masterQuery(
    `INSERT INTO licenses (tenant_id, license_code, plan, monthly_price, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + make_interval(months => $5)) RETURNING *`,
    [tenantId, code, data.plan || 'standard', data.monthly_price || 0, months]
  );
  return result.rows[0];
}

export async function getLicenses(tenantId?: string) {
  let sql = `SELECT l.*, t.name as tenant_name FROM licenses l JOIN tenants t ON t.id = l.tenant_id`;
  const params: any[] = [];
  if (tenantId) { params.push(tenantId); sql += ` WHERE l.tenant_id = $1`; }
  sql += ' ORDER BY l.created_at DESC';
  const result = await masterQuery(sql, params);
  return result.rows;
}

// ─── License redeem ───

export async function redeemLicense(licenseCode: string) {
  const result = await masterQuery(
    `SELECT l.id as license_id, l.plan, l.status, l.expires_at,
            t.id as tenant_id, t.name as tenant_name, t.slug, t.logo_url,
            t.timezone, t.currency
     FROM licenses l JOIN tenants t ON t.id = l.tenant_id
     WHERE l.license_code = $1 LIMIT 1`,
    [licenseCode]
  );
  if (result.rows.length === 0) throw new Error('Código de licencia inválido');
  const lic = result.rows[0];
  if (lic.status !== 'active') throw new Error(`Licencia ${lic.status}`);
  if (lic.expires_at && new Date(lic.expires_at) < new Date()) {
    throw new Error('Licencia expirada');
  }
  return {
    tenant: {
      id: lic.tenant_id,
      name: lic.tenant_name,
      slug: lic.slug,
      logo_url: lic.logo_url,
      timezone: lic.timezone,
      currency: lic.currency,
    },
    license: { plan: lic.plan, expires_at: lic.expires_at },
  };
}

// ─── Impersonation ───

export async function impersonateTenant(adminId: number, tenantId: string) {
  const admin = await masterQuery('SELECT * FROM super_admins WHERE id = $1', [adminId]);
  if (admin.rows.length === 0) throw new Error('Admin no encontrado');

  const tenant = await masterQuery('SELECT * FROM tenants WHERE id = $1', [tenantId]);
  if (tenant.rows.length === 0) throw new Error('Restaurante no encontrado');

  const token = jwt.sign(
    { adminId, email: admin.rows[0].email, role: 'super_admin', impersonatingTenant: tenantId },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  // Audit
  await masterQuery(
    `INSERT INTO admin_audit_log (admin_id, action, tenant_id, details) VALUES ($1, 'impersonate', $2, $3)`,
    [adminId, tenantId, JSON.stringify({ tenant_name: tenant.rows[0].name })]
  );

  return { token, tenant: tenant.rows[0] };
}

// ─── Provisioning ───

export async function provisionTenant(tenantId: string) {
  const { provisionTenant: provision } = await import('../../multi-tenant/tenantProvisioner');
  return provision(tenantId);
}

// ─── Billing ───

export async function recordBilling(tenantId: string, data: {
  amount: number;
  period_start: string;
  period_end: string;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
}, adminId: number) {
  const lic = await masterQuery(
    "SELECT id FROM licenses WHERE tenant_id=$1 AND status='active' ORDER BY created_at DESC LIMIT 1",
    [tenantId]
  );
  const result = await masterQuery(
    `INSERT INTO billing_records(tenant_id, license_id, amount, period_start, period_end, status, payment_method, payment_reference, paid_at)
     VALUES($1, $2, $3, $4, $5, 'paid', $6, $7, NOW()) RETURNING *`,
    [
      tenantId,
      lic.rows[0]?.id ?? null,
      data.amount,
      data.period_start,
      data.period_end,
      data.payment_method ?? null,
      data.payment_reference ?? null,
    ]
  );
  await masterQuery(
    `INSERT INTO admin_audit_log(admin_id, action, tenant_id, details) VALUES($1, 'record_payment', $2, $3)`,
    [adminId, tenantId, JSON.stringify({ amount: data.amount, period_start: data.period_start, period_end: data.period_end })]
  );
  return result.rows[0];
}

export async function getBillingRecords(tenantId: string) {
  const result = await masterQuery(
    `SELECT br.*, l.license_code FROM billing_records br
     LEFT JOIN licenses l ON l.id = br.license_id
     WHERE br.tenant_id=$1 ORDER BY br.period_start DESC`,
    [tenantId]
  );
  return result.rows;
}

export async function renewLicense(tenantId: string, months: number, adminId: number) {
  const result = await masterQuery(
    `UPDATE licenses
     SET expires_at = GREATEST(expires_at, NOW()) + make_interval(months => $2)
     WHERE tenant_id = $1 AND status IN ('active','trial')
     RETURNING *`,
    [tenantId, months]
  );
  if (result.rows.length === 0) throw new Error('No hay licencia activa para renovar');
  await masterQuery(
    `INSERT INTO admin_audit_log(admin_id, action, tenant_id, details) VALUES($1, 'renew_license', $2, $3)`,
    [adminId, tenantId, JSON.stringify({ months, new_expires_at: result.rows[0].expires_at })]
  );
  return result.rows[0];
}

export async function revokeLicense(licenseId: number, adminId: number) {
  const result = await masterQuery(
    `UPDATE licenses SET status = 'suspended' WHERE id = $1 RETURNING *`,
    [licenseId]
  );
  if (result.rows.length === 0) throw new Error('Licencia no encontrada');
  await masterQuery(
    `INSERT INTO admin_audit_log(admin_id, action, tenant_id, details) VALUES($1, 'revoke_license', $2, $3)`,
    [adminId, result.rows[0].tenant_id, JSON.stringify({ license_id: licenseId })]
  );
  return result.rows[0];
}

// ─── Tenant Health ───

export async function getTenantHealth(tenantId: string) {
  const info = await masterQuery('SELECT name, db_name FROM tenants WHERE id=$1', [tenantId]);
  if (info.rows.length === 0) throw new Error('Tenant no encontrado');
  const { db_name } = info.rows[0];

  const sizeRes = await masterQuery(`SELECT pg_database_size($1) as bytes`, [db_name]);
  const db_size_mb = Number(sizeRes.rows[0].bytes) / (1024 * 1024);

  let ordersToday = 0;
  let revenueToday = 0;
  let activeUsers = 0;
  let openOrders = 0;

  try {
    const { getTenantPool } = await import('../../multi-tenant/tenantPoolManager');
    const db = await getTenantPool(tenantId);
    const today = await db.query(
      `SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as total FROM orders
       WHERE status='closed' AND DATE(created_at)=CURRENT_DATE`
    );
    const usersR = await db.query(`SELECT COUNT(*) as cnt FROM users WHERE is_active=true`);
    const openR = await db.query(
      `SELECT COUNT(*) as cnt FROM orders WHERE status IN ('open','sent','partial')`
    );
    ordersToday = Number(today.rows[0].cnt);
    revenueToday = Number(today.rows[0].total);
    activeUsers = Number(usersR.rows[0].cnt);
    openOrders = Number(openR.rows[0].cnt);
  } catch (err: any) {
    console.warn(`[health] could not query tenant DB: ${err.message}`);
  }

  await masterQuery(
    `INSERT INTO tenant_health(tenant_id, db_size_mb, orders_today, revenue_today, active_users)
     VALUES($1, $2, $3, $4, $5)`,
    [tenantId, db_size_mb, ordersToday, revenueToday, activeUsers]
  );

  return {
    db_size_mb: Number(db_size_mb.toFixed(2)),
    orders_today: ordersToday,
    revenue_today: revenueToday,
    active_users: activeUsers,
    open_orders: openOrders,
    checked_at: new Date().toISOString(),
  };
}

// ─── Audit log ───

export async function getAuditLog(limit: number = 50) {
  const result = await masterQuery(
    `SELECT a.id, a.action, a.details, a.created_at,
            sa.email as admin_email, sa.display_name as admin_name,
            t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug
     FROM admin_audit_log a
     LEFT JOIN super_admins sa ON sa.id = a.admin_id
     LEFT JOIN tenants t ON t.id = a.tenant_id
     ORDER BY a.created_at DESC LIMIT $1`,
    [Math.min(limit, 200)]
  );
  return result.rows;
}

// ─── Dashboard Stats ───

export async function getDashboardStats() {
  const tenants = await masterQuery(`
    SELECT COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'active') as active,
      COUNT(*) FILTER (WHERE status = 'trial') as trial,
      COUNT(*) FILTER (WHERE status = 'suspended') as suspended
    FROM tenants
  `);
  const licenses = await masterQuery(`
    SELECT COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'active') as active,
      COUNT(*) FILTER (WHERE expires_at < NOW()) as expired
    FROM licenses
  `);
  return {
    tenants: tenants.rows[0],
    licenses: licenses.rows[0],
  };
}
