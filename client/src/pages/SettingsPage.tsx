import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import { Save, Printer, Building } from 'lucide-react';
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
        <p className="text-xs text-gray-500 mb-3">
          USB/COM: COM3 &nbsp;|&nbsp; Red: tcp://192.168.1.100:9100 &nbsp;|&nbsp; Nombre Windows: printer:POS-80
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
