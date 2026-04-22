import { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import MexicoMap from '../components/MexicoMap';
import { Store, Shield, CreditCard, Activity, Plus, LogOut, Settings, ScrollText } from 'lucide-react';

export default function DashboardPage({ onNewRestaurant, onSelectTenant, onOpenAuditLog, onOpenSettings }: {
  onNewRestaurant?: () => void;
  onSelectTenant?: (id: string) => void;
  onOpenAuditLog?: () => void;
  onOpenSettings?: () => void;
}) {
  const { admin, logout, adminFetch } = useAdminAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleEnterTenant = async (tenantId: string) => {
    try {
      const res = await adminFetch(`/tenants/${tenantId}/enter`, { method: 'POST' });
      const result = await res.json();
      if (result.token) {
        // Store the impersonation token and redirect to the POS
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify({
          id: 0, username: 'super_admin', display_name: admin?.display_name || 'Super Admin',
          role: 'admin', avatar_color: '#EF4444',
        }));
        window.location.href = '/home';
      }
    } catch (err) {
      console.error('Failed to enter tenant:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const stats = data?.stats || {};
  const tenants = data?.tenants || [];

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg">restPOS</h1>
              <p className="text-xs text-slate-400">Panel de Administración</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onOpenAuditLog} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700 transition-colors" title="Registro de actividad">
              <ScrollText size={18} />
            </button>
            <button onClick={onOpenSettings} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700 transition-colors" title="Configuración / 2FA">
              <Settings size={18} />
            </button>
            <span className="text-sm text-slate-400 hidden md:inline">{admin?.email}</span>
            <button onClick={logout} className="text-slate-400 hover:text-red-400 transition-colors" title="Cerrar sesión">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard icon={Store} label="Restaurantes" value={stats.tenants?.total || 0} sub={`${stats.tenants?.active || 0} activos`} color="blue" />
          <KPICard icon={CreditCard} label="Licencias" value={stats.licenses?.total || 0} sub={`${stats.licenses?.active || 0} activas`} color="green" />
          <KPICard icon={Activity} label="En Prueba" value={stats.tenants?.trial || 0} sub="trial" color="yellow" />
          <KPICard icon={Shield} label="Suspendidos" value={stats.tenants?.suspended || 0} sub="requieren atención" color="red" />
        </div>

        {/* Map */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Mapa de Sucursales</h2>
            <button onClick={onNewRestaurant} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors">
              <Plus size={16} /> Nuevo Restaurante
            </button>
          </div>
          <MexicoMap tenants={tenants} onEnterTenant={handleEnterTenant} />
        </div>

        {/* Restaurant List */}
        <div>
          <h2 className="text-xl font-bold mb-4">Restaurantes</h2>
          <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="text-left p-4">Restaurante</th>
                  <th className="text-left p-4">Ciudad</th>
                  <th className="text-left p-4">Plan</th>
                  <th className="text-left p-4">Estado</th>
                  <th className="text-left p-4">Módulos</th>
                  <th className="text-left p-4">Licencia</th>
                  <th className="text-right p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {tenants.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="p-4">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-slate-400">{t.owner_name}</div>
                    </td>
                    <td className="p-4 text-slate-300">{t.city}, {t.state}</td>
                    <td className="p-4">
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 font-medium">
                        {t.plan || 'N/A'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        t.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        t.status === 'trial' ? 'bg-yellow-500/20 text-yellow-400' :
                        t.status === 'suspended' ? 'bg-red-500/20 text-red-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {t.status === 'active' ? 'Activo' : t.status === 'trial' ? 'Prueba' : t.status === 'suspended' ? 'Suspendido' : t.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 text-xs">
                      {t.modules?.filter((m: any) => m.enabled).length || 0} activos
                    </td>
                    <td className="p-4 text-xs text-slate-500 font-mono">{t.license_code || '-'}</td>
                    <td className="p-4 text-right flex gap-2 justify-end">
                      <button onClick={() => onSelectTenant?.(t.id)}
                        className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
                        Detalle
                      </button>
                      <button onClick={() => handleEnterTenant(t.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
                        Entrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: number | string; sub: string; color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    red: 'bg-red-500/20 text-red-400',
  };
  return (
    <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <span className="text-slate-400 text-sm">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}
