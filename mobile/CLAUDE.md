# mobile — restPOS Comandero (Android)

App nativa para meseros. Toma órdenes en mesa, manda a cocina/barra, imprime comandas automáticamente vía el backend.

## Stack

- **Expo 54 (managed)** + **React Native 0.81** + **TypeScript**
- **React Navigation 7** (native-stack) para flujo entre pantallas
- **axios** para HTTP, **socket.io-client** para realtime
- **@react-native-async-storage/async-storage** para persistencia local (tenant, token, user)
- **Dev**: Expo Go (celular físico) — no hace falta emulador
- **Prod**: EAS build → APK (pendiente)

## Arquitectura multi-tenant

Esta app **no** se conecta a una DB. Habla con el backend (`/opt/restpos/server`) que ya es multi-tenant. El flujo:

1. **Primera vez** → `LicenseEntryScreen` pide un código de licencia
2. App llama `POST /api/super-admin/license/redeem` (público, sin auth)
3. Backend devuelve `{ tenant: { id, name, slug, ... }, license }`
4. `tenant.id` (UUID) se guarda en `AsyncStorage` bajo la llave `tenantId`
5. A partir de ahí **todo request** lleva header `X-Tenant-Id: <uuid>` → el middleware `tenantResolver` en el server cambia al pool DB correcto vía `AsyncLocalStorage`

El JWT generado en el login incluye el `tenantId` embebido → el backend puede autorizar sin depender solo del header.

## Estructura

```
mobile/
├── App.tsx                          # Root: gatea pantallas según estado auth
├── app.json                         # Expo config (package, iconos, usesCleartextTraffic)
├── package.json
├── src/
│   ├── api/
│   │   ├── config.ts                # SERVER_URL, API_URL
│   │   └── client.ts                # axios instance + todos los typed endpoints
│   ├── context/
│   │   └── AuthContext.tsx          # Provider: tenant, user, token, saveTenant/saveSession/logout
│   ├── navigation/
│   │   └── types.ts                 # RootStackParamList para react-navigation
│   ├── screens/
│   │   ├── LicenseEntryScreen.tsx   # Pegar código de licencia
│   │   ├── LoginScreen.tsx          # Grid de meseros + PIN pad
│   │   ├── TablesScreen.tsx         # Pisos + mesas con estado en tiempo real
│   │   ├── OrderScreen.tsx          # Ticket de la mesa (ítems pendientes vs enviados)
│   │   └── MenuScreen.tsx           # Categorías → productos → modificadores
│   └── socket.ts                    # Socket.IO singleton con JWT en handshake
└── assets/                          # íconos default de Expo
```

## Flujo de pantallas (gated en App.tsx)

```
                ┌─── ready=false ────► ActivityIndicator
App             │
(AuthContext) ──┼─── tenant=null ────► LicenseEntryScreen
                │
                ├─── user=null ──────► LoginScreen (lista users del tenant)
                │
                └─── logged in ─────► NavigationContainer
                                           ├── Tables (home)
                                           ├── Order
                                           └── Menu
```

## Config del server

