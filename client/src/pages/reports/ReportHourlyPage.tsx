import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../config/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';

export default function ReportHourlyPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'hourly', date],
    queryFn: () => api.get('/reports/hourly', { params: { date } }).then(r => r.data),
  });

  const chartData = data?.map((h: any) => ({
    hour: `${String(h.hour).padStart(2, '0')}:00`,
    ventas: parseFloat(h.total),
    ordenes: parseInt(h.orders),
    promedio: parseFloat(h.avg_ticket),
  })) || [];

  const totalSales = chartData.reduce((s: number, h: any) => s + h.ventas, 0);
  const totalOrders = chartData.reduce((s: number, h: any) => s + h.ordenes, 0);

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Ventas por Hora</h2>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Fecha:</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-auto" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Ventas del Día</p>
          <p className="text-2xl font-bold text-blue-600">${totalSales.toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Ordenes del Día</p>
          <p className="text-2xl font-bold">{totalOrders}</p>
        </div>
      </div>

      {isLoading ? <p className="text-center text-gray-400 py-8">Cargando...</p> : (
        <>
          <div className="card p-4">
            <h3 className="font-bold mb-4">Gráfica de Ventas por Hora</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" fontSize={12} />
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
                  <th className="text-left p-3">Hora</th>
                  <th className="text-center p-3">Ordenes</th>
                  <th className="text-right p-3">Ventas</th>
                  <th className="text-right p-3">Ticket Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {chartData.map((h: any) => (
                  <tr key={h.hour} className="hover:bg-gray-50">
                    <td className="p-3 font-medium">{h.hour}</td>
                    <td className="p-3 text-center">{h.ordenes}</td>
                    <td className="p-3 text-right">${h.ventas.toFixed(2)}</td>
                    <td className="p-3 text-right text-gray-500">${h.promedio.toFixed(2)}</td>
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
