import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../config/api';
import dayjs from 'dayjs';

export default function ReportCancellationsPage() {
  const today = dayjs().format('YYYY-MM-DD');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'cancellations', startDate, endDate],
    queryFn: () => api.get('/reports/cancellations', { params: { start: startDate, end: endDate } }).then(r => r.data),
  });

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Cancelaciones</h2>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Desde:</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input w-auto" />
        <label className="text-sm font-medium">Hasta:</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input w-auto" />
      </div>

      {isLoading ? <p className="text-center text-gray-400 py-8">Cargando...</p> : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Ordenes Canceladas</p>
              <p className="text-2xl font-bold text-red-600">{data?.summary?.cancelled_orders || 0}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Cancelado (Ordenes)</p>
              <p className="text-2xl font-bold text-red-600">${parseFloat(data?.summary?.cancelled_total || '0').toFixed(2)}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Items Cancelados</p>
              <p className="text-2xl font-bold text-amber-600">{data?.summary?.cancelled_items || 0}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total Items Cancelados</p>
              <p className="text-2xl font-bold text-amber-600">${parseFloat(data?.summary?.cancelled_items_total || '0').toFixed(2)}</p>
            </div>
          </div>

          {/* Cancelled orders */}
          <div className="card overflow-hidden">
            <div className="p-3 border-b bg-gray-50 font-medium text-sm">Ordenes Canceladas Completas</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3"># Orden</th>
                  <th className="text-left p-3">Mesa</th>
                  <th className="text-left p-3">Mesero</th>
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-left p-3">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.cancelled_orders?.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono">{o.order_number}</td>
                    <td className="p-3">{o.table_label || '-'}</td>
                    <td className="p-3">{o.waiter_name || '-'}</td>
                    <td className="p-3 text-gray-500">{dayjs(o.created_at).format('DD/MM HH:mm')}</td>
                    <td className="p-3 text-right font-medium text-red-600">${parseFloat(o.total || '0').toFixed(2)}</td>
                    <td className="p-3 text-gray-500 text-xs">{o.notes || '-'}</td>
                  </tr>
                ))}
                {(!data?.cancelled_orders || data.cancelled_orders.length === 0) && (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">Sin ordenes canceladas</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cancelled items */}
          <div className="card overflow-hidden">
            <div className="p-3 border-b bg-gray-50 font-medium text-sm">Items Cancelados Individualmente</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">Orden</th>
                  <th className="text-left p-3">Producto</th>
                  <th className="text-center p-3">Cant.</th>
                  <th className="text-right p-3">Precio</th>
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-left p-3">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.cancelled_items?.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="p-3 font-mono">{item.order_number}</td>
                    <td className="p-3 font-medium">{item.product_name}</td>
                    <td className="p-3 text-center">{item.quantity}</td>
                    <td className="p-3 text-right">${parseFloat(item.unit_price).toFixed(2)}</td>
                    <td className="p-3 text-gray-500">{dayjs(item.created_at).format('DD/MM HH:mm')}</td>
                    <td className="p-3 text-gray-500 text-xs">{item.notes || '-'}</td>
                  </tr>
                ))}
                {(!data?.cancelled_items || data.cancelled_items.length === 0) && (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">Sin items cancelados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
