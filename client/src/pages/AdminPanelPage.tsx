import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import {
  Wrench, Activity, Server, Database, Wifi, WifiOff, RefreshCw, Trash2, LogOut,
  Printer, Banknote, Fingerprint, AlertTriangle, Bug, Download, Send,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

type Diag = {
  server: { uptime_sec: number; node_env: string; node_version: string; tenant_id?: string; memory_mb: any; load_avg_1m: number; cpu_count: number; now_iso: string };
  db: { ok: boolean; latency_ms: number };
  integrations: { openai: boolean; openclaw: boolean; banregio: boolean; mercadolibre: boolean };
  last_client_error: any;
};

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />;
}

export default function AdminPanelPage() {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: diag, refetch } = useQuery<Diag>({
    queryKey: ['diagnostics'],
    queryFn: () => api.get('/diagnostics').then(r => r.data),
    refetchInterval: 10000,
  });

  const isElectron = !!(window as any).electronPrint;
  const electronPrint = (window as any).electronPrint;
  const electronFp = (window as any).fingerprint;
  const electronReloj = (window as any).reloj;
  const isAdmin = user?.role === 'admin';

  const run = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    try {
      await fn();
      toast.success(`${label}: ok`);
    } catch (e: any) {
      toast.error(`${label}: ${e?.message || 'falló'}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Wrench className="text-blue-600" size={32} />
        <h1 className="text-2xl font-bold">Modo Admin · Panel de control</h1>
      </div>
      <p className="text-gray-600 mb-6">Diagnóstico, herramientas y acciones rápidas para resolver problemas sin tener que pelearte con el sistema.</p>

      {/* Estado del sistema */}
      <Section title="Estado del sistema" icon={<Activity size={18} />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <StatusCard
            ok={!!diag}
            label="Server"
            detail={diag ? `uptime ${Math.floor(diag.server.uptime_sec / 60)}m · ${diag.server.memory_mb.heap_used}/${diag.server.memory_mb.heap_total} MB · load ${diag.server.load_avg_1m.toFixed(2)}` : 'sin conexión'}
          />
          <StatusCard ok={!!diag?.db.ok} label="Base de datos" detail={diag ? `latencia ${diag.db.latency_ms} ms` : '—'} />
          <StatusCard ok={!!socket?.connected} label="Socket.io" detail={socket?.connected ? `id ${socket.id?.slice(0, 8)}…` : 'desconectado'} icon={socket?.connected ? <Wifi size={14} /> : <WifiOff size={14} />} />
          <StatusCard
            ok={isElectron}
            label="App de escritorio"
            detail={isElectron ? 'Electron con printers, huella, cajón disponibles' : 'Modo navegador (sin nativos)'}
          />
          {diag && (
            <>
              <StatusCard ok={diag.integrations.openai} label="OpenAI (scanner tickets)" detail={diag.integrations.openai ? 'API key configurada' : 'Falta OPENAI_API_KEY en .env'} />
              <StatusCard ok={diag.integrations.openclaw} label="OpenClaw (WhatsApp)" detail={diag.integrations.openclaw ? 'Token presente' : 'Sin token'} />
            </>
          )}
        </div>
      </Section>

      {/* Fix rápido */}
      <Section title="Acciones rápidas" icon={<RefreshCw size={18} />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Action label="Refetch de TODOS los datos" busy={busy === 'refetch'} onClick={() => run('refetch', async () => { await qc.invalidateQueries(); await refetch(); })} icon={<RefreshCw size={16} />} />
          <Action label="Limpiar caché del cliente" busy={busy === 'clear-cache'} onClick={() => run('clear-cache', async () => { qc.clear(); })} icon={<Trash2 size={16} />} />
          <Action label="Re-conectar socket" busy={busy === 'reconnect'} onClick={() => run('reconnect', async () => { socket?.disconnect(); socket?.connect(); })} icon={<Wifi size={16} />} />
          <Action label="Logout + Reload" busy={busy === 'logout'} onClick={() => run('logout', async () => { localStorage.clear(); logout(); setTimeout(() => location.reload(), 200); })} icon={<LogOut size={16} />} />
        </div>
      </Section>

      {/* Pruebas (solo en Electron) */}
      {isElectron && (
        <Section title="Pruebas de hardware (solo desktop)" icon={<Printer size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Action label="Probar impresora cocina" busy={busy === 'print-kitchen'} onClick={() => run('print-kitchen', () => electronPrint.testPrinter('kitchen'))} icon={<Printer size={16} />} />
            <Action label="Probar impresora barra" busy={busy === 'print-bar'} onClick={() => run('print-bar', () => electronPrint.testPrinter('bar'))} icon={<Printer size={16} />} />
            <Action label="Probar impresora caja" busy={busy === 'print-cashier'} onClick={() => run('print-cashier', () => electronPrint.testPrinter('cashier'))} icon={<Printer size={16} />} />
            <Action label="Abrir cajón monedero" busy={busy === 'drawer'} onClick={() => run('drawer', () => electronPrint.openCashDrawer({ silent: false }))} icon={<Banknote size={16} />} />
            {electronFp && (
              <Action label="Detectar lector de huella" busy={busy === 'fp-check'} onClick={() => run('fp-check', async () => { const r = await electronFp.deviceInfo(); toast(r.available ? `OK: ${r.count} lector(es)` : `Fallo: ${r.error}`); })} icon={<Fingerprint size={16} />} />
            )}
            {electronReloj && (
              <Action label="Reloj checador: abrir ventana" busy={busy === 'reloj-open'} onClick={() => run('reloj-open', () => electronReloj.open())} icon={<Activity size={16} />} />
            )}
          </div>
        </Section>
      )}

      {/* Inspector */}
      <Section title="Inspector" icon={<Bug size={18} />}>
        <details className="bg-gray-50 rounded-lg p-3">
          <summary className="cursor-pointer text-sm font-medium">Estado raw del server</summary>
          <pre className="text-xs mt-2 overflow-auto bg-white p-2 rounded border">{JSON.stringify(diag, null, 2)}</pre>
        </details>
        <details className="bg-gray-50 rounded-lg p-3 mt-2">
          <summary className="cursor-pointer text-sm font-medium">Usuario y JWT</summary>
          <pre className="text-xs mt-2 overflow-auto bg-white p-2 rounded border">{JSON.stringify({ user, token_preview: localStorage.getItem('token')?.slice(0, 30) + '…' }, null, 2)}</pre>
        </details>
        <details className="bg-gray-50 rounded-lg p-3 mt-2">
          <summary className="cursor-pointer text-sm font-medium">localStorage keys</summary>
          <pre className="text-xs mt-2 overflow-auto bg-white p-2 rounded border">{JSON.stringify(Object.keys(localStorage), null, 2)}</pre>
        </details>
      </Section>

      {/* Reportar */}
      <Section title="Botón del pánico" icon={<AlertTriangle size={18} />}>
        <p className="text-sm text-gray-600 mb-3">Si algo falla y quieres mandarme contexto: clic aquí. Sube el estado actual + último error al server y queda registrado.</p>
        <button
          onClick={() => run('report', async () => {
            await api.post('/diagnostics/report', {
              from: 'desktop',
              screen: location.hash,
              message: 'Reporte manual desde modo admin',
              payload: { diag, user, isElectron },
            });
          })}
          disabled={busy !== null}
          className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center gap-2 hover:bg-red-700 disabled:bg-gray-300"
        >
          <Send size={16} /> Reportar problema ahora
        </button>
      </Section>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4 text-sm text-amber-800">
          ⚠️ Algunas acciones (logout, pruebas hardware) están limitadas para tu rol ({user?.role}).
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow border p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-blue-600">{icon}</span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function StatusCard({ ok, label, detail, icon }: { ok: boolean; label: string; detail: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
      <StatusDot ok={ok} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 font-medium text-sm">{icon}{label}</div>
        <div className="text-xs text-gray-500 truncate">{detail}</div>
      </div>
    </div>
  );
}

function Action({ label, onClick, busy, icon }: { label: string; onClick: () => void; busy: boolean; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-lg text-sm disabled:opacity-50"
    >
      {busy ? <RefreshCw size={14} className="animate-spin" /> : icon}
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}
