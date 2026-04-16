/**
 * Setup script for OpenClaw integration.
 * Run once to configure the AI agent with restPOS skills.
 *
 * Usage: npx tsx src/scripts/setup-openclaw.ts
 */
import WebSocket from 'ws';
import crypto from 'crypto';
import { env } from '../config/env';

function genId() { return crypto.randomBytes(8).toString('hex'); }

const wsUrl = env.openclawUrl.replace(/^http/, 'ws');
const ws = new WebSocket(wsUrl);

function send(method: string, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = genId();
    const timeout = setTimeout(() => reject(new Error(`timeout: ${method}`)), 15000);
    const handler = (data: any) => {
      const msg = JSON.parse(String(data));
      if (msg.type === 'res' && msg.id === id) {
        clearTimeout(timeout);
        ws.off('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ type: 'req', id, method, params }));
  });
}

ws.on('message', async (data) => {
  const msg = JSON.parse(String(data));
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    await send('connect', {
      minProtocol: 3, maxProtocol: 3,
      client: { id: 'gateway-client', version: '1.0.0', platform: 'node', mode: 'backend' },
      role: 'operator', scopes: ['operator.admin'], caps: [],
      auth: env.openclawToken ? { token: env.openclawToken } : undefined,
    });
    console.log('Connected to OpenClaw\n');

    // 1. Ensure tools profile is 'full'
    const cfgRes = await send('config.get', {});
    const currentProfile = cfgRes.payload?.parsed?.tools?.profile;
    if (currentProfile !== 'full') {
      const hash = cfgRes.payload?.hash;
      const r = await send('config.patch', {
        raw: `{ tools: { profile: 'full' } }`,
        baseHash: hash,
      });
      console.log(`Tools profile: ${currentProfile} → full (${r.ok ? 'OK' : r.error?.message})`);
    } else {
      console.log('Tools profile: already "full"');
    }

    // 2. Write TOOLS.md
    const dbUrl = env.databaseUrl;
    const match = dbUrl.match(/postgresql:\/\/(\w+):([^@]+)@([^:]+):(\d+)\/(\w+)/);
    const [, dbUser, dbPass, dbHost, dbPort, dbName] = match || [];

    const toolsContent = buildToolsContent(dbUser, dbPass, dbHost, dbPort, dbName);
    const toolsRes = await send('agents.files.set', { agentId: 'main', name: 'TOOLS.md', content: toolsContent });
    console.log(`TOOLS.md: ${toolsRes.ok ? 'Written' : toolsRes.error?.message}`);

    // 3. Write USER.md
    const userContent = `# USER.md - About My Human

- **Business**: Runs a restaurant
- **System**: Uses restPOS — a full restaurant POS system
- **Language**: Spanish (México)
- **Timezone**: America/Mexico_City

## What They Need

- Help managing restaurant operations via WhatsApp and the restPOS app
- Inventory tracking, supplier orders, sales reports, menu management
- Quick, concise answers in Spanish
`;
    const userRes = await send('agents.files.set', { agentId: 'main', name: 'USER.md', content: userContent });
    console.log(`USER.md: ${userRes.ok ? 'Written' : userRes.error?.message}`);

    console.log('\nSetup complete!');
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (err) => { console.error('Error:', err.message); process.exit(1); });
setTimeout(() => { console.log('Timeout'); process.exit(1); }, 30000);

function buildToolsContent(user: string, pass: string, host: string, port: string, db: string): string {
  const agentKey = env.openclawToken;
  return `# TOOLS.md - restPOS Restaurant Management System

## API Access

Use **web_fetch** to call the restPOS API. All endpoints require the agent key header.

Base URL: \`http://172.18.0.1:3001/api/agent\`
Header: \`X-Agent-Key: ${agentKey}\`

## Available Endpoints

### Inventory
- \`GET /inventory\` — List all inventory. Query: \`?search=pollo\` or \`?low_stock=true\`
- \`POST /inventory/adjust\` — Adjust stock. Body: \`{ "item_name": "pollo", "type": "entrada", "quantity": 10, "reason": "Compra" }\`
  - Types: entrada, salida, merma, ajuste

### Products (Menu)
- \`GET /products\` — List products. Query: \`?search=tacos\`
- \`POST /products/update\` — Update product. Body: \`{ "name": "tacos", "price": 55, "is_available": true }\`
- \`POST /products/create\` — New product. Body: \`{ "name": "Taco de Birria", "price": 65, "category_name": "Tacos" }\`

### Sales
- \`GET /sales/today\` — Today's sales summary (orders, total, avg ticket, top products)

### Suppliers
- \`GET /suppliers\` — List suppliers. Query: \`?search=carnes\`

### Orders
- \`GET /orders\` — Supplier orders. Query: \`?status=sent\`

### MercadoLibre Requests
- \`POST /ml-request\` — Create purchase request. Body: \`{ "product_description": "Vasos EU 16oz", "quantity": 3, "priority": "normal", "requested_by": "Usuario", "search_query": "vasos eu 16oz mercadolibre" }\`

### Expenses
- \`GET /expenses\` — Recent expenses. Query: \`?days=7\`

### Memory
- \`POST /memory\` — Save a fact. Body: \`{ "session_id": "agent", "fact": "El restaurante cierra a las 11pm", "category": "context" }\`
- \`GET /memory\` — Recall facts. Query: \`?session_id=agent\`

## How to call the API

Use web_fetch with POST or GET. Always include the agent key header. Example:

\`\`\`
web_fetch("http://172.18.0.1:3001/api/agent/inventory?search=pollo", { headers: { "X-Agent-Key": "${agentKey}" } })
web_fetch("http://172.18.0.1:3001/api/agent/ml-request", { method: "POST", headers: { "X-Agent-Key": "${agentKey}", "Content-Type": "application/json" }, body: JSON.stringify({ product_description: "Vasos EU 16oz", quantity: 3 }) })
\`\`\`

## Rules
1. **Confirm before modifying data** — tell the user what you'll change and wait for "sí"/"ok"/"dale"
2. Currency: Mexican pesos (MXN)
3. Be concise in WhatsApp
4. Respond in Spanish always
5. **Menu changes**: prefer disabling over deleting. Use products/update with is_available=false.
6. **MercadoLibre**: Create a request via /ml-request. The admin processes it from their computer.
7. Save memories via /memory when asked to remember something.
`;
}