- **SERVER_URL** en `src/api/config.ts` = `http://165.227.121.235`
- Usamos **HTTP** (no HTTPS) porque el server tiene certificado **auto-firmado** y React Native lo rechaza. Cuando se ponga cert válido (Let's Encrypt + dominio), cambiar a `https://`.
- `app.json` tiene `"usesCleartextTraffic": true` para permitir HTTP en APK de producción (Android 9+ lo bloquea por default).

## Endpoints consumidos

Todos bajo `/api`, todos (excepto `/super-admin/license/redeem`) requieren JWT + `X-Tenant-Id`:

| Método | Path | Uso |
|---|---|---|
| POST | `/super-admin/license/redeem` | Resolver código → tenant (público) |
| GET | `/auth/users` | Listar meseros activos del tenant |
| POST | `/auth/pin-login` | Login con PIN → devuelve JWT |
| GET | `/floors` | Lista de pisos |
| GET | `/floors/:id/tables` | Mesas del piso con estado + mesero asignado |
| GET | `/categories/tree` | Árbol de categorías (parent_id jerarquizado) |
| GET | `/products?category_id=X` | Productos de una categoría |
| GET | `/modifier-groups` | Todos los grupos de modificadores con `product_ids[]` |
| GET | `/orders/table/:tableId` | Orden abierta de una mesa (404 si libre) |
| POST | `/orders` | Crear orden (body: `{ table_id?, order_type?, ... }`) |
| POST | `/orders/:id/items` | Agregar ítem + modificadores |
| DELETE | `/orders/:id/items/:itemId` | Quitar ítem (solo si `status=pending`) |
| POST | `/orders/:id/send` | Enviar a cocina + **auto-print** |

## Socket.IO

Conexión se abre con JWT en `handshake.auth.token`. El server (ver `server/src/config/socket.ts`):

1. Verifica el JWT
2. Auto-join a los rooms `user:<userId>` y `tenant:<tenantId>`
3. El cliente también hace `socket.emit('join:floor', floorId)` para recibir cambios del piso actual

Eventos escuchados en la app:

| Evento | Pantalla | Qué hace |
|---|---|---|
| `user:deactivated` | TablesScreen (global) | Logout inmediato con alert |
| `table:status_changed` | TablesScreen | Actualiza color/estado de la mesa |
| `order:created`, `order:updated` | TablesScreen | Re-fetch de mesas |

## Flujo de órdenes — detalles clave

- **Lazy order creation**: al abrir una mesa **libre** no se crea orden. Solo cuando el mesero agrega el primer producto en MenuScreen → `createOrder` + `addItem`. Así se evita marcar la mesa ocupada por error.
- **Ítems inmutables una vez enviados**: la app bloquea borrar un ítem con `status !== 'pending'`. Para corregir algo ya impreso en cocina, eso es job de un admin desde el desktop.
- **Modificadores**: GET `/modifier-groups` trae todos de un jalón (son pocos). Al tocar un producto filtramos en memoria por `product_ids.includes(p.id)`. El modal valida `is_required`, `min_selections`, `max_selections`.
- **Modo rápido (no-mesa)**: botón "+ Rápida" en top-right de Tables. Crea orden con `order_type: 'quick'`, sin `table_id`.

## Impresión 🖨️

No imprimimos desde el celular. El flujo:

1. Mesero presiona "Enviar a cocina" → `POST /orders/:id/send`
2. En `server/src/modules/orders/service.ts` → `sendToKitchen()`:
   - Marca ítems como `sent`
   - Emite socket `order:sent` al room `kitchen`
   - Llama `printComanda(orderId)` → imprime en cocina y barra según el `printer_target` de cada producto (los targets se configuran desde el desktop)

Entonces **mientras haya un cliente que tenga impresoras configuradas** (sea el POS web en Electron o el server directo), la comanda sale. El comandero Android solo dispara el endpoint.

## Auth & seguridad

- JWT vive 12h. No hay refresh tokens — al expirar se pide re-login.
- Si el admin desactiva al mesero (`is_active=false`), el server emite `user:deactivated` al room `user:<id>` → la tablet hace logout en el acto (server-initiated kick).
- Lockout por IP+user: 5 intentos fallidos de PIN = bloqueo 15 min. Ahora el `lockKey` incluye tenantId para no mezclar tenants.
- `AsyncStorage` es **cleartext** en Android. No guarda data súper sensible (tenant UUID + JWT + user profile). Si se necesita algo más fuerte, migrar a `expo-secure-store`.

## Desarrollo

```bash
cd C:\Users\Elcap\restPOS\mobile
npm install          # solo primera vez
npx expo start       # modo LAN (celular y PC en misma WiFi)
# o
npx expo start --tunnel   # si no están en misma red (requiere @expo/ngrok)
```

Escanear el QR con la app **Expo Go** (Play Store). Cambios en el código → hot reload en ~1s.

Para pruebas end-to-end:
- License code de prueba (DUO Café): `85BB889EB2D0F131173AEEE5`
- Tenant ID resultante: `e60c023f-de03-43a0-b0d5-4665913c02a8`

## Build producción (pendiente)

Cuando se quiera un APK instalable sin Expo Go:
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview    # APK
eas build -p android --profile production # AAB (Play Store)
```

Antes de hacerlo:
- Poner cert HTTPS válido en el server y cambiar `SERVER_URL` a `https://`
- Quitar `usesCleartextTraffic` si ya no se necesita
- Subir icon.png, splash, adaptive-icon propios (hoy son los default de Expo)

## Pendientes / next steps

- **QR scanner** para el código de licencia (hoy es manual). Agregar `expo-barcode-scanner`.
- **Navegación de regreso mejorada**: al enviar a cocina desde Order, que regrese a Tables automáticamente.
- **Badge del ticket** en el botón "Ver ticket ›" de MenuScreen con count de ítems pendientes.
- **Notas por ítem**: ahora se pasan solo en POST (no hay UI para editarlas desde el mesero).
- **Cancelación de ítems ya enviados** con motivo (requiere permiso admin) — el endpoint existe, falta UI.
- **Transferir de mesa** / **dividir cuenta** — existen en backend, no en mobile.
- **Modo offline** — Dexie equivalente (`@react-native-async-storage/async-storage` o `expo-sqlite`) + queue de operaciones. Decisión: fase 2 porque agrega mucha complejidad.
- **Soporte múltiples tenants en la misma app** — hoy es 1 tenant por device. Si un mesero trabaja en 2 restaurantes, tiene que hacer "Cambiar restaurante" manualmente.

## Cosas que NO hace (por diseño)

- **No gestiona usuarios** (alta/baja/edición). Solo loguea. La gestión vive en el desktop.
- **No cobra** — la caja cobra desde el desktop. El comandero solo toma orden.
- **No imprime tickets de cuenta** al cliente — eso es caja.
