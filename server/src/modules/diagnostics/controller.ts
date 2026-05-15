import { Request, Response } from 'express';
import os from 'os';
import { query } from '../../config/database';
import { env } from '../../config/env';

// Panel de diagnóstico para admin/manager. Devuelve estado del server,
// uptime, DB, OpenClaw, OpenAI, sockets activos, último error, etc.
// Usado por el "Modo Admin" en desktop y mobile.

let lastReportedClientError: any = null;
const clientErrorHistory: Array<{ ts: string; from: string; payload: any }> = [];

export async function getDiagnostics(req: Request, res: Response) {
  const now = Date.now();
  let dbOk = false, dbLatency = -1;
  try {
    const t = Date.now();
    await query('SELECT 1');
    dbLatency = Date.now() - t;
    dbOk = true;
  } catch {}

  const mem = process.memoryUsage();
  const load = os.loadavg();
  const cpuCount = os.cpus().length;

  res.json({
    server: {
      uptime_sec: Math.floor(process.uptime()),
      node_env: env.nodeEnv,
      node_version: process.version,
      tenant_id: req.tenantId,
      memory_mb: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heap_used: Math.round(mem.heapUsed / 1024 / 1024),
        heap_total: Math.round(mem.heapTotal / 1024 / 1024),
      },
      load_avg_1m: load[0],
      cpu_count: cpuCount,
      now_iso: new Date(now).toISOString(),
    },
    db: { ok: dbOk, latency_ms: dbLatency },
    integrations: {
      openai: !!env.openaiApiKey,
      openclaw: !!env.openclawToken,
      banregio: !!env.banregioUser,
      mercadolibre: !!env.mlClientSecret,
    },
    last_client_error: lastReportedClientError,
  });
}

export async function getClientErrors(_req: Request, res: Response) {
  res.json(clientErrorHistory.slice(-50).reverse());
}

export async function reportProblem(req: Request, res: Response) {
  const { from, screen, payload, screenshot, message } = req.body || {};
  const entry = {
    ts: new Date().toISOString(),
    from: from || 'unknown',
    payload: {
      user_id: (req.user as any)?.userId,
      tenant_id: req.tenantId,
      screen,
      message,
      payload,
      // No guardamos screenshot full en memoria — si viene, anotamos su tamaño
      screenshot_size: screenshot ? `${Math.round(screenshot.length / 1024)} KB` : null,
    },
  };
  lastReportedClientError = entry;
  clientErrorHistory.push(entry);
  if (clientErrorHistory.length > 200) clientErrorHistory.shift();
  console.warn('[diagnostics] reporte de cliente:', JSON.stringify(entry.payload).slice(0, 500));
  res.json({ ok: true, id: clientErrorHistory.length });
}
