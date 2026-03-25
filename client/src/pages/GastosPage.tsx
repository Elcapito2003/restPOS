import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { Plus } from 'lucide-react';

export default function GastosPage() {
  const qc = useQueryClient();
  const today = dayjs().format('YYYY-MM-DD');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [showForm, setShowForm] = useState(false);
  const [typeId, setTypeId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const { data: types } = useQuery({
    queryKey: ['expense-types'],
    queryFn: () => api.get('/expenses/types').then(r => r.data),
  });

  const { data: expenses } = useQuery({
    queryKey: ['expenses', startDate, endDate],
    queryFn: () => api.get('/expenses', { params: { start: startDate, end: endDate } }).then(r => r.data),
  });

  const { data: summary } = useQuery({
    queryKey: ['expenses', 'summary', startDate, endDate],
    queryFn: () => api.get('/expenses/summary', { params: { start: startDate, end: endDate } }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      setShowForm(false); setAmount(''); setDescription(''); setTypeId('');
      toast.success('Gasto registrado');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  });

  const totalExpenses = expenses?.reduce((s: number, e: any) => s + parseFloat(e.amount), 0) || 0;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Gastos</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary gap-1 text-sm"><Plus size={16} /> Nuevo Gasto</button>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Desde:</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input w-auto" />
        <label className="text-sm font-medium">Hasta:</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input w-auto" />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total Gastos</p>
          <p className="text-2xl font-bold text-red-600">${totalExpenses.toFixed(2)}</p>
        </div>
        {summary?.slice(0, 3).map((s: any) => (
          <div key={s.type_name} className="card p-4">
            <p className="text-sm text-gray-500">{s.type_name}</p>
            <p className="text-xl font-bold">${parseFloat(s.total).toFixed(2)}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Fecha</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Descripción</th>
              <th className="text-left p-3">Usuario</th>
              <th className="text-right p-3">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {expenses?.map((e: any) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="p-3 text-gray-500">{dayjs(e.created_at).format('DD/MM HH:mm')}</td>
                <td className="p-3 font-medium">{e.type_name}</td>
                <td className="p-3 text-gray-500">{e.description || '-'}</td>
                <td className="p-3">{e.display_name}</td>
                <td className="p-3 text-right font-medium text-red-600">${parseFloat(e.amount).toFixed(2)}</td>
              </tr>
            ))}
            {(!expenses || expenses.length === 0) && (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Sin gastos registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-4 space-y-3">
            <h3 className="font-bold">Registrar Gasto</h3>
            <select value={typeId} onChange={e => setTypeId(e.target.value)} className="input">
              <option value="">Seleccionar tipo de gasto</option>
              {types?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input" placeholder="Monto" step="0.01" />
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="input" placeholder="Descripción" />
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => createMutation.mutate({ expense_type_id: parseInt(typeId), amount: parseFloat(amount), description })} disabled={!typeId || !amount} className="btn-primary flex-1">Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
