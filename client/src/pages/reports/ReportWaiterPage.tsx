import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../config/api';
import dayjs from 'dayjs';

export default function ReportWaiterPage() {
  const today = dayjs().format('YYYY-MM-DD');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'waiter', startDate, endDate],
    queryFn: () => api.get('/reports/waiter', { params: { start: startDate, end: endDate } }).then(r => r.data),
  });

  const totalSales = data?.reduce((s: number, w: any) => s + parseFloat(w.total), 0) || 0;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Ventas por Mesero</h2>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Desde:</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input w-auto" />
        <label className="text-sm font-medium">Hasta:</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input w-auto" />
      </div>

      {isLoading ? <p className="text-center text-gray-400 py-8">Cargando...</p> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">Mesero</th>
                <th className="text-center p-3">Ordenes</th>
                <th className="text-right p-3">Subtotal</th>
                <th className="text-right p-3">IVA</th>
                <th className="text-right p-3">Descuentos</th>
                <th className="text-right p-3">Propinas</th>
                <th className="text-right p-3">Total</th>
                <th className="text-right p-3">Promedio</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.map((w: any) => (
                <tr key={w.username} className="hover:bg-gray-50">
                  <td className="p-3 font-medium">{w.display_name}</td>
                  <td className="p-3 text-center">{w.orders}</td>
                  <td className="p-3 text-right">${parseFloat(w.subtotal).toFixed(2)}</td>
                  <td className="p-3 text-right">${parseFloat(w.tax).toFixed(2)}</td>
                  <td className="p-3 text-right text-red-600">${parseFloat(w.discounts).toFixed(2)}</td>
                  <td className="p-3 text-right">${parseFloat(w.tips).toFixed(2)}</td>
                  <td className="p-3 text-right font-bold">${parseFloat(w.total).toFixed(2)}</td>
                  <td className="p-3 text-right text-gray-500">${parseFloat(w.avg_ticket).toFixed(2)}</td>
                </tr>
              ))}
              {data?.length > 0 && (
                <tr className="bg-gray-50 font-bold">
                  <td className="p-3" colSpan={6}>TOTAL</td>
                  <td className="p-3 text-right">${totalSales.toFixed(2)}</td>
                  <td className="p-3"></td>
                </tr>
              )}
            </tbody>
          </table>
          {(!data || data.length === 0) && <p className="p-8 text-center text-gray-400">Sin datos</p>}
        </div>
      )}
    </div>
  );
}
