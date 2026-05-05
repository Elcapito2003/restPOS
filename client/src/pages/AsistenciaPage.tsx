import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../config/api';
import { Clock, Download, Filter, Lock, ArrowDown, ArrowUp } from 'lucide-react';

type PunchRow = {
  id: number;
  user_id: number;
  display_name: string;
  role: string;
  avatar_color: string;
  type: 'in' | 'out';
  recorded_at: string;
  match_score: number | null;
};

type SummaryRow = {
  user_id: number;
  display_name: string;
  role: string;
  avatar_color: string;
  punches_in: number;
  punches_out: number;
  hours_worked: string;
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}
function weekAgoDate() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export default function AsistenciaPage() {
  const [from, setFrom] = useState(weekAgoDate());
  const [to, setTo] = useState(todayDate());
  const [userFilter, setUserFilter] = useState<number | ''>('');
  const [tab, setTab] = useState<'log' | 'resumen'>('resumen');

  const fromIso = `${from}T00:00:00`;
  const toIso = `${to}T23:59:59`;

  const { data: rows, isLoading: loadingRows } = useQuery<PunchRow[]>({
    queryKey: ['attendance', from, to, userFilter],
    queryFn: () => api.get('/attendance', {
      params: { from: fromIso, to: toIso, user_id: userFilter || undefined, limit: 1000 },
    }).then(r => r.data),
  });

  const { data: summary, isLoading: loadingSummary } = useQuery<SummaryRow[]>({
    queryKey: ['attendance-summary', from, to],
    queryFn: () => api.get('/attendance/summary', {
      params: { from: fromIso, to: toIso },
    }).then(r => r.data),
  });

  function downloadCsv() {
    const params = new URLSearchParams();
    params.set('from', fromIso);
    params.set('to', toIso);
    if (userFilter) params.set('user_id', String(userFilter));
    const token = localStorage.getItem('token');
    fetch(`${api.defaults.baseURL}/attendance/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `asistencia-${from}-a-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Clock className="text-blue-600" size={32} />
        <h1 className="text-2xl font-bold">Asistencia</h1>
      </div>
      <p className="text-gray-600 mb-4 flex items-center gap-2">
        <Lock size={14} className="text-amber-600" />
        Registros append-only — no se pueden editar ni eliminar.
      </p>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow border p-4 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Desde</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Hasta</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2" />
        </div>
        <button
          onClick={downloadCsv}
          className="ml-auto px-4 py-2 bg-emerald-600 text-white rounded-lg flex items-center gap-2 hover:bg-emerald-700"
        >
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('resumen')} className={`px-4 py-2 rounded-lg ${tab === 'resumen' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
          Resumen por empleado
        </button>
        <button onClick={() => setTab('log')} className={`px-4 py-2 rounded-lg ${tab === 'log' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
          Detalle (log)
        </button>
      </div>

      {/* Resumen */}
      {tab === 'resumen' && (
        <div className="bg-white rounded-xl shadow border overflow-hidden">
          {loadingSummary ? (
            <div className="p-8 text-center text-gray-400">Cargando...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3">Empleado</th>
                  <th className="text-right px-4 py-3">Entradas</th>
                  <th className="text-right px-4 py-3">Salidas</th>
                  <th className="text-right px-4 py-3">Horas trabajadas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary?.map(s => (
                  <tr key={s.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: s.avatar_color }}>
                        {s.display_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold">{s.display_name}</div>
                        <div className="text-xs text-gray-500">{s.role}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.punches_in}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.punches_out}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-blue-600">
                      {Number(s.hours_worked || 0).toFixed(2)} h
                    </td>
                  </tr>
                ))}
                {(!summary || summary.length === 0) && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Sin datos en el rango</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Log detallado */}
      {tab === 'log' && (
        <div className="bg-white rounded-xl shadow border overflow-hidden">
          {loadingRows ? (
            <div className="p-8 text-center text-gray-400">Cargando...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3">Fecha y hora</th>
                  <th className="text-left px-4 py-3">Empleado</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-right px-4 py-3">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows?.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 tabular-nums">
                      {new Date(r.recorded_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: r.avatar_color }}>
                        {r.display_name.charAt(0)}
                      </div>
                      {r.display_name}
                    </td>
                    <td className="px-4 py-3">
                      {r.type === 'in' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                          <ArrowDown size={12} /> Entrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                          <ArrowUp size={12} /> Salida
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{r.match_score ?? '—'}</td>
                  </tr>
                ))}
                {(!rows || rows.length === 0) && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Sin marcas en el rango</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
