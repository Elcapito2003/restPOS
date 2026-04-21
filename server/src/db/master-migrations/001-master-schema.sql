-- ═══════════════════════════════════════════════════════
-- RESTPOS MASTER DATABASE — Multi-tenant management
-- ═══════════════════════════════════════════════════════

-- Super-admin accounts (separate from per-tenant users)
CREATE TABLE IF NOT EXISTS super_admins (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  totp_secret VARCHAR(64),
  totp_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenants (each restaurant)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  db_name VARCHAR(100) UNIQUE NOT NULL,
  db_host VARCHAR(255) DEFAULT 'localhost',
  db_port INT DEFAULT 5432,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','suspended','pending','trial','archived')),
  -- Location for map
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  -- Contact
  owner_name VARCHAR(200),
  owner_phone VARCHAR(30),
  owner_email VARCHAR(200),
  -- Config
  timezone VARCHAR(50) DEFAULT 'America/Mexico_City',
  currency VARCHAR(10) DEFAULT 'MXN',
  logo_url TEXT,
  -- Tracking
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Licenses
CREATE TABLE IF NOT EXISTS licenses (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  license_code VARCHAR(32) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'standard',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','expired','suspended','trial')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  auto_renew BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Module catalog
CREATE TABLE IF NOT EXISTS modules (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_core BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0
);

-- Per-tenant module permissions
CREATE TABLE IF NOT EXISTS tenant_modules (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_id VARCHAR(50) NOT NULL REFERENCES modules(id),
  enabled BOOLEAN DEFAULT true,
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  enabled_by INT REFERENCES super_admins(id),
  PRIMARY KEY (tenant_id, module_id)
);

-- Billing history
CREATE TABLE IF NOT EXISTS billing_records (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  license_id INT REFERENCES licenses(id),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'MXN',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled')),
  payment_method VARCHAR(50),
  payment_reference VARCHAR(200),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id SERIAL PRIMARY KEY,
  admin_id INT REFERENCES super_admins(id),
  action VARCHAR(100) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant health snapshots
CREATE TABLE IF NOT EXISTS tenant_health (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  db_size_mb DECIMAL(10,2),
  connection_count INT,
  orders_today INT,
  revenue_today DECIMAL(12,2),
  active_users INT,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_licenses_tenant ON licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_tenant ON billing_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON admin_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_health_tenant ON tenant_health(tenant_id, checked_at DESC);
