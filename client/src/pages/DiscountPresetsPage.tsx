import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, X, Check, ShieldCheck, Keyboard, Tag } from 'lucide-react';

// ─── PIN Authorization Modal ───
function PinAuthModal({ onSuccess, onCancel }: { onSuccess: (userId: number) => void; onCancel: () => void }) {
  const { data: users } = useQuery({
    queryKey: ['auth-users'],
    queryFn: () => api.get('/auth/users').then(r => r.data),
  });

  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const adminUsers = users?.filter((u: any) => ['admin', 'manager'].includes(u.role)) || [];

  const handleVerify = async () => {
    if (!selectedUser || !pin) return;
    setVerifying(true);
    setError('');
    try {
      const res = await api.post('/auth/verify-pin', { userId: selectedUser, pin });
      if (res.data.valid) {
        onSuccess(selectedUser);
      }
    } catch {
      setError('PIN incorrecto');
      setPin('');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-amber-100 to-orange-100 border-b border-orange-300 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-orange-700" />
            <span className="font-bold text-sm text-orange-900">Contraseña de usuario autorizado requerida</span>
          </div>
          <button onClick={onCancel} className="text-gray-500 hover:text-red-500"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Usuario autorizado:</label>
            <div className="grid grid-cols-2 gap-2">
              {adminUsers.map((u: any) => (
                <button key={u.id} onClick={() => { setSelectedUser(u.id); setError(''); }}
                  className={`p-2 rounded-lg border-2 flex items-center gap-2 text-left transition-all text-sm ${selectedUser === u.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: u.avatar_color || '#3B82F6' }}>{u.display_name?.charAt(0)}</div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.display_name}</p>
                    <p className="text-xs text-gray-500">{u.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña:</label>
            <input type="password" value={pin} onChange={e => { setPin(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              className="input text-lg tracking-widest" placeholder="••••" autoFocus maxLength={6} />
            {error && <p className="text-red-500 text-sm mt-1 font-medium">{error}</p>}
          </div>
        </div>
        <div className="flex border-t">
          <button onClick={() => {}} className="flex-1 flex flex-col items-center gap-1 py-3 bg-amber-50 hover:bg-amber-100 border-r text-amber-800 transition-colors">
            <Keyboard size={20} /><span className="text-xs font-medium">Teclado</span>
          </button>
          <button onClick={handleVerify} disabled={!selectedUser || !pin || verifying}
            className="flex-1 flex flex-col items-center gap-1 py-3 bg-emerald-50 hover:bg-emerald-100 border-r text-emerald-700 transition-colors disabled:opacity-40">
            <Check size={20} /><span className="text-xs font-medium">{verifying ? 'Verificando...' : 'Aceptar'}</span>
          </button>
          <button onClick={onCancel}
            className="flex-1 flex flex-col items-center gap-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 transition-colors">
            <X size={20} /><span className="text-xs font-medium">Cancelar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create/Edit Preset Modal ───
function PresetFormModal({ preset, onClose }: { preset: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(preset?.name || '');
  const [code, setCode] = useState(preset?.code || '');
  const [percent, setPercent] = useState(preset?.discount_percent ? String(preset.discount_percent) : '');
  const [isActive, setIsActive] = useState(preset?.is_active !== false);

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/discounts', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['discount-presets'] }); toast.success('Descuento creado'); onClose(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al crear'),
  });

  const updateMut = useMutation({
    mutationFn: (data: any) => api.put(`/discounts/${preset.id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['discount-presets'] }); toast.success('Descuento actualizado'); onClose(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al actualizar'),
  });

  const handleSubmit = () => {
    if (!name || !percent) return;
    const data = { name, code: code || null, discount_percent: parseFloat(percent), is_active: isActive };
    if (preset) updateMut.mutate(data);
    else createMut.mutate(data);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-5 space-y-4">
        <h3 className="font-bold text-lg">{preset ? 'Editar Descuento' : 'Nuevo Descuento'}</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Ej: Influencer Maria" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Código (opcional)</label>
          <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="input" placeholder="Ej: MARIA10" />
          <p className="text-xs text-gray-400 mt-1">Código único para rastrear este descuento</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje de Descuento *</label>
          <input type="number" value={percent} onChange={e => setPercent(e.target.value)} className="input" placeholder="10" min="0.01" max="100" step="0.01" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="is_active" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Activo</label>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={!name || !percent || createMut.isPending || updateMut.isPending}
            className="btn-primary flex-1 disabled:opacity-50">{preset ? 'Guardar' : 'Crear'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function DiscountPresetsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const [authorized, setAuthorized] = useState(isAdminOrManager);
  const [showAuth, setShowAuth] = useState(!isAdminOrManager);
  const [showForm, setShowForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<any | null>(null);

  const { data: presets, isLoading } = useQuery({
    queryKey: ['discount-presets'],
    queryFn: () => api.get('/discounts').then(r => r.data),
    enabled: authorized,
  });

  const toggleMut = useMutation({
    mutationFn: (preset: any) => api.put(`/discounts/${preset.id}`, { is_active: !preset.is_active }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['discount-presets'] }); },
  });

  if (!authorized && showAuth) {
    return <PinAuthModal onSuccess={() => { setAuthorized(true); setShowAuth(false); }} onCancel={() => { setShowAuth(false); window.history.back(); }} />;
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <ShieldCheck size={48} className="mx-auto mb-3 text-gray-300" />
          <p>Acceso no autorizado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold">Descuentos y Códigos</h1>
          <p className="text-sm text-gray-500">Administra los descuentos predefinidos y códigos de influencer</p>
        </div>
        <button onClick={() => { setEditingPreset(null); setShowForm(true); }} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nuevo Descuento
        </button>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-8">Cargando...</div>
      ) : !presets?.length ? (
        <div className="text-center py-12">
          <Tag size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No hay descuentos configurados</p>
          <p className="text-sm text-gray-400 mt-1">Crea tu primer descuento para comenzar</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left p-3 font-medium">Nombre</th>
                <th className="text-left p-3 font-medium">Código</th>
                <th className="text-center p-3 font-medium">Descuento</th>
                <th className="text-center p-3 font-medium">Estado</th>
                <th className="text-center p-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {presets.map((p: any) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3">
                    {p.code ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono">{p.code}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-3 text-center font-bold text-amber-600">{parseFloat(p.discount_percent)}%</td>
                  <td className="p-3 text-center">
                    <button onClick={() => toggleMut.mutate(p)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${p.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {p.is_active ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => { setEditingPreset(p); setShowForm(true); }}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600">
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <PresetFormModal preset={editingPreset} onClose={() => { setShowForm(false); setEditingPreset(null); }} />
      )}
    </div>
  );
}
