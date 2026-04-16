import WebSocket from 'ws';
import crypto from 'crypto';
import { env } from '../../config/env';

type IncomingHandler = (phone: string, message: string, waMessageId?: string) => void;
let onIncomingMessage: IncomingHandler | null = null;

/** Register a handler for incoming WhatsApp messages */
export function onWhatsAppMessage(handler: IncomingHandler) {
  onIncomingMessage = handler;
}

// ─── Types ───

interface RpcResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: any;
  error?: { code: string; message: string; details?: any };
}

interface RpcEvent {
  type: 'event';
  event: string;
  payload?: any;
  seq?: number;
}

// ─── Persistent WebSocket Client ───

let ws: WebSocket | null = null;
let connected = false;
let connectPromise: Promise<void> | null = null;
const pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function genId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function getWsUrl(): string {
  const http = env.openclawUrl;
  return http.replace(/^http/, 'ws');
}

function ensureConnected(): Promise<void> {
  if (connected && ws?.readyState === WebSocket.OPEN) return Promise.resolve();
  if (connectPromise) return connectPromise;

  connectPromise = new Promise<void>((resolve, reject) => {
    const url = getWsUrl();
    console.log(`[openclaw] connecting to ${url}...`);
    const socket = new WebSocket(url);
    let settled = false;
    let connectId: string | null = null;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.close();
        connectPromise = null;
        reject(new Error('OpenClaw connection timeout'));
      }
    }, 10000);

    function sendConnect() {
      const req = {
        type: 'req',
        id: genId(),
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'gateway-client',
            version: '1.0.0',
            platform: 'node',
            mode: 'backend',
          },
          role: 'operator',
          scopes: ['operator.admin'],
          caps: [],
          auth: env.openclawToken ? { token: env.openclawToken } : undefined,
        },
      };

      connectId = req.id;

      pending.set(connectId, {
        resolve: () => {
          clearTimeout(timeout);
          connected = true;
          settled = true;
          connectPromise = null;
          console.log('[openclaw] connected');
          resolve();
        },
        reject: (err) => {
          clearTimeout(timeout);
          settled = true;
          connectPromise = null;
          socket.close();
          reject(err);
        },
      });

      socket.send(JSON.stringify(req));
    }

    socket.on('open', () => {
      ws = socket;
      // Wait for connect.challenge before sending connect
    });

    socket.on('message', (data) => {
      let msg: any;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }

      if (msg.type === 'event') {
        // Server sends connect.challenge after WS open — respond with connect
        if (msg.event === 'connect.challenge') {
          sendConnect();
        }
        // Incoming WhatsApp message — agent lifecycle start triggers fetch
        if (msg.event === 'agent' && onIncomingMessage) {
          handleAgentEvent(msg.payload);
        }
        return;
      }

      if (msg.type === 'res') {
        const res = msg as RpcResponse;
        const p = pending.get(res.id);
        if (!p) return;
        pending.delete(res.id);
        if (res.ok) {
          p.resolve(res.payload);
        } else {
          p.reject(new Error(res.error?.message || 'RPC error'));
        }
      }
    });

    socket.on('close', () => {
      connected = false;
      ws = null;
      connectPromise = null;
      for (const [id, p] of pending) {
        p.reject(new Error('Connection closed'));
        pending.delete(id);
      }
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          ensureConnected().catch(() => {});
        }, 5000);
      }
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error('Connection closed before connect'));
      }
    });

    socket.on('error', (err) => {
      console.error('[openclaw] ws error:', err.message);
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        connectPromise = null;
        reject(err);
      }
    });
  });

  return connectPromise;
}

async function rpc(method: string, params: any): Promise<any> {
  await ensureConnected();
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('OpenClaw not connected');
  }

  const id = genId();
  const req = { type: 'req', id, method, params };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`RPC timeout: ${method}`));
    }, 30000);

    pending.set(id, {
      resolve: (v) => { clearTimeout(timeout); resolve(v); },
      reject: (e) => { clearTimeout(timeout); reject(e); },
    });

    ws!.send(JSON.stringify(req));
  });
}

// ─── Event Handling ───

