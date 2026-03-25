import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../config/api';
import dayjs from 'dayjs';

export default function ReportProductPage() {
  const today = dayjs().format('YYYY-MM-DD');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'product', startDate, endDate],
    queryFn: () => api.get('/reports/product', { params: { start: startDate, end: endDate } }).then(r => r.data),
  });

  const totalRevenue = data?.reduce((s: number, p: any) => s + parseFloat(p.revenue), 0) || 0;
  const totalQty = data?.reduce((s: number, p: any) => s + parseInt(p.qty), 0) || 0;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Ventas por Producto</h2>
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
                <th className="text-left p-3">#</th>
                <th className="text-left p-3">Producto</th>
                <th className="text-left p-3">Categoría</th>
                <th className="text-center p-3">Cantidad</th>
                <th className="text-center p-3">Ordenes</th>
                <th className="text-right p-3">Ingresos</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.map((p: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="p-3 text-gray-400">{i + 1}</td>
                  <td className="p-3 font-medium">{p.product_name}</td>
                  <td className="p-3 text-gray-500">{p.category_name || '-'}</td>
                  <td className="p-3 text-center">{p.qty}</td>
                  <td className="p-3 text-center">{p.orders}</td>
                  <td className="p-3 text-right font-medium">${parseFloat(p.revenue).toFixed(2)}</td>
                </tr>
              ))}
              {data?.length > 0 && (
                <tr className="bg-gray-50 font-bold">
                  <td className="p-3" colSpan={3}>TOTAL</td>
                  <td className="p-3 text-center">{totalQty}</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-right">${totalRevenue.toFixed(2)}</td>
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
