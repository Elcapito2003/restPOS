import { ReactNode, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Clock, DollarSign, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';

export default function ShiftGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: myShift, isLoading } = useQuery({
    queryKey: ['shift', 'mine'],
    queryFn: () => api.get('/shifts/mine').then(r => r.data),
    enabled: !!user && !isAdmin,
    staleTime: 10000,
  });

  if (!user) return <>{children}</>;
  if (isAdmin) return <>{children}</>;
  if (isLoading) return <FullScreenLoading />;
  if (myShift) return <>{children}</>;
  return <ForcedShiftModal />;
}

function FullScreenLoading() {
  return (
    <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
      <div className="text-center">
        <Clock size={48} className="mx-auto text-gray-400 animate-pulse mb-3" />
        <p className="text-gray-500">Verificando turno...</p>
      </div>
    </div>
  );
}

function ForcedShiftModal() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [startingCash, setStartingCash] = useState('');
  const [notes, setNotes] = useState('');

  const openMutation = useMutation({
    mutationFn: (data: { starting_cash: number; notes?: string }) =>
      api.post('/shifts/open', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift'] });
      qc.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Turno abierto');
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error || 'Error al abrir turno'),
  });

  const cash = parseFloat(startingCash);
  const canSubmit = !isNaN(cash) && cash > 0 && !openMutation.isPending;

  const handleOpen = () => {
    if (!canSubmit) return;
    openMutation.mutate({ starting_cash: cash, notes: notes || undefined });
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-3">
            <Clock size={32} className="text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Abre tu turno</h2>
          <p className="text-sm text-gray-500 mt-1">
            Hola <b>{user?.display_name}</b>, debes abrir un turno antes de operar.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <DollarSign size={14} className="inline mr-1" />
            Fondo inicial de caja <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span>
            <input
              type="number"
              value={startingCash}
              onChange={e => setStartingCash(e.target.value)}
              className="input pl-8 text-xl font-medium w-full"
              placeholder="0.00"
              min="0.01"
              step="0.01"
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Cuenta el efectivo en caja y captúralo. Debe ser mayor a 0.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas (opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="input w-full"
            placeholder="Ej: Turno matutino..."
          />
        </div>

        <button
          onClick={handleOpen}
          disabled={!canSubmit}
          className="btn-primary w-full gap-2 disabled:opacity-50 py-3 text-base"
        >
          <LogIn size={20} />
          {openMutation.isPending ? 'Abriendo...' : 'Abrir turno'}
        </button>

        <div className="text-center pt-2 border-t">
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Cerrar sesión y entrar como otro usuario
          </button>
        </div>
      </div>
    </div>
  );
}
