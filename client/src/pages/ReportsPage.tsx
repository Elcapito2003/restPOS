import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../config/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import dayjs from 'dayjs';
import { PAYMENT_METHODS } from '../config/constants';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

export default function ReportsPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const { data: report, isLoading } = useQuery({
    queryKey: ['reports', 'daily', date],
    queryFn: () => api.get('/reports/daily', { params: { date } }).then(r => r.data),
  });

  if (isLoading) return <div className="flex items-center justify-center h-full">Cargando...</div>;

  const summary = report?.summary;
  const methodData = report?.by_method?.map((m: any) => ({
    name: PAYMENT_METHODS[m.method as keyof typeof PAYMENT_METHODS] || m.method,
    value: parseFloat(m.total),
  })) || [];

  const hourData = report?.by_hour?.map((h: any) => ({
    hour: `${String(h.hour).padStart(2, '0')}:00`,
    ventas: parseFloat(h.total),
    ordenes: parseInt(h.orders),
  })) || [];

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto overflow-auto">
      {/* Date selector */}
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold">Reporte Diario</h2>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-auto" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Ventas Totales</p>
          <p className="text-2xl font-bold text-blue-600">${parseFloat(summary?.total_sales || '0').toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Ordenes</p>
          <p className="text-2xl font-bold">{summary?.closed_orders || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Propinas</p>
          <p className="text-2xl font-bold text-emerald-600">${parseFloat(summary?.total_tips || '0').toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Descuentos</p>
          <p className="text-2xl font-bold text-red-600">${parseFloat(summary?.total_discounts || '0').toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales by hour */}
        <div className="card p-4">
          <h3 className="font-bold mb-4">Ventas por Hora</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={hourData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v: any) => `$${parseFloat(v).toFixed(2)}`} />
              <Bar dataKey="ventas" fill="#3B82F6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment methods */}
        <div className="card p-4">
          <h3 className="font-bold mb-4">Métodos de Pago</h3>
          {methodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={methodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.name}: $${e.value.toFixed(0)}`}>
                  {methodData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `$${parseFloat(v).toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-400 py-10">Sin datos</p>
          )}
        </div>
      </div>

      {/* Top products & Waiters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="p-4 border-b"><h3 className="font-bold">Productos Más Vendidos</h3></div>
          <div className="divide-y">
            {report?.top_products?.map((p: any, i: number) => (
              <div key={i} className="p-3 flex justify-between">
                <span className="text-sm">{p.product_name} <span className="text-gray-400">x{p.qty}</span></span>
                <span className="text-sm font-medium">${parseFloat(p.revenue).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="p-4 border-b"><h3 className="font-bold">Ventas por Mesero</h3></div>
          <div className="divide-y">
            {report?.by_waiter?.map((w: any, i: number) => (
              <div key={i} className="p-3 flex justify-between">
                <span className="text-sm">{w.display_name} <span className="text-gray-400">({w.orders} ord.)</span></span>
                <span className="text-sm font-medium">${parseFloat(w.total).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
