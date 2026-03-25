import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../config/api';
import dayjs from 'dayjs';

export default function ReportCategoryPage() {
  const today = dayjs().format('YYYY-MM-DD');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'category', startDate, endDate],
    queryFn: () => api.get('/reports/category', { params: { start: startDate, end: endDate } }).then(r => r.data),
  });

  const totalRevenue = data?.reduce((s: number, c: any) => s + parseFloat(c.revenue), 0) || 0;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Ventas por Categoría / Grupo</h2>
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
                <th className="text-left p-3">Grupo</th>
                <th className="text-left p-3">Categoría</th>
                <th className="text-center p-3">Cantidad</th>
                <th className="text-center p-3">Ordenes</th>
                <th className="text-right p-3">Ingresos</th>
                <th className="text-right p-3">%</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.map((c: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="p-3 text-gray-500">{c.parent_name || '-'}</td>
                  <td className="p-3 font-medium">
                    <span className="inline-flex items-center gap-2">
                      {c.color && <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: c.color }} />}
                      {c.category_name}
                    </span>
                  </td>
                  <td className="p-3 text-center">{c.qty}</td>
                  <td className="p-3 text-center">{c.orders}</td>
                  <td className="p-3 text-right font-medium">${parseFloat(c.revenue).toFixed(2)}</td>
                  <td className="p-3 text-right text-gray-500">
                    {totalRevenue > 0 ? ((parseFloat(c.revenue) / totalRevenue) * 100).toFixed(1) : '0'}%
                  </td>
                </tr>
              ))}
              {data?.length > 0 && (
                <tr className="bg-gray-50 font-bold">
                  <td className="p-3" colSpan={4}>TOTAL</td>
                  <td className="p-3 text-right">${totalRevenue.toFixed(2)}</td>
                  <td className="p-3 text-right">100%</td>
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
