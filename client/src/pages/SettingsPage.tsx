import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import { Save, Printer, Building, Search, Loader2, Check, Hash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  });

  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) setValues(settings);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.put('/settings', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('Configuración guardada'); },
  });

  const testPrinter = async (target: string) => {
    try {
      // Use local Electron printing if available
      if ((window as any).electronPrint) {
        const address = values[`printer_${target}_ip`] || '';
        const res = await (window as any).electronPrint.testPrinter({ target, address });
        if (res.status === 'ok') toast.success(`Impresora ${target} OK`);
        else if (res.status === 'no_printer') toast('No configurada', { icon: '⚠️' });
        else toast.error(`Error: ${res.message}`);
        return;
      }
      const res = await api.post(`/printer/test/${target}`);
      if (res.data.status === 'ok') toast.success(`Impresora ${target} OK`);
      else if (res.data.status === 'no_printer') toast('No configurada', { icon: '⚠️' });
      else toast.error(`Error: ${res.data.message}`);
    } catch {
      toast.error('Error de conexión');
    }
  };

  const setValue = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  // ─── Printer scanner state ───
  const canScan = !!(window as any).electronPrint?.scanPrinters;
  const [scanResults, setScanResults] = useState<{ id: number; type: 'network' | 'local'; address: string; name: string }[]>([]);
  const [scanning, setScanning] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [identified, setIdentified] = useState(false);
  const [identifyStatus, setIdentifyStatus] = useState<Record<number, boolean>>({});
  const [scanAssign, setScanAssign] = useState<Record<string, string>>({ kitchen: '', bar: '', cashier: '' });

  const handleScan = async () => {
    if (!canScan) {
      toast.error('El escaneo automático requiere la app de escritorio RestPOS');
      return;
    }
    setScanning(true);
    setScanResults([]);
    setIdentified(false);
    setIdentifyStatus({});
    setScanAssign({ kitchen: '', bar: '', cashier: '' });
    try {
      const res = await (window as any).electronPrint.scanPrinters();
      const list: typeof scanResults = [];
      let id = 1;
      for (const ip of (res.network || [])) {
        list.push({ id: id++, type: 'network', address: `tcp://${ip}:9100`, name: ip });
      }
      for (const p of (res.local || [])) {
        list.push({ id: id++, type: 'local', address: `printer:${p.Name}`, name: p.Name });
      }
      setScanResults(list);
      if (list.length === 0) toast('No se encontraron impresoras', { icon: '⚠️' });
      else toast.success(`${list.length} impresora(s) detectada(s)`);
    } catch {
      toast.error('Error al escanear');
    } finally {
      setScanning(false);
    }
  };

  const handleIdentify = async () => {
    setIdentifying(true);
    const status: Record<number, boolean> = {};
    for (const p of scanResults) {
      try {
        await (window as any).electronPrint.identifyPrinter({ address: p.address, number: p.id });
        status[p.id] = true;
      } catch {
        status[p.id] = false;
      }
    }
    setIdentifyStatus(status);
    setIdentified(true);
    setIdentifying(false);
    const ok = Object.values(status).filter(Boolean).length;
    const fail = Object.values(status).filter(v => !v).length;
    if (fail > 0) toast.error(`${fail} impresora(s) no respondieron`);
    else toast.success(`Número impreso en ${ok} impresora(s)`);
  };

  const assignPrinter = (role: string, printerId: string) => {
    setScanAssign(prev => ({ ...prev, [role]: printerId }));
    if (!printerId) {
      setValue(`printer_${role}_ip`, '');
    } else {
      const printer = scanResults.find(p => p.id === parseInt(printerId));
      if (printer) setValue(`printer_${role}_ip`, printer.address);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-full">Cargando...</div>;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-bold">Configuración</h2>

      {/* Restaurant info */}
      <div className="card p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Building size={18} /> Restaurante</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nombre</label>
            <input type="text" value={values.restaurant_name || ''} onChange={e => setValue('restaurant_name', e.target.value)} className="input mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Dirección</label>
            <input type="text" value={values.restaurant_address || ''} onChange={e => setValue('restaurant_address', e.target.value)} className="input mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Teléfono</label>
              <input type="text" value={values.restaurant_phone || ''} onChange={e => setValue('restaurant_phone', e.target.value)} className="input mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">RFC</label>
              <input type="text" value={values.restaurant_rfc || ''} onChange={e => setValue('restaurant_rfc', e.target.value)} className="input mt-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Printers */}
      <div className="card p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Printer size={18} /> Impresoras</h3>

        {/* ─── Auto-detect section ─── */}
        <div className="mb-4 pb-4 border-b border-gray-200 space-y-3">
          {!canScan && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              El escaneo automático de red funciona desde la app de escritorio RestPOS.
              Desde el navegador puedes configurar las impresoras manualmente abajo.
            </p>
          )}
          <button onClick={handleScan} disabled={scanning} className="btn-outline w-full gap-2">
            {scanning
              ? <><Loader2 size={18} className="animate-spin" /> Buscando impresoras...</>
              : <><Search size={18} /> Detectar Impresoras Automáticamente</>}
          </button>

            {/* Scan results list */}
            {scanResults.length > 0 && (
              <>
                <p className="text-sm font-medium text-gray-700">{scanResults.length} impresora(s) detectada(s):</p>
                <div className="space-y-1.5">
                  {scanResults.map(p => (
                    <div key={p.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-bold text-blue-600 w-6">#{p.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.type === 'network' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {p.type === 'network' ? 'Red' : 'Local'}
                      </span>
                      <span className="text-gray-700 truncate">{p.name}</span>
                      {identified && (
                        identifyStatus[p.id]
                          ? <Check size={14} className="text-green-500 ml-auto shrink-0" />
                          : <span className="text-red-500 text-xs ml-auto shrink-0">Sin respuesta</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Identify button */}
                <button onClick={handleIdentify} disabled={identifying} className="btn-outline w-full gap-2">
                  {identifying
                    ? <><Loader2 size={18} className="animate-spin" /> Imprimiendo números...</>
                    : <><Hash size={18} /> {identified ? 'Reimprimir Números' : 'Imprimir Número en Cada Impresora'}</>}
                </button>

                {/* Assignment dropdowns */}
                {identified && (
                  <>
                    <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                      <strong>Revisa cada impresora</strong> — cada una imprimió un número grande.
                      Selecciona qué número corresponde a cada destino:
                    </div>
                    <div className="space-y-2">
                      {([
                        { role: 'kitchen', label: 'Cocina' },
                        { role: 'bar', label: 'Bar' },
                        { role: 'cashier', label: 'Caja / Recibos' },
                      ] as const).map(r => (
                        <div key={r.role} className="flex items-center gap-2">
                          <label className="text-sm font-medium w-28 shrink-0">{r.label}:</label>
                          <select
                            className="input flex-1"
                            value={scanAssign[r.role]}
                            onChange={e => assignPrinter(r.role, e.target.value)}
                          >
                            <option value="">— No asignar —</option>
                            {scanResults.map(p => (
                              <option key={p.id} value={p.id}>
                                #{p.id} — {p.name} ({p.type === 'network' ? 'Red' : 'Local'})
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
        </div>

        {/* ─── Manual config (always visible) ─── */}
        <p className="text-xs text-gray-500 mb-3">
          O configura manualmente: USB/COM: COM3 &nbsp;|&nbsp; Red: tcp://192.168.1.100:9100 &nbsp;|&nbsp; Nombre Windows: printer:POS-80
        </p>
        <div className="space-y-3">
          {[
            { key: 'printer_kitchen_ip', label: 'Cocina', target: 'kitchen' },
            { key: 'printer_bar_ip', label: 'Bar', target: 'bar' },
            { key: 'printer_cashier_ip', label: 'Caja/Recibos', target: 'cashier' },
          ].map(p => (
            <div key={p.key} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium">{p.label}</label>
                <input type="text" value={values[p.key] || ''} onChange={e => setValue(p.key, e.target.value)} className="input mt-1" placeholder="COM3 / tcp://IP:9100 / printer:Nombre" />
              </div>
              <button onClick={() => testPrinter(p.target)} className="btn-outline text-sm shrink-0">Test</button>
            </div>
          ))}
        </div>
      </div>

      {/* Editor de pisos */}
      <div className="card p-4">
        <h3 className="font-bold mb-3">Mapa de Mesas</h3>
        <button onClick={() => navigate('/floor-editor')} className="btn-secondary w-full">Abrir Editor de Pisos</button>
      </div>

      <button onClick={() => saveMutation.mutate(values)} className="btn-primary w-full gap-2">
        <Save size={18} /> Guardar Configuración
      </button>
    </div>
  );
}