// Track which agent runs we've already fetched the user message for
const processedRuns = new Set<string>();

function handleAgentEvent(payload: any) {
  if (!payload || !onIncomingMessage) return;
  const sessionKey: string = payload.sessionKey || '';
  if (!sessionKey.includes('whatsapp:direct:')) return;

  // When an agent run starts, fetch the latest user message from history
  const runId = payload.runId;
  if (payload.stream === 'lifecycle' && payload.data?.phase === 'start' && runId && !processedRuns.has(runId)) {
    processedRuns.add(runId);
    // Keep set small
    if (processedRuns.size > 100) {
      const first = processedRuns.values().next().value;
      if (first) processedRuns.delete(first);
    }

    const phone = sessionKey.replace(/.*whatsapp:direct:/, '').replace(/^\+/, '');

    // Fetch the last user message from chat history
    rpc('chat.history', { sessionKey, limit: 1 }).then((res) => {
      const msgs = res?.messages || [];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'user') {
        const content = Array.isArray(last.content)
          ? last.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
          : String(last.content || '');
        if (content) {
          console.log(`[openclaw] incoming WhatsApp from ${phone}: ${content.substring(0, 80)}`);
          onIncomingMessage!(phone, content);
        }
      }
    }).catch(() => {});
  }
}

// ─── Chat API (for internal chatbot) ───

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Send a message to OpenClaw's AI agent and wait for the response.
 * Sends via chat.send, then polls chat.history until the agent replies.
 */
export async function chatWithAgent(sessionKey: string, message: string, timeoutMs = 90000): Promise<string> {
  await ensureConnected();

  // Send the message
  const sendResult = await rpc('chat.send', {
    sessionKey,
    message,
    deliver: false,
    idempotencyKey: genId(),
  });
  const runId = sendResult?.runId;
  console.log(`[openclaw] chat.send to ${sessionKey}, runId=${runId}`);

  // Poll chat.history for the agent's response
  const startTime = Date.now();
  let pollInterval = 2000; // Start at 2s, increase over time

  while (Date.now() - startTime < timeoutMs) {
    await sleep(pollInterval);
    if (pollInterval < 5000) pollInterval += 500; // Gradually increase

    try {
      const historyRes = await rpc('chat.history', { sessionKey, limit: 5 });
      const msgs = historyRes?.messages || [];

      // Find the last assistant message that came after our user message
      for (let i = msgs.length - 1; i >= 0; i--) {
        const msg = msgs[i];
        if (msg.role === 'assistant') {
          const content = Array.isArray(msg.content)
            ? msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
            : String(msg.content || '');

          if (content && content.trim()) {
            console.log(`[openclaw] got agent response (${content.length} chars)`);
            return content;
          }
        }
        // If we hit a user message, stop looking (agent hasn't replied yet)
        if (msg.role === 'user') break;
      }
    } catch (err: any) {
      console.error(`[openclaw] history poll error: ${err.message}`);
    }
  }

  throw new Error('Agent response timeout');
}

// ─── Public API ───

/** Normalize phone to E.164 with +521 prefix for MX WhatsApp JID */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('521') && digits.length === 13) return `+${digits}`;
  if (digits.startsWith('52') && digits.length === 12) return `+521${digits.slice(2)}`;
  if (digits.length === 10) return `+521${digits}`;
  return `+${digits}`;
}

/** Send a WhatsApp message to a phone number via OpenClaw Gateway */
export async function sendWhatsApp(phone: string, message: string) {
  const e164 = toE164(phone);
  const sessionKey = `agent:main:whatsapp:direct:${e164}`;
  const result = await rpc('chat.send', {
    sessionKey,
    message,
    deliver: true,
    idempotencyKey: genId(),
  });
  return result;
}

/** Check if OpenClaw is reachable */
export async function getOpenClawStatus() {
  try {
    await ensureConnected();
    const result = await rpc('channels.status', {});
    return { connected: true, ...result };
  } catch {
    return { connected: false };
  }
}

/** Start the persistent WebSocket connection (call once at server boot) */
export function startOpenClaw() {
  ensureConnected().catch((err) => {
    console.error('[openclaw] initial connection failed:', err.message);
  });
}
