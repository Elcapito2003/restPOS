import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../config/api';
import dayjs from 'dayjs';
import { PAYMENT_METHODS } from '../config/constants';

type Tab = 'abiertas' | 'pagadas' | 'canceladas';

export default function ConsultasPage({ defaultTab }: { defaultTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(defaultTab || 'abiertas');
  const today = dayjs().format('YYYY-MM-DD');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data: openChecks } = useQuery({
    queryKey: ['consultas', 'open-checks'],
    queryFn: () => api.get('/reports/open-checks').then(r => r.data),
    enabled: tab === 'abiertas',
    refetchInterval: 15000,
  });

  const { data: paidChecks } = useQuery({
    queryKey: ['consultas', 'paid-checks', startDate, endDate],
    queryFn: () => api.get('/reports/paid-checks', { params: { start: startDate, end: endDate } }).then(r => r.data),
    enabled: tab === 'pagadas',
  });

  const { data: cancelledChecks } = useQuery({
    queryKey: ['consultas', 'cancelled-checks', startDate, endDate],
    queryFn: () => api.get('/reports/cancelled-checks', { params: { start: startDate, end: endDate } }).then(r => r.data),
    enabled: tab === 'canceladas',
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'abiertas', label: 'Cuentas Abiertas' },
    { key: 'pagadas', label: 'Cuentas Pagadas' },
    { key: 'canceladas', label: 'Cuentas Canceladas' },
  ];

  const renderChecks = (checks: any[] | undefined, showPayment = false) => {
    if (!checks || checks.length === 0) {
      return <p className="p-8 text-center text-gray-400">Sin resultados</p>;
    }
    return (
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left p-3"># Orden</th>
            <th className="text-left p-3">Mesa</th>
            <th className="text-left p-3">Mesero</th>
            <th className="text-left p-3">Fecha/Hora</th>
            <th className="text-center p-3">Items</th>
            {showPayment && <th className="text-left p-3">Pago</th>}
            <th className="text-right p-3">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {checks.map((c: any) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="p-3 font-mono font-medium">{c.order_number}</td>
              <td className="p-3">{c.table_label || '-'}</td>
              <td className="p-3">{c.waiter_name || '-'}</td>
              <td className="p-3 text-gray-500">{dayjs(c.created_at).format('DD/MM/YY HH:mm')}</td>
              <td className="p-3 text-center">{c.item_count}</td>
              {showPayment && (
                <td className="p-3 text-gray-500">
                  {c.payment_methods?.split(', ').map((m: string) =>
                    PAYMENT_METHODS[m as keyof typeof PAYMENT_METHODS] || m
                  ).join(', ') || '-'}
                </td>
              )}
              <td className="p-3 text-right font-medium">${parseFloat(c.total || '0').toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Consultas</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-200 rounded-lg p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date filter (for pagadas and canceladas) */}
      {tab !== 'abiertas' && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Desde:</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input w-auto" />
          <label className="text-sm font-medium">Hasta:</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input w-auto" />
        </div>
      )}

      {/* Content */}
      <div className="card overflow-hidden">
        {tab === 'abiertas' && (
          <>
            <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
              <span className="font-medium text-sm">Cuentas abiertas actualmente</span>
              <span className="text-sm text-gray-500">{openChecks?.length || 0} cuenta(s)</span>
            </div>
            {renderChecks(openChecks)}
          </>
        )}
        {tab === 'pagadas' && (
          <>
            <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
              <span className="font-medium text-sm">Cuentas pagadas</span>
              <span className="text-sm text-gray-500">{paidChecks?.length || 0} cuenta(s)</span>
            </div>
            {renderChecks(paidChecks, true)}
          </>
        )}
        {tab === 'canceladas' && (
          <>
            <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
              <span className="font-medium text-sm">Cuentas canceladas</span>
              <span className="text-sm text-gray-500">{cancelledChecks?.length || 0} cuenta(s)</span>
            </div>
            {renderChecks(cancelledChecks)}
          </>
        )}
      </div>
    </div>
  );
}
