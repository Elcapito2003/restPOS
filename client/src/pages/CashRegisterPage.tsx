import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import toast from 'react-hot-toast';
import { DollarSign, ArrowUp, ArrowDown, Lock, X, Check, ShieldCheck, Keyboard, LogIn, Inbox } from 'lucide-react';
import { openCashDrawer } from '../lib/cashDrawer';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';

// ─── PIN Authorization Modal (SoftRestaurant-style) ───
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
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-100 to-orange-100 border-b border-orange-300 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-orange-700" />
            <span className="font-bold text-sm text-orange-900">Contraseña de usuario autorizado requerida</span>
          </div>
          <button onClick={onCancel} className="text-gray-500 hover:text-red-500"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* User selector */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Usuario autorizado:</label>
            <div className="grid grid-cols-2 gap-2">
              {adminUsers.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => { setSelectedUser(u.id); setError(''); }}
                  className={`p-2 rounded-lg border-2 flex items-center gap-2 text-left transition-all text-sm
                    ${selectedUser === u.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}
                  `}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: u.avatar_color || '#3B82F6' }}>
                    {u.display_name?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.display_name}</p>
                    <p className="text-xs text-gray-500">{u.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* PIN input */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña:</label>
            <input
              type="password"
              value={pin}
              onChange={e => { setPin(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              className="input text-lg tracking-widest"
              placeholder="••••"
              autoFocus
              maxLength={6}
            />
            {error && <p className="text-red-500 text-sm mt-1 font-medium">{error}</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex border-t">
          <button onClick={() => {}} className="flex-1 flex flex-col items-center gap-1 py-3 bg-amber-50 hover:bg-amber-100 border-r text-amber-800 transition-colors">
            <Keyboard size={20} />
            <span className="text-xs font-medium">Teclado</span>
          </button>
          <button onClick={handleVerify} disabled={!selectedUser || !pin || verifying}
            className="flex-1 flex flex-col items-center gap-1 py-3 bg-emerald-50 hover:bg-emerald-100 border-r text-emerald-700 transition-colors disabled:opacity-40">
            <Check size={20} />
            <span className="text-xs font-medium">{verifying ? 'Verificando...' : 'Aceptar'}</span>
          </button>
          <button onClick={onCancel}
            className="flex-1 flex flex-col items-center gap-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 transition-colors">
            <X size={20} />
            <span className="text-xs font-medium">Cancelar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Movement Form Modal (SoftRestaurant-style) ───
function MovementFormModal({ authorizedBy, onClose }: { authorizedBy: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<'out' | 'in'>('out');
  const [concepto, setConcepto] = useState('');
  const [reference, setReference] = useState('');
  const [importe, setImporte] = useState('');

  const movementMutation = useMutation({
    mutationFn: (data: { type: string; amount: number; reason: string; reference?: string; authorized_by?: number }) =>
      api.post('/cash-register/movement', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-register'] });
      toast.success('Movimiento registrado');
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  });

  const handleSubmit = () => {
    if (!concepto || !importe) return;
    movementMutation.mutate({
      type: tipo,
      amount: parseFloat(importe),
      reason: concepto,
      reference: reference || undefined,
      authorized_by: authorizedBy,
    });
  };

  const handleClear = () => {
    setTipo('out');
    setConcepto('');
    setReference('');
    setImporte('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-white text-sm">Retiros y depósitos de efectivo</span>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>

        {/* Toolbar */}
        <div className="flex border-b bg-gray-50">
          <button onClick={() => {}} className="flex-1 flex flex-col items-center gap-1 py-2.5 hover:bg-orange-50 border-r text-orange-700 transition-colors">
            <Keyboard size={18} />
            <span className="text-[10px] font-medium">Teclado</span>
          </button>
          <button onClick={handleSubmit} disabled={!concepto || !importe || movementMutation.isPending}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 hover:bg-emerald-50 border-r text-emerald-700 transition-colors disabled:opacity-40">
            <Check size={18} />
            <span className="text-[10px] font-medium">Aceptar</span>
          </button>
          <button onClick={handleClear}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 hover:bg-amber-50 border-r text-amber-700 transition-colors">
            <ArrowDown size={18} className="rotate-180" />
            <span className="text-[10px] font-medium">Deshacer</span>
          </button>
          <button onClick={onClose}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 hover:bg-blue-50 text-blue-700 transition-colors">
            <X size={18} />
            <span className="text-[10px] font-medium">Cerrar</span>
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600 w-24 shrink-0">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as 'out' | 'in')}
              className="input flex-1 font-bold uppercase">
              <option value="out">RETIRO</option>
              <option value="in">DEPÓSITO</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600 w-24 shrink-0">Concepto</label>
            <input type="text" value={concepto} onChange={e => setConcepto(e.target.value)}
              className="input flex-1" placeholder="Ej: Pago a proveedor" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600 w-24 shrink-0">Referencia</label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)}
              className="input flex-1" placeholder="Ej: Factura #123" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600 w-24 shrink-0">Importe</label>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
              <input type="number" value={importe} onChange={e => setImporte(e.target.value)}
                className="input pl-8 text-lg font-bold" placeholder="0.00" step="0.01" min="0"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function CashRegisterPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: register, isLoading } = useQuery({
    queryKey: ['cash-register'],
    queryFn: () => api.get('/cash-register/current').then(r => r.data),
  });

  // Movement flow
  const [showAuth, setShowAuth] = useState(false);
  const [authorizedBy, setAuthorizedBy] = useState<number | null>(null);
  const [showMovementForm, setShowMovementForm] = useState(false);

  const handleStartMovement = () => {
    if (user?.role === 'admin' || user?.role === 'manager') {
      setAuthorizedBy(user.id);
      setShowMovementForm(true);
    } else {
      setShowAuth(true);
    }
  };

  const handleAuthSuccess = (userId: number) => {
    setShowAuth(false);
    setAuthorizedBy(userId);
    setShowMovementForm(true);
  };

  if (isLoading) return <div className="flex items-center justify-center h-full">Cargando...</div>;

  // No register open — need to open a shift first
  if (!register) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="card p-8 w-full max-w-sm text-center">
          <DollarSign size={48} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-bold mb-2">No hay caja abierta</h2>
          <p className="text-gray-500 text-sm mb-4">La caja se abre automáticamente al abrir un turno con su fondo inicial.</p>
          <button onClick={() => navigate('/shifts')} className="btn-primary w-full gap-2">
            <LogIn size={18} /> Ir a Abrir Turno
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      {/* Status */}
      <div className="card p-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">Caja Abierta</h2>
            <p className="text-sm text-gray-500">Desde: {dayjs(register.opened_at).format('DD/MM/YYYY HH:mm')}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Fondo inicial</p>
            <p className="text-xl font-bold">${parseFloat(register.opening_amount).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={handleStartMovement} className="btn-primary flex-1 gap-2">
          <DollarSign size={18} /> Retiro / Depósito
        </button>
        <button onClick={() => openCashDrawer()} className="btn-secondary gap-2">
          <Inbox size={18} /> Abrir cajón
        </button>
      </div>

      {/* Movements */}
      <div className="card">
        <div className="p-4 border-b">
          <h3 className="font-bold">Movimientos del día</h3>
        </div>
        <div className="divide-y">
          {register.movements?.map((mov: any) => (
            <div key={mov.id} className="p-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                {mov.type === 'in'
                  ? <ArrowUp size={16} className="text-emerald-500" />
                  : <ArrowDown size={16} className="text-red-500" />}
                <div>
                  <p className="text-sm font-medium">{mov.reason}</p>
                  {mov.reference && <p className="text-xs text-gray-500">Ref: {mov.reference}</p>}
                  <p className="text-xs text-gray-500">{mov.display_name} - {dayjs(mov.created_at).format('HH:mm')}</p>
                </div>
              </div>
              <span className={`font-bold ${mov.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                {mov.type === 'in' ? '+' : '-'}${parseFloat(mov.amount).toFixed(2)}
              </span>
            </div>
          ))}
          {(!register.movements || register.movements.length === 0) && (
            <p className="p-4 text-center text-gray-400 text-sm">Sin movimientos</p>
          )}
        </div>
      </div>

      {/* Auth Modal */}
      {showAuth && (
        <PinAuthModal onSuccess={handleAuthSuccess} onCancel={() => setShowAuth(false)} />
      )}

      {/* Movement Form Modal */}
      {showMovementForm && authorizedBy && (
        <MovementFormModal
          authorizedBy={authorizedBy}
          onClose={() => { setShowMovementForm(false); setAuthorizedBy(null); }}
        />
      )}
    </div>
  );
}
