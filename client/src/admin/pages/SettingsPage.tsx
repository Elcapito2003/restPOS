import { useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ArrowLeft, Shield, Check, Loader2, AlertTriangle } from 'lucide-react';

export default function SettingsPage({ onBack }: { onBack: () => void }) {
  const { admin, adminFetch } = useAdminAuth();
  const [qrData, setQrData] = useState<{ qrCodeUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const totpEnabled = admin?.totp_enabled;

  const handleGenerate = async () => {
    setLoading(true); setError('');
    try {
      const res = await adminFetch('/auth/setup-2fa', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQrData({ qrCodeUrl: data.qrCodeUrl, secret: data.secret });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true); setError('');
    try {
      const res = await adminFetch('/auth/confirm-2fa', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(true);
      // Refresh admin info in storage
      const updated = { ...admin!, totp_enabled: true };
      localStorage.setItem('sa_admin', JSON.stringify(updated));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={20} /> Dashboard
        </button>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Shield size={24} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Seguridad (2FA)</h1>
              <p className="text-sm text-slate-400">Autenticación de dos factores con Google Authenticator o similar</p>
            </div>
          </div>

          {totpEnabled && !success ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
              <Check size={20} className="text-green-400" />
              <div>
                <p className="text-green-400 font-medium">2FA activo</p>
                <p className="text-xs text-slate-400">Tu cuenta requiere código TOTP al iniciar sesión.</p>
              </div>
            </div>
          ) : success ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center">
              <Check size={48} className="text-green-400 mx-auto mb-3" />
              <p className="text-green-400 font-bold text-lg">2FA Activado</p>
              <p className="text-sm text-slate-400 mt-2">La próxima vez que inicies sesión te pedirá el código de la app.</p>
            </div>
          ) : !qrData ? (
            <>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3 mb-6">
                <AlertTriangle size={18} className="text-yellow-400 mt-0.5" />
                <div className="text-sm">
                  <p className="text-yellow-200 font-medium">2FA no está activo</p>
                  <p className="text-slate-400 text-xs mt-1">
                    Recomendado para cuentas super-admin. Un atacante que obtenga tu contraseña no podrá entrar sin el código del teléfono.
                  </p>
                </div>
              </div>

              <ol className="text-sm text-slate-300 space-y-2 mb-6 list-decimal pl-5">
                <li>Instala Google Authenticator, Authy o 1Password en tu teléfono</li>
                <li>Toca "Generar QR" abajo</li>
                <li>Escanea el QR con la app</li>
                <li>Ingresa el código de 6 dígitos que genera la app y confirma</li>
              </ol>

              <button onClick={handleGenerate} disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
                Generar QR
              </button>
            </>
          ) : (
            <>
              <div className="bg-white p-4 rounded-xl inline-block mx-auto block w-fit mb-4">
                <img src={qrData.qrCodeUrl} alt="QR 2FA" className="w-56 h-56" />
              </div>
              <div className="bg-slate-700/40 rounded-xl p-3 mb-4 text-center">
                <p className="text-xs text-slate-400 mb-1">Clave secreta (respaldo)</p>
                <code className="font-mono text-xs text-slate-300 break-all">{qrData.secret}</code>
              </div>

              <label className="text-xs text-slate-400 mb-1 block">Ingresa el código de 6 dígitos</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest font-mono mb-3"
                autoFocus
              />

              <button onClick={handleConfirm} disabled={loading || code.length !== 6}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                Confirmar y activar
              </button>
            </>
          )}

          {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <h2 className="font-bold mb-2">Cuenta</h2>
          <div className="text-sm space-y-1 text-slate-300">
            <div className="flex justify-between"><span className="text-slate-400">Email</span><span>{admin?.email}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Nombre</span><span>{admin?.display_name}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
