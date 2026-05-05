import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import { Fingerprint, Trash2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

type EnrollmentRow = {
  id: number;
  display_name: string;
  role: string;
  avatar_color: string;
  is_active: boolean;
  has_fingerprint: boolean;
  fingerprint_enrolled_at: string | null;
};

declare global {
  interface Window {
    fingerprint?: {
      available: () => Promise<boolean>;
      deviceInfo: () => Promise<{ available: boolean; count?: number; error?: string }>;
      capture: (timeoutMs?: number) => Promise<{ ok: boolean; template?: string; error?: string }>;
      merge: (t1: string, t2: string, t3: string) => Promise<{ ok: boolean; template?: string; error?: string }>;
      identify: (templates: any[], captured: string) => Promise<any>;
      close: () => Promise<{ ok: boolean }>;
    };
  }
}

export default function HuellasPage() {
  const qc = useQueryClient();
  const [enrolling, setEnrolling] = useState<number | null>(null);
  const [step, setStep] = useState<'idle' | 'capture1' | 'capture2' | 'capture3' | 'merging'>('idle');
  const [samples, setSamples] = useState<string[]>([]);
  const [deviceOk, setDeviceOk] = useState<boolean | null>(null);

  const isElectron = !!window.fingerprint;

  const { data: roster, isLoading } = useQuery<EnrollmentRow[]>({
    queryKey: ['enrollment-status'],
    queryFn: () => api.get('/users/enrollment-status').then(r => r.data),
  });

  useEffect(() => {
    if (!isElectron) return;
    window.fingerprint!.deviceInfo().then(info => {
      setDeviceOk(info.available && (info.count || 0) > 0);
    });
  }, [isElectron]);

  const saveMutation = useMutation({
    mutationFn: ({ id, template }: { id: number; template: string }) =>
      api.put(`/users/${id}/fingerprint`, { template }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollment-status'] });
      toast.success('Huella guardada');
      setEnrolling(null);
      setStep('idle');
      setSamples([]);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al guardar'),
  });

  const clearMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}/fingerprint`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollment-status'] });
      toast.success('Huella eliminada');
    },
  });

  async function captureSample(): Promise<string | null> {
    const r = await window.fingerprint!.capture(15000);
    if (!r.ok) {
      toast.error(r.error || 'No se capturó la huella');
      return null;
    }
    return r.template || null;
  }

  async function startEnroll(userId: number) {
    if (!isElectron) {
      toast.error('El enrolamiento sólo funciona en la app de escritorio');
      return;
    }
    setEnrolling(userId);
    setSamples([]);
    setStep('capture1');
    const t1 = await captureSample();
    if (!t1) { setStep('idle'); setEnrolling(null); return; }
    setSamples([t1]);
    setStep('capture2');
    await new Promise(r => setTimeout(r, 800)); // Espera para que el usuario suelte el dedo
    const t2 = await captureSample();
    if (!t2) { setStep('idle'); setEnrolling(null); return; }
    setSamples([t1, t2]);
    setStep('capture3');
    await new Promise(r => setTimeout(r, 800));
    const t3 = await captureSample();
    if (!t3) { setStep('idle'); setEnrolling(null); return; }
    setStep('merging');
    const merged = await window.fingerprint!.merge(t1, t2, t3);
    if (!merged.ok || !merged.template) {
      toast.error(merged.error || 'Las 3 muestras no coincidieron. Vuelve a intentar.');
      setStep('idle'); setEnrolling(null); setSamples([]);
      return;
    }
    saveMutation.mutate({ id: userId, template: merged.template });
  }

  function cancel() {
    setEnrolling(null);
    setStep('idle');
    setSamples([]);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Fingerprint className="text-blue-600" size={32} />
        <h1 className="text-2xl font-bold">Enrolamiento de huellas</h1>
      </div>
      <p className="text-gray-600 mb-6">Cada empleado debe poner su dedo 3 veces para crear una huella maestra que el reloj checador podrá identificar.</p>

      {!isElectron && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm text-amber-800">
          ⚠️ El enrolamiento sólo funciona en la <b>app de escritorio</b> RestPOS con el lector ZK9500 conectado por USB.
        </div>
      )}

      {isElectron && deviceOk === false && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-800">
          ❌ No se detectó el lector. Verifica que esté conectado por USB y que el SDK ZKFinger esté instalado.
        </div>
      )}

      {isElectron && deviceOk === true && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4 text-sm text-emerald-800">
          ✅ Lector detectado y listo.
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : (
        <div className="bg-white rounded-xl shadow border divide-y">
          {roster?.map((u) => (
            <div key={u.id} className="p-4 flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
                style={{ backgroundColor: u.avatar_color }}
              >
                {u.display_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{u.display_name}</div>
                <div className="text-xs text-gray-500">{u.role}</div>
                {u.has_fingerprint && u.fingerprint_enrolled_at && (
                  <div className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                    <CheckCircle2 size={12} />
                    Enrolada {new Date(u.fingerprint_enrolled_at).toLocaleDateString()}
                  </div>
                )}
                {!u.has_fingerprint && (
                  <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                    <XCircle size={12} />
                    Sin huella
                  </div>
                )}
              </div>

              {enrolling === u.id ? (
                <div className="flex items-center gap-2 text-blue-600 text-sm">
                  {step === 'capture1' && <><Loader2 className="animate-spin" size={18} /> Toma 1: pon el dedo</>}
                  {step === 'capture2' && <><Loader2 className="animate-spin" size={18} /> Toma 2: levanta y vuelve a poner el dedo</>}
                  {step === 'capture3' && <><Loader2 className="animate-spin" size={18} /> Toma 3: una vez más</>}
                  {step === 'merging' && <><Loader2 className="animate-spin" size={18} /> Guardando...</>}
                  <button onClick={cancel} className="text-red-600 hover:underline ml-2 text-xs">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEnroll(u.id)}
                    disabled={!isElectron || deviceOk !== true || enrolling !== null}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Fingerprint size={16} />
                    {u.has_fingerprint ? 'Re-enrolar' : 'Enrolar'}
                  </button>
                  {u.has_fingerprint && (
                    <button
                      onClick={() => { if (confirm(`¿Eliminar huella de ${u.display_name}?`)) clearMutation.mutate(u.id); }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Eliminar huella"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
