import { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  ArrowLeft, Store, MapPin, User, Key, Package, Check, Copy, ExternalLink,
  Loader2, Activity, DollarSign, RefreshCw, Ban, Calendar, Users, HardDrive,
} from 'lucide-react';

interface Module {
  id: string;
  name: string;
  description: string;
  is_core: boolean;
}

interface Health {
  db_size_mb: number;
  orders_today: number;
  revenue_today: number;
  active_users: number;
  open_orders: number;
  checked_at: string;
}

interface BillingRecord {
  id: number;
  amount: string;
  period_start: string;
  period_end: string;
  status: string;
  payment_method: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  created_at: string;
  license_code?: string;
}

export default function RestaurantDetailPage({ tenantId, onBack }: { tenantId: string; onBack: () => void }) {
  const { adminFetch } = useAdminAuth();
  const [tenant, setTenant] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const [health, setHealth] = useState<Health | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [billing, setBilling] = useState<BillingRecord[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', period_start: '', period_end: '', payment_method: 'transfer', payment_reference: '' });
  const [renewing, setRenewing] = useState(false);

  const reloadTenant = async () => {
    const t = await adminFetch(`/tenants/${tenantId}`).then(r => r.json());
    setTenant(t);
    const enabled: Record<string, boolean> = {};
    for (const m of t.modules || []) enabled[m.module_id] = m.enabled;
    setEnabledModules(enabled);
  };

  const loadBilling = async () => {
    const list = await adminFetch(`/tenants/${tenantId}/billing`).then(r => r.json());
    setBilling(Array.isArray(list) ? list : []);
  };

  const loadHealth = async () => {
    setHealthLoading(true);
    try {
      const h = await adminFetch(`/tenants/${tenantId}/health`).then(r => r.json());
      setHealth(h);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      adminFetch(`/tenants/${tenantId}`).then(r => r.json()),
      adminFetch('/modules').then(r => r.json()),
      adminFetch(`/tenants/${tenantId}/billing`).then(r => r.json()).catch(() => []),
    ]).then(([t, mods, bill]) => {
      setTenant(t);
      setModules(mods);
      const enabled: Record<string, boolean> = {};
      for (const m of t.modules || []) enabled[m.module_id] = m.enabled;
      setEnabledModules(enabled);
      setBilling(Array.isArray(bill) ? bill : []);
      setLoading(false);
    });
    loadHealth();
  }, [tenantId]);

  const toggleModule = async (moduleId: string, enabled: boolean) => {
    setSaving(moduleId);
    try {
      await adminFetch(`/tenants/${tenantId}/modules`, {
        method: 'POST',
        body: JSON.stringify({ module_id: moduleId, enabled }),
      });
      setEnabledModules(prev => ({ ...prev, [moduleId]: enabled }));
    } catch (err) {
      console.error('Failed to toggle module:', err);
    } finally {
      setSaving(null);
    }
  };

  const handleEnter = async () => {
    const res = await adminFetch(`/tenants/${tenantId}/enter`, { method: 'POST' });
    const result = await res.json();
    if (result.token) {
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify({
        id: 0, username: 'super_admin', display_name: 'Super Admin',
        role: 'admin', avatar_color: '#EF4444',
      }));
      window.location.href = '/home';
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleRenew = async (months: number) => {
    if (!confirm(`¿Renovar licencia por ${months} mes${months !== 1 ? 'es' : ''}?`)) return;
    setRenewing(true);
    try {
      await adminFetch(`/tenants/${tenantId}/license/renew`, { method: 'POST', body: JSON.stringify({ months }) });
      await reloadTenant();
    } finally {
      setRenewing(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!payForm.amount || !payForm.period_start || !payForm.period_end) {
      alert('Completa monto, periodo inicio y fin');
      return;
    }
    await adminFetch(`/tenants/${tenantId}/billing`, {
      method: 'POST',
      body: JSON.stringify({
        amount: Number(payForm.amount),
        period_start: payForm.period_start,
        period_end: payForm.period_end,
        payment_method: payForm.payment_method,
        payment_reference: payForm.payment_reference || null,
      }),
    });
    setShowPaymentForm(false);
    setPayForm({ amount: '', period_start: '', period_end: '', payment_method: 'transfer', payment_reference: '' });
    await loadBilling();
  };

  const handleSuspend = async () => {
    if (!confirm('¿Suspender licencia? El restaurante perderá acceso.')) return;
    const licId = tenant?.license_id ?? tenant?.licenses?.[0]?.id;
    if (!licId) { alert('No hay licencia activa'); return; }
    await adminFetch(`/licenses/${licId}/revoke`, { method: 'PATCH' });
    await reloadTenant();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 size={32} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  const license = tenant?.license_code;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={20} /> Volver al Dashboard
        </button>

        {/* Header */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center">
              <Store size={28} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{tenant?.name}</h1>
              <p className="text-slate-400 text-sm flex items-center gap-1">
                <MapPin size={14} /> {tenant?.city}, {tenant?.state}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
              tenant?.status === 'active' ? 'bg-green-500/20 text-green-400' :
              tenant?.status === 'trial' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {tenant?.status === 'active' ? 'Activo' : tenant?.status}
            </span>
            <button onClick={handleEnter}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors">
              <ExternalLink size={16} /> Entrar al Restaurante
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Info */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 space-y-4">
            <h2 className="font-bold flex items-center gap-2"><User size={18} /> Información</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Dueño</span>
                <span>{tenant?.owner_name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Teléfono</span>
                <span>{tenant?.owner_phone || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email</span>
                <span>{tenant?.owner_email || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dirección</span>
                <span className="text-right max-w-[200px]">{tenant?.address || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">DB</span>
                <span className="font-mono text-xs text-slate-500">{tenant?.db_name}</span>
              </div>
            </div>
          </div>

          {/* License */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 space-y-4">
            <h2 className="font-bold flex items-center gap-2"><Key size={18} /> Licencia</h2>
            {license ? (
              <div className="bg-slate-700/50 rounded-xl p-4">
                <label className="text-xs text-slate-400">Código de Licencia</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-lg font-mono text-blue-400 flex-1">{license}</code>
                  <button onClick={() => copyToClipboard(license, 'lic')} className="text-slate-400 hover:text-white p-1">
                    {copied === 'lic' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Sin licencia activa</p>
            )}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Plan</span>
                <span className="text-blue-400">{tenant?.plan || 'standard'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Creado</span>
                <span>{tenant?.created_at ? new Date(tenant.created_at).toLocaleDateString('es-MX') : '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Health snapshot */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2"><Activity size={18} /> Salud del Restaurante</h2>
            <button onClick={loadHealth} disabled={healthLoading}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50">
              <RefreshCw size={16} className={healthLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          {health ? (
            <div className="grid grid-cols-5 gap-3">
              <HealthCard icon={DollarSign} label="Ventas hoy" value={`$${Number(health.revenue_today).toFixed(0)}`} sub={`${health.orders_today} órdenes`} color="green" />
              <HealthCard icon={Package} label="Abiertas" value={health.open_orders} sub="ahora" color="orange" />
              <HealthCard icon={Users} label="Usuarios" value={health.active_users} sub="activos" color="blue" />
              <HealthCard icon={HardDrive} label="DB" value={`${health.db_size_mb.toFixed(1)} MB`} sub="tamaño" color="purple" />
              <HealthCard icon={RefreshCw} label="Chequeado" value={new Date(health.checked_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} sub="hoy" color="slate" />
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Cargando...</p>
          )}
        </div>

        {/* Billing */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2"><DollarSign size={18} /> Licencia y Pagos</h2>
            <div className="flex gap-2">
              <button onClick={() => handleRenew(1)} disabled={renewing}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors disabled:opacity-50">
                <Calendar size={14} /> +1 mes
              </button>
              <button onClick={() => handleRenew(12)} disabled={renewing}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors disabled:opacity-50">
                <Calendar size={14} /> +1 año
              </button>
              <button onClick={() => setShowPaymentForm(v => !v)}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors">
                <DollarSign size={14} /> Registrar pago
              </button>
              <button onClick={handleSuspend}
                className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors">
                <Ban size={14} /> Suspender
              </button>
            </div>
          </div>

          {showPaymentForm && (
            <div className="bg-slate-700/40 rounded-xl p-4 mb-4 grid grid-cols-5 gap-3 items-end">
              <div>
                <label className="text-[11px] text-slate-400">Monto</label>
                <input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="0.00" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Inicio</label>
                <input type="date" value={payForm.period_start} onChange={e => setPayForm({ ...payForm, period_start: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Fin</label>
                <input type="date" value={payForm.period_end} onChange={e => setPayForm({ ...payForm, period_end: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Método</label>
                <select value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="transfer">Transferencia</option>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <button onClick={handleRecordPayment}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                Guardar
              </button>
              <div className="col-span-5">
                <label className="text-[11px] text-slate-400">Referencia (opcional)</label>
                <input value={payForm.payment_reference} onChange={e => setPayForm({ ...payForm, payment_reference: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white font-mono" placeholder="Folio, last 4, etc." />
              </div>
            </div>
          )}

          {billing.length === 0 ? (
            <p className="text-slate-500 text-sm">Sin pagos registrados</p>
          ) : (
            <div className="overflow-hidden border border-slate-700 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-700/40 text-xs text-slate-400">
                  <tr><th className="text-left p-3">Periodo</th><th className="text-right p-3">Monto</th><th className="p-3">Método</th><th className="p-3">Estado</th><th className="p-3">Pagado</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {billing.map(b => (
                    <tr key={b.id} className="hover:bg-slate-700/30">
                      <td className="p-3 text-xs">{new Date(b.period_start).toLocaleDateString('es-MX')} → {new Date(b.period_end).toLocaleDateString('es-MX')}</td>
                      <td className="p-3 text-right font-mono">${Number(b.amount).toFixed(2)}</td>
                      <td className="p-3 text-center text-xs text-slate-400">{b.payment_method || '-'}</td>
                      <td className="p-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          b.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                          b.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'}`}>{b.status}</span>
                      </td>
                      <td className="p-3 text-xs text-slate-400">{b.paid_at ? new Date(b.paid_at).toLocaleDateString('es-MX') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modules */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="font-bold flex items-center gap-2 mb-4"><Package size={18} /> Módulos</h2>
          <div className="grid grid-cols-2 gap-3">
            {modules.map(mod => {
              const enabled = enabledModules[mod.id] || false;
              const isCore = mod.is_core;
              const isSaving = saving === mod.id;

              return (
                <div key={mod.id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                    enabled ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-800 border-slate-700 opacity-60'
                  }`}>
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {mod.name}
                      {isCore && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">CORE</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{mod.description}</p>
                  </div>
                  {isCore ? (
                    <div className="text-green-400"><Check size={20} /></div>
                  ) : isSaving ? (
                    <Loader2 size={20} className="text-blue-400 animate-spin" />
                  ) : (
                    <button
                      onClick={() => toggleModule(mod.id, !enabled)}
                      className={`w-12 h-7 rounded-full transition-colors relative ${
                        enabled ? 'bg-green-500' : 'bg-slate-600'
                      }`}>
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        enabled ? 'left-6' : 'left-1'
                      }`} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-500/15 text-green-400',
    orange: 'bg-orange-500/15 text-orange-400',
    blue: 'bg-blue-500/15 text-blue-400',
    purple: 'bg-purple-500/15 text-purple-400',
    slate: 'bg-slate-500/15 text-slate-300',
  };
  return (
    <div className="bg-slate-700/30 rounded-xl p-3 border border-slate-700">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${colors[color]}`}>
        <Icon size={16} />
      </div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}
