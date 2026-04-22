import { useEffect, useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ArrowLeft, ScrollText, Loader2, RefreshCw } from 'lucide-react';

interface AuditEntry {
  id: number;
  action: string;
  details: any;
  created_at: string;
  admin_email: string | null;
  admin_name: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  impersonate: 'Entró al restaurante',
  record_payment: 'Registró pago',
  renew_license: 'Renovó licencia',
  revoke_license: 'Suspendió licencia',
};

const ACTION_COLORS: Record<string, string> = {
  impersonate: 'bg-blue-500/20 text-blue-400',
  record_payment: 'bg-green-500/20 text-green-400',
  renew_license: 'bg-emerald-500/20 text-emerald-400',
  revoke_license: 'bg-red-500/20 text-red-400',
};

export default function AuditLogPage({ onBack }: { onBack: () => void }) {
  const { adminFetch } = useAdminAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminFetch('/audit-log?limit=100').then(r => r.json());
      setEntries(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={20} /> Dashboard
          </button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refrescar
          </button>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <ScrollText size={28} className="text-blue-400" /> Registro de Actividad
            </h1>
            <p className="text-sm text-slate-400 mt-1">Acciones de administradores sobre restaurantes y licencias.</p>
          </div>

          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 size={28} className="text-blue-400 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <p className="p-8 text-slate-500 text-center">Sin actividad registrada.</p>
          ) : (
            <div className="divide-y divide-slate-700">
              {entries.map(e => (
                <div key={e.id} className="p-4 hover:bg-slate-700/20 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[e.action] || 'bg-slate-500/20 text-slate-300'}`}>
                          {ACTION_LABELS[e.action] || e.action}
                        </span>
                        {e.tenant_name && (
                          <span className="text-sm font-medium text-white">{e.tenant_name}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        Por <span className="text-slate-300">{e.admin_name || e.admin_email || '—'}</span>
                      </div>
                      {e.details && Object.keys(e.details).length > 0 && (
                        <div className="mt-2 text-[11px] font-mono text-slate-500 bg-slate-900/50 rounded p-2 max-w-xl overflow-x-auto">
                          {JSON.stringify(e.details)}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 text-right whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
