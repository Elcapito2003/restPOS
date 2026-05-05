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

## Pendientes

### MercadoLibre — buscador automatizado roto
El módulo `server/src/modules/mercadolibre/browser.ts` usa Playwright para abrir Chrome y automatizar búsqueda/compra/carrito. **No funciona en producción** porque el server corre en el VPS (Linux headless, NYC) y la ventana de Chrome se abre allá donde el user no la ve. Solo funcionaba cuando todo corría local en una sola PC.

Opciones:
- **A (rápida):** quitar el buscador automatizado, usar solo la API oficial (search, ver órdenes), y para comprar abrir el link de ML en el navegador del user — botón manual "ya compré" que queda registrado en `ml_purchases`.
- **B (1-2 días):** mover Playwright/Puppeteer al main de Electron (corre en la PC del POS), exponer IPC, cambiar `MercadoLibrePage.tsx` para llamar IPC en vez de REST. Solo así la ventana se abre donde el user puede verla.

OAuth (login + token refresh) sí funciona — eso vive en `service.ts` y usa la API REST oficial de ML.

### Reloj checador (huella ZK9500) — Setup en cada PC
El feature de reloj checador con huella digital (v2.4.0) requiere que **el setup.exe del SDK ZKFinger Standard 5.3** corra una vez en cada PC donde se vaya a usar el lector. Eso instala el driver del USB + `libzkfp.dll` en `C:\Windows\System32\`. El instalador de RestPOS NO lo incluye porque ZK no permite redistribución del SDK. Documentar este paso en algún manual de instalación cuando hagamos onboarding de nuevos restaurantes.
