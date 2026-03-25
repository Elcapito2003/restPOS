import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { Clock, LogIn, LogOut, DollarSign, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ShiftPage() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data: myShift, isLoading } = useQuery({
    queryKey: ['shift', 'mine'],
    queryFn: () => api.get('/shifts/mine').then(r => r.data),
  });
  const { data: openShifts } = useQuery({
    queryKey: ['shifts', 'open'],
    queryFn: () => api.get('/shifts').then(r => r.data),
  });
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  // Open shift form state
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [startingCash, setStartingCash] = useState('');
  const [notes, setNotes] = useState('');

  const openMutation = useMutation({
    mutationFn: (data: { user_id?: number; starting_cash?: number; notes?: string }) =>
      api.post('/shifts/open', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift'] });
      qc.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Turno abierto');
      setShowOpenForm(false);
      setSelectedUserId(null);
      setStartingCash('');
      setNotes('');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  });

  const closeMutation = useMutation({
    mutationFn: () => api.post('/shifts/close'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift'] });
      qc.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Turno cerrado');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  });

  const handleOpenShift = () => {
    const userId = selectedUserId || currentUser?.id;
    openMutation.mutate({
      user_id: userId || undefined,
      starting_cash: startingCash ? parseFloat(startingCash) : 0,
      notes: notes || undefined,
    });
  };

  const availableUsers = users?.filter((u: any) =>
    ['admin', 'manager', 'cashier', 'waiter'].includes(u.role) && u.is_active !== false
  ) || [];

  // Check which users already have open shifts
  const usersWithOpenShifts = new Set(openShifts?.map((s: any) => s.user_id) || []);

  if (isLoading) return <div className="flex items-center justify-center h-full">Cargando...</div>;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Turnos</h2>

      {/* My shift status */}
      <div className="card p-6">
        {myShift ? (
          <div className="text-center">
            <Clock size={40} className="mx-auto text-emerald-500 mb-3" />
            <h3 className="font-bold text-lg mb-1">Tu turno está abierto</h3>
            <p className="text-sm text-gray-500">Desde: {dayjs(myShift.opened_at).format('DD/MM/YYYY HH:mm')}</p>
            {parseFloat(myShift.starting_cash) > 0 && (
              <p className="text-sm text-gray-500">Fondo inicial: <b>${parseFloat(myShift.starting_cash).toFixed(2)}</b></p>
            )}
            <button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending} className="btn-danger gap-2 mt-4">
              <LogOut size={18} /> Cerrar Mi Turno
            </button>
          </div>
        ) : (
          <div className="text-center">
            <Clock size={40} className="mx-auto text-gray-400 mb-3" />
            <h3 className="font-bold text-lg mb-1">No tienes turno abierto</h3>
            <p className="text-sm text-gray-500 mb-4">Abre un turno para comenzar a operar</p>
            {!showOpenForm ? (
              <button onClick={() => { setShowOpenForm(true); setSelectedUserId(currentUser?.id || null); }}
                className="btn-primary gap-2">
                <LogIn size={18} /> Abrir Turno
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Open Shift Form */}
      {showOpenForm && !myShift && (
        <div className="card p-6 space-y-5 border-2 border-blue-200">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <LogIn size={20} className="text-blue-600" /> Abrir Turno
          </h3>

          {/* User selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User size={14} className="inline mr-1" />
              ¿Quién abre el turno?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableUsers.map((u: any) => {
                const hasShift = usersWithOpenShifts.has(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => !hasShift && setSelectedUserId(u.id)}
                    disabled={hasShift}
                    className={`p-3 rounded-lg border-2 flex items-center gap-3 transition-all text-left
                      ${selectedUserId === u.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-300' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                      ${hasShift ? 'opacity-40 cursor-not-allowed' : ''}
                    `}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: u.avatar_color || '#3B82F6' }}
                    >
                      {u.display_name?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{u.display_name}</p>
                      <p className="text-xs text-gray-500">{u.role}</p>
                      {hasShift && <p className="text-xs text-amber-600">Ya tiene turno</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Starting cash */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <DollarSign size={14} className="inline mr-1" />
              Fondo inicial de caja
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
              <input
                type="number"
                value={startingCash}
                onChange={e => setStartingCash(e.target.value)}
                className="input pl-8 text-lg font-medium"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Monto de efectivo con el que inicia la caja</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notas (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input"
              placeholder="Ej: Turno matutino..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowOpenForm(false)} className="btn-secondary flex-1">Cancelar</button>
            <button
              onClick={handleOpenShift}
              disabled={!selectedUserId || openMutation.isPending}
              className="btn-primary flex-1 gap-2 disabled:opacity-50"
            >
              <LogIn size={18} />
              {openMutation.isPending ? 'Abriendo...' : 'Abrir Turno'}
            </button>
          </div>
        </div>
      )}

      {/* Open shifts list */}
      <div className="card">
        <div className="p-4 border-b"><h3 className="font-bold">Turnos Abiertos</h3></div>
        <div className="divide-y">
          {openShifts?.map((s: any) => (
            <div key={s.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: s.avatar_color || '#3B82F6' }}>
                  {s.display_name?.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-sm">{s.display_name}</p>
                  <p className="text-xs text-gray-500">Desde: {dayjs(s.opened_at).format('DD/MM/YYYY HH:mm')}</p>
                  {parseFloat(s.starting_cash) > 0 && (
                    <p className="text-xs text-gray-500">Fondo: ${parseFloat(s.starting_cash).toFixed(2)}</p>
                  )}
                </div>
              </div>
              <span className="px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700">Activo</span>
            </div>
          ))}
          {(!openShifts || openShifts.length === 0) && (
            <p className="p-4 text-center text-gray-400 text-sm">No hay turnos abiertos</p>
          )}
        </div>
      </div>
    </div>
  );
}
