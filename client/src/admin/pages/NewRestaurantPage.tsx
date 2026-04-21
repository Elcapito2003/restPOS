import { useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Store, MapPin, User, ArrowLeft, Loader2, Check, Copy } from 'lucide-react';

export default function NewRestaurantPage({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const { adminFetch } = useAdminAuth();
  const [step, setStep] = useState<'form' | 'provisioning' | 'done'>('form');
  const [form, setForm] = useState({
    name: '', slug: '', latitude: '', longitude: '',
    address: '', city: '', state: '',
    owner_name: '', owner_phone: '', owner_email: '',
  });
  const [result, setResult] = useState<{ license_code: string; admin_pin: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  // Auto-generate slug from name
  const updateName = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setForm({ ...form, name, slug });
  };

  const handleCreate = async () => {
    setError('');
    if (!form.name || !form.slug) { setError('Nombre es requerido'); return; }

    try {
      // Step 1: Create tenant record
      const createRes = await adminFetch('/tenants', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const tenant = await createRes.json();
      if (!createRes.ok) throw new Error(tenant.error);

      // Step 2: Provision database
      setStep('provisioning');
      const provRes = await adminFetch(`/tenants/${tenant.id}/provision`, { method: 'POST' });
      const provResult = await provRes.json();
      if (!provRes.ok) throw new Error(provResult.error);

      setResult(provResult);
      setStep('done');
    } catch (err: any) {
      setError(err.message);
      setStep('form');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  // ─── Done screen ───
  if (step === 'done' && result) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto">
            <Check size={32} className="text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Restaurante Creado</h2>
            <p className="text-slate-400 text-sm mt-1">{form.name} está listo para usar</p>
          </div>

          <div className="space-y-3 text-left">
            <div className="bg-slate-700/50 rounded-xl p-4">
              <label className="text-xs text-slate-400">Código de Licencia</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-lg font-mono text-blue-400 flex-1">{result.license_code}</code>
                <button onClick={() => copyToClipboard(result.license_code, 'license')}
                  className="text-slate-400 hover:text-white p-1">
                  {copied === 'license' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="bg-slate-700/50 rounded-xl p-4">
              <label className="text-xs text-slate-400">PIN de Admin</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-lg font-mono text-yellow-400 flex-1">{result.admin_pin}</code>
                <button onClick={() => copyToClipboard(result.admin_pin, 'pin')}
                  className="text-slate-400 hover:text-white p-1">
                  {copied === 'pin' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Envía el código de licencia al dueño del restaurante para que active su app.
            El PIN es para el primer acceso como administrador.
          </p>

          <button onClick={() => { onCreated(); onBack(); }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-colors">
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ─── Provisioning screen ───
  if (step === 'provisioning') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 size={48} className="text-blue-500 animate-spin mx-auto" />
          <h2 className="text-xl font-bold text-white">Creando Restaurante</h2>
          <p className="text-slate-400 text-sm">Creando base de datos, ejecutando migraciones, configurando...</p>
        </div>
      </div>
    );
  }

  // ─── Form ───
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft size={20} /> Volver al Dashboard
        </button>

        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Store size={24} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Nuevo Restaurante</h2>
              <p className="text-sm text-slate-400">Se creará una base de datos independiente</p>
            </div>
          </div>

          {/* Restaurant Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2"><Store size={16} /> Información del Restaurante</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-slate-500">Nombre *</label>
                <input value={form.name} onChange={e => updateName(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="DUO Café Monterrey" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Slug (URL) *</label>
                <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
                  placeholder="duo-cafe-mty" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Estado</label>
                <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white"
                  placeholder="Jalisco" />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2"><MapPin size={16} /> Ubicación</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-slate-500">Dirección</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white"
                  placeholder="Av. Principal 123, Col. Centro" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Ciudad</label>
                <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white"
                  placeholder="Guadalajara" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Latitud</label>
                  <input value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm"
                    placeholder="20.7007" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Longitud</label>
                  <input value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm"
                    placeholder="-103.3818" />
                </div>
              </div>
            </div>
          </div>

          {/* Owner */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2"><User size={16} /> Dueño / Contacto</h3>
            <div className="grid grid-cols-3 gap-3">
              <input value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })}
                className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white"
                placeholder="Nombre" />
              <input value={form.owner_phone} onChange={e => setForm({ ...form, owner_phone: e.target.value })}
                className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white"
                placeholder="Teléfono" />
              <input value={form.owner_email} onChange={e => setForm({ ...form, owner_email: e.target.value })}
                className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white"
                placeholder="Email" />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button onClick={onBack} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl transition-colors">
              Cancelar
            </button>
            <button onClick={handleCreate} disabled={!form.name || !form.slug}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
              <Store size={18} /> Crear Restaurante
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
