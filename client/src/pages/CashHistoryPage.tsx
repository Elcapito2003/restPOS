import { useQuery } from '@tanstack/react-query';
import api from '../config/api';
import dayjs from 'dayjs';

export default function CashHistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['cash-register', 'history'],
    queryFn: () => api.get('/cash-register/history').then(r => r.data),
  });

  if (isLoading) return <div className="flex items-center justify-center h-full">Cargando...</div>;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Historial de Cajas</h2>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Apertura</th>
              <th className="text-left p-3">Cierre</th>
              <th className="text-left p-3">Abrió</th>
              <th className="text-left p-3">Cerró</th>
              <th className="text-right p-3">Fondo</th>
              <th className="text-right p-3">Esperado</th>
              <th className="text-right p-3">Real</th>
              <th className="text-right p-3">Diferencia</th>
              <th className="text-center p-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data?.map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="p-3">{dayjs(r.opened_at).format('DD/MM/YY HH:mm')}</td>
                <td className="p-3">{r.closed_at ? dayjs(r.closed_at).format('DD/MM/YY HH:mm') : '-'}</td>
                <td className="p-3">{r.opened_by_name}</td>
                <td className="p-3">{r.closed_by_name || '-'}</td>
                <td className="p-3 text-right">${parseFloat(r.opening_amount).toFixed(2)}</td>
                <td className="p-3 text-right">{r.expected_amount ? `$${parseFloat(r.expected_amount).toFixed(2)}` : '-'}</td>
                <td className="p-3 text-right">{r.actual_amount ? `$${parseFloat(r.actual_amount).toFixed(2)}` : '-'}</td>
                <td className={`p-3 text-right font-medium ${
                  r.difference && parseFloat(r.difference) < 0 ? 'text-red-600' :
                  r.difference && parseFloat(r.difference) > 0 ? 'text-emerald-600' : ''
                }`}>
                  {r.difference ? `$${parseFloat(r.difference).toFixed(2)}` : '-'}
                </td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    r.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {r.status === 'open' ? 'Abierta' : 'Cerrada'}
                  </span>
                </td>
              </tr>
            ))}
            {(!data || data.length === 0) && (
              <tr><td colSpan={9} className="p-8 text-center text-gray-400">Sin historial</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
