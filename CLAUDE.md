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

## PROBLEMAS PENDIENTES — Divergencia Server vs GitHub

El servidor de producción (165.227.121.235:/opt/restpos) tiene código que **NO está en GitHub**. No se puede hacer `git pull` en el server sin resolver esto primero.

### Archivos staged (modificados pero no commiteados en el server)
- client/package.json
- client/src/App.tsx
- client/src/config/api.ts
- client/src/config/socket.ts
- client/src/layouts/MainLayout.tsx
- client/vite.config.ts
- package-lock.json, package.json
- server/package.json
- server/src/app.ts
- server/src/config/env.ts
- server/src/index.ts
- server/src/modules/auth/routes.ts
- server/src/modules/auth/service.ts
- server/src/modules/payments/service.ts

### Migraciones solo en el server (no en GitHub)
- 018-suppliers-inventory.sql
- 019-purchasing-whatsapp.sql
- 020-chatbot-memory.sql
- 021-reception-payment.sql
- 022-ml-requests.sql
- 023-productions.sql
- 024-presentations.sql

### Módulos/páginas solo en el server (no en GitHub)
- client/src/components/
- client/src/context/ConnectivityContext.tsx
- client/src/offline/
- client/src/pages/AsistentePage.tsx
- client/src/pages/InventarioPage.tsx
- client/src/pages/MercadoLibrePage.tsx
- client/src/pages/PedidosPage.tsx
- client/src/pages/ProduccionesPage.tsx
- client/src/pages/ProveedoresPage.tsx
- client/src/pages/RecepcionPage.tsx
- client/src/pages/SolicitarTransferenciaPage.tsx
- client/src/pages/TransferenciasPage.tsx
- server/src/modules/agent/
- server/src/modules/banking/
- server/src/modules/chatbot/
- server/src/modules/inventory/
- server/src/modules/mercadolibre/
- server/src/modules/productRecipes/
- server/src/modules/productions/
- server/src/modules/purchasing/
- server/src/modules/suppliers/
- server/src/scripts/

### Cómo resolver
1. **Opción A (recomendada):** Desde el server, commitear todo y pushear a una rama nueva (`git checkout -b server-sync && git add -A && git commit && git push`). Luego hacer PR a main para revisar y mergear.
2. **Opción B:** Bajar todo con scp a local, revisar, y pushear desde Windows.
3. **Mientras tanto:** Para cambios de BD en prod, aplicar SQL directo con psql en vez de usar el sistema de migraciones.
