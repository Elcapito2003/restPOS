import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../config/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';

export default function ReportPeriodPage() {
  const [startDate, setStartDate] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'period', startDate, endDate],
    queryFn: () => api.get('/reports/period', { params: { start: startDate, end: endDate } }).then(r => r.data),
  });

  const chartData = data?.map((d: any) => ({
    date: dayjs(d.date).format('DD/MM'),
    ventas: parseFloat(d.total),
    ordenes: parseInt(d.orders),
  })) || [];

  const totalSales = chartData.reduce((s: number, d: any) => s + d.ventas, 0);
  const totalOrders = chartData.reduce((s: number, d: any) => s + d.ordenes, 0);

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Ventas por Período</h2>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Desde:</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input w-auto" />
        <label className="text-sm font-medium">Hasta:</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input w-auto" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Ventas Totales</p>
          <p className="text-2xl font-bold text-blue-600">${totalSales.toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Ordenes Totales</p>
          <p className="text-2xl font-bold">{totalOrders}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Promedio Diario</p>
          <p className="text-2xl font-bold text-emerald-600">
            ${chartData.length > 0 ? (totalSales / chartData.length).toFixed(2) : '0.00'}
          </p>
        </div>
      </div>

      {isLoading ? <p className="text-center text-gray-400 py-8">Cargando...</p> : (
        <>
          <div className="card p-4">
            <h3 className="font-bold mb-4">Ventas Diarias</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: any) => `$${parseFloat(v).toFixed(2)}`} />
                <Bar dataKey="ventas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-center p-3">Ordenes</th>
                  <th className="text-right p-3">Ventas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.map((d: any) => (
                  <tr key={d.date} className="hover:bg-gray-50">
                    <td className="p-3 font-medium">{dayjs(d.date).format('DD/MM/YYYY')}</td>
                    <td className="p-3 text-center">{d.orders}</td>
                    <td className="p-3 text-right font-medium">${parseFloat(d.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
