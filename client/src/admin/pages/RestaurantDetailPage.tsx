import { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ArrowLeft, Store, MapPin, User, Key, Package, Check, X, Copy, ExternalLink, Loader2 } from 'lucide-react';

interface Module {
  id: string;
  name: string;
  description: string;
  is_core: boolean;
}

export default function RestaurantDetailPage({ tenantId, onBack }: { tenantId: string; onBack: () => void }) {
  const { adminFetch } = useAdminAuth();
  const [tenant, setTenant] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    Promise.all([
      adminFetch(`/tenants/${tenantId}`).then(r => r.json()),
      adminFetch('/modules').then(r => r.json()),
    ]).then(([t, mods]) => {
      setTenant(t);
      setModules(mods);
      const enabled: Record<string, boolean> = {};
      for (const m of t.modules || []) {
        enabled[m.module_id] = m.enabled;
      }
      setEnabledModules(enabled);
      setLoading(false);
    });
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
