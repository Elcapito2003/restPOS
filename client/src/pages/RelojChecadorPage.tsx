import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { Fingerprint, Clock, LogOut, AlertTriangle } from 'lucide-react';

type RosterEntry = {
  id: number;
  display_name: string;
  role: string;
  avatar_color: string;
  template: string;
};

type LastPunch = {
  user_id: number;
  display_name: string;
  type: 'in' | 'out';
  recorded_at: string;
  avatar_color: string;
};

export default function RelojChecadorPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [last, setLast] = useState<LastPunch | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exitPin, setExitPin] = useState('');
  const [showExit, setShowExit] = useState(false);
  const stopRef = useRef(false);

  const isElectron = !!window.fingerprint;

  const { data: roster } = useQuery<RosterEntry[]>({
    queryKey: ['attendance-roster'],
    queryFn: () => api.get('/attendance/roster').then(r => r.data),
    refetchInterval: 30000,
  });

  // Reloj
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Loop de captura. Se ejecuta mientras roster esté cargado.
  useEffect(() => {
    if (!isElectron || !roster || roster.length === 0) return;
    stopRef.current = false;
    let cancelled = false;

    async function loop() {
      while (!cancelled && !stopRef.current) {
        setScanning(true);
        setError(null);
        try {
          const cap = await window.fingerprint!.capture(60000);
          if (cancelled) return;
          if (!cap.ok || !cap.template) {
            // timeout: simplemente reintenta
            continue;
          }
          const id = await window.fingerprint!.identify(
            roster!.map(r => ({ fid: r.id, template: r.template })),
            cap.template
          );
          if (id.matched) {
            const matched = roster!.find(r => r.id === id.fid);
            if (matched) {
              try {
                const punch = await api.post('/attendance/punch', {
                  user_id: matched.id,
                  match_score: id.score,
                  device_info: 'reloj-checador',
                }).then(r => r.data);
                setLast({
                  user_id: matched.id,
                  display_name: matched.display_name,
                  type: punch.type,
                  recorded_at: punch.recorded_at,
                  avatar_color: matched.avatar_color,
                });
              } catch (e: any) {
                setError(e.response?.data?.error || 'Error al registrar marca');
              }
            }
            // Mostrar resultado 4 segundos antes de seguir escuchando
            await new Promise(r => setTimeout(r, 4000));
          } else {
            setError('Huella no reconocida. Vuelve a intentar.');
            await new Promise(r => setTimeout(r, 2500));
          }
        } catch (err: any) {
          if (!cancelled) setError(err.message || 'Error');
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    loop();
    return () => { cancelled = true; stopRef.current = true; };
  }, [roster, isElectron]);

  function handleExit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    if (user.role !== 'admin') {
      setError('Sólo el admin puede salir del reloj checador');
      return;
    }
    api.post('/auth/verify-pin', { userId: user.id, pin: exitPin })
      .then(() => {
        stopRef.current = true;
        navigate('/home');
      })
      .catch(() => setError('PIN incorrecto'));
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white flex flex-col">
      {/* Header con reloj */}
      <div className="px-8 py-4 flex justify-between items-center border-b border-white/10">
        <div className="text-sm text-blue-300 flex items-center gap-2">
          <Clock size={16} />
          Reloj checador · RestPOS
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums">{now.toLocaleTimeString()}</div>
          <div className="text-sm text-blue-300">{now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <button
          onClick={() => setShowExit(true)}
          className="text-xs text-blue-300 hover:text-white flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-white/10"
        >
          <LogOut size={14} /> Salir (admin)
        </button>
      </div>

      {/* Centro */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {!isElectron ? (
          <div className="text-center max-w-md">
            <AlertTriangle className="mx-auto text-amber-400 mb-4" size={64} />
            <h2 className="text-3xl font-bold mb-2">Solo en app de escritorio</h2>
            <p className="text-blue-200">El reloj checador requiere el lector ZK9500 conectado a la app de escritorio.</p>
          </div>
        ) : !roster || roster.length === 0 ? (
          <div className="text-center max-w-md">
            <AlertTriangle className="mx-auto text-amber-400 mb-4" size={64} />
            <h2 className="text-3xl font-bold mb-2">Nadie tiene huella enrolada</h2>
            <p className="text-blue-200">Pide al admin que enrole las huellas en Configuración → Huellas digitales.</p>
          </div>
        ) : last ? (
          <div className="text-center animate-in fade-in zoom-in duration-300">
            <div
              className="w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold mx-auto mb-6 shadow-2xl"
              style={{ backgroundColor: last.avatar_color }}
            >
              {last.display_name.charAt(0)}
            </div>
            <div className="text-5xl font-bold mb-2">¡{last.type === 'in' ? 'Bienvenido' : 'Hasta luego'}, {last.display_name}!</div>
            <div className={`text-3xl font-semibold ${last.type === 'in' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {last.type === 'in' ? '✓ Entrada' : '✓ Salida'} · {new Date(last.recorded_at).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <Fingerprint
              className={`mx-auto mb-6 ${scanning ? 'text-blue-400 animate-pulse' : 'text-blue-500'}`}
              size={180}
              strokeWidth={1}
            />
            <h2 className="text-5xl font-bold mb-3">Pon tu dedo en el lector</h2>
            <p className="text-2xl text-blue-300">Para registrar entrada o salida</p>
            {error && <div className="mt-6 text-amber-400 text-xl">{error}</div>}
          </div>
        )}
      </div>

      {/* Exit modal */}
      {showExit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <form onSubmit={handleExit} className="bg-white text-gray-900 rounded-xl p-6 w-80">
            <h3 className="text-lg font-bold mb-4">Salir del reloj checador</h3>
            <p className="text-sm text-gray-600 mb-3">PIN de admin requerido:</p>
            <input
              type="password"
              autoFocus
              value={exitPin}
              onChange={(e) => setExitPin(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-center text-2xl tracking-widest"
              placeholder="••••"
              maxLength={6}
            />
            {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowExit(false); setExitPin(''); setError(null); }} className="flex-1 px-3 py-2 bg-gray-100 rounded-lg">Cancelar</button>
              <button type="submit" className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg">Salir</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
