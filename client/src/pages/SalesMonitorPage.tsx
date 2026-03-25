import { useQuery } from '@tanstack/react-query';
import api from '../config/api';
import dayjs from 'dayjs';
import { PAYMENT_METHODS } from '../config/constants';

export default function SalesMonitorPage() {
  const { data: report } = useQuery({
    queryKey: ['reports', 'daily', 'today'],
    queryFn: () => api.get('/reports/daily').then(r => r.data),
    refetchInterval: 10000,
  });

  const { data: openChecks } = useQuery({
    queryKey: ['consultas', 'open-checks'],
    queryFn: () => api.get('/reports/open-checks').then(r => r.data),
    refetchInterval: 10000,
  });

  const summary = report?.summary;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Monitor de Ventas</h2>
        <span className="text-sm text-gray-500">Actualización automática cada 10s</span>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">Ventas del Día</p>
          <p className="text-2xl font-bold text-blue-600">${parseFloat(summary?.total_sales || '0').toFixed(2)}</p>
        </div>
        <div className="card p-4 border-l-4 border-emerald-500">
          <p className="text-sm text-gray-500">Ordenes Cerradas</p>
          <p className="text-2xl font-bold text-emerald-600">{summary?.closed_orders || 0}</p>
        </div>
        <div className="card p-4 border-l-4 border-amber-500">
          <p className="text-sm text-gray-500">Cuentas Abiertas</p>
          <p className="text-2xl font-bold text-amber-600">{openChecks?.length || 0}</p>
        </div>
        <div className="card p-4 border-l-4 border-red-500">
          <p className="text-sm text-gray-500">Cancelaciones</p>
          <p className="text-2xl font-bold text-red-600">{summary?.cancelled_orders || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By method */}
        <div className="card p-4">
          <h3 className="font-bold mb-3">Ventas por Forma de Pago</h3>
          <div className="space-y-2">
            {report?.by_method?.map((m: any) => (
              <div key={m.method} className="flex justify-between text-sm">
                <span>{PAYMENT_METHODS[m.method as keyof typeof PAYMENT_METHODS] || m.method} ({m.count})</span>
                <span className="font-medium">${parseFloat(m.total).toFixed(2)}</span>
              </div>
            ))}
            {(!report?.by_method || report.by_method.length === 0) && (
              <p className="text-gray-400 text-sm">Sin ventas</p>
            )}
          </div>
        </div>

        {/* By waiter */}
        <div className="card p-4">
          <h3 className="font-bold mb-3">Ventas por Mesero</h3>
          <div className="space-y-2">
            {report?.by_waiter?.map((w: any) => (
              <div key={w.display_name} className="flex justify-between text-sm">
                <span>{w.display_name} ({w.orders} ord.)</span>
                <span className="font-medium">${parseFloat(w.total).toFixed(2)}</span>
              </div>
            ))}
            {(!report?.by_waiter || report.by_waiter.length === 0) && (
              <p className="text-gray-400 text-sm">Sin datos</p>
            )}
          </div>
        </div>
      </div>

      {/* Open checks */}
      {openChecks && openChecks.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-3 border-b bg-amber-50"><h3 className="font-bold text-amber-800">Cuentas Abiertas ({openChecks.length})</h3></div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">Mesa</th>
                <th className="text-left p-3">Mesero</th>
                <th className="text-left p-3">Apertura</th>
                <th className="text-center p-3">Items</th>
                <th className="text-right p-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {openChecks.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="p-3 font-medium">{c.table_label || '-'}</td>
                  <td className="p-3">{c.waiter_name || '-'}</td>
                  <td className="p-3 text-gray-500">{dayjs(c.created_at).format('HH:mm')}</td>
                  <td className="p-3 text-center">{c.item_count}</td>
                  <td className="p-3 text-right font-medium">${parseFloat(c.total || '0').toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top products */}
      {report?.top_products?.length > 0 && (
        <div className="card p-4">
          <h3 className="font-bold mb-3">Productos Más Vendidos Hoy</h3>
          <div className="space-y-2">
            {report.top_products.slice(0, 10).map((p: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{p.product_name} <span className="text-gray-400">x{p.qty}</span></span>
                <span className="font-medium">${parseFloat(p.revenue).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
