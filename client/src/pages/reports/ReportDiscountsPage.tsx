import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../config/api';
import dayjs from 'dayjs';

export default function ReportDiscountsPage() {
  const today = dayjs().format('YYYY-MM-DD');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'discounts', startDate, endDate],
    queryFn: () => api.get('/reports/discounts', { params: { start: startDate, end: endDate } }).then(r => r.data),
  });

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Descuentos y Cortesías</h2>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Desde:</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input w-auto" />
        <label className="text-sm font-medium">Hasta:</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input w-auto" />
      </div>

      {isLoading ? <p className="text-center text-gray-400 py-8">Cargando...</p> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Ordenes con Descuento</p>
              <p className="text-2xl font-bold">{data?.summary?.total_with_discount || 0}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Descuentos</p>
              <p className="text-2xl font-bold text-red-600">${parseFloat(data?.summary?.total_discounts || '0').toFixed(2)}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Promedio Descuento</p>
              <p className="text-2xl font-bold text-amber-600">${parseFloat(data?.summary?.avg_discount || '0').toFixed(2)}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Por Porcentaje / Monto</p>
              <p className="text-2xl font-bold">{data?.summary?.percent_count || 0} / {data?.summary?.amount_count || 0}</p>
            </div>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3"># Orden</th>
                  <th className="text-left p-3">Mesa</th>
                  <th className="text-left p-3">Mesero</th>
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-right p-3">Subtotal</th>
                  <th className="text-right p-3">Descuento</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-left p-3">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.orders?.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono">{o.order_number}</td>
                    <td className="p-3">{o.table_label || '-'}</td>
                    <td className="p-3">{o.waiter_name || '-'}</td>
                    <td className="p-3 text-gray-500">{dayjs(o.created_at).format('DD/MM HH:mm')}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">
                        {o.discount_type === 'percent' ? `${o.discount_value}%` : `$${parseFloat(o.discount_value).toFixed(2)}`}
                      </span>
                    </td>
                    <td className="p-3 text-right">${parseFloat(o.subtotal).toFixed(2)}</td>
                    <td className="p-3 text-right text-red-600 font-medium">-${parseFloat(o.discount_amount).toFixed(2)}</td>
                    <td className="p-3 text-right font-medium">${parseFloat(o.total).toFixed(2)}</td>
                    <td className="p-3 text-gray-500 text-xs">{o.notes || '-'}</td>
                  </tr>
                ))}
                {(!data?.orders || data.orders.length === 0) && (
                  <tr><td colSpan={9} className="p-8 text-center text-gray-400">Sin descuentos aplicados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
