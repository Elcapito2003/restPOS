# restPOS

## Proyecto
Sistema punto de venta (POS) para restaurante/cafetería.

## Stack
- **Frontend:** React + Vite + TypeScript (client/)
- **Backend:** Node.js + TypeScript + Express (server/)
- **Base de datos:** PostgreSQL
- **Process manager:** PM2
- **Repo:** https://github.com/Elcapito2003/restPOS

## Servidor de producción
- **IP:** 165.227.121.235
- **Usuario SSH:** root (llave ed25519 autorizada desde DESKTOP-QIR1U41)
- **Ruta del repo:** /opt/restpos
- **Ruta .env:** /opt/restpos/.env
- **DB URL:** postgresql://restpos:restpos2026secure@localhost:5432/restpos_cloud
- **PM2 process:** `restpos` (id 0)
- **Docker:** openclaw-restpos en puertos 18789-18790

## Estructura de BD relevante
- `categories` — grupos y subgrupos (parent_id). Subgrupos de onzas: 10 oz, 12 oz, 16 oz
- `products` — ligados a categories via category_id
- `modifier_groups` / `modifiers` / `product_modifier_groups` — sistema de modificadores
- Migraciones en server/src/db/migrations/

## Arquitectura Multi-Tenant

Cada restaurante tiene su propia base de datos. Una DB **master** (`restpos_master`) gestiona tenants, licencias, módulos, billing y super-admins.

### Componentes
- **Master DB:** `restpos_master` — tenants, licenses, modules, tenant_modules, billing_records, admin_audit_log, super_admins
- **Tenant DBs:** `restpos_cloud` (DUO Café, legacy) y `restpos_tenant_<slug>` (nuevos)
- **Pool manager:** `server/src/multi-tenant/tenantPoolManager.ts` — abre un pool por tenant, evicta a los 30 min
- **Tenant resolver:** middleware que resuelve el tenant desde el JWT y lo guarda en `AsyncLocalStorage`. `query()`/`getClient()` lo usan automáticamente — cero cambios en services existentes.
- **Provisioner:** crea la DB, corre migraciones, siembra admin + PIN aleatorio, genera licencia
- **Super-admin API:** `/api/super-admin/*` con JWT separado (`SUPER_ADMIN_JWT_SECRET`), 2FA TOTP opcional
- **Panel UI:** React en `/admin` — login (2FA), dashboard (KPIs + mapa México), nuevo restaurante, detalle, impersonation

### Setup
```bash
# Solo la primera vez, en el server:
cd /opt/restpos/server
npx tsx src/db/setupMaster.ts
# Crea DB master + super-admin admin@restpos.com / admin2026 + registra DUO Café como tenant
```

### Env vars extra
- `MASTER_DATABASE_URL` — default `postgresql://restpos:restpos2026secure@localhost:5432/restpos_master`
- `SUPER_ADMIN_JWT_SECRET` — separate from app JWT
