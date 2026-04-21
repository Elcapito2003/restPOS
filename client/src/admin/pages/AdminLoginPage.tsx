import { useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Shield, Lock, Eye, EyeOff } from 'lucide-react';

export default function AdminLoginPage() {
  const { login, verify2FA } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [needs2FA, setNeeds2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [code, setCode] = useState('');

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.requires2FA) {
        setNeeds2FA(true);
        setTempToken(result.tempToken!);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = async () => {
    setError('');
    setLoading(true);
    try {
      await verify2FA(tempToken, code);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">restPOS</h1>
          <p className="text-slate-400 text-sm mt-1">Panel de Administración</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-white/10">
          {!needs2FA ? (
            <>
              <h2 className="text-white text-lg font-semibold mb-4">Iniciar Sesión</h2>

              <div className="space-y-3">
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Email"
                />
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                    placeholder="Contraseña"
                  />
                  <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-slate-400 hover:text-white">
                    {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

              <button onClick={handleLogin} disabled={loading || !email || !password}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                <Lock size={18} />
                {loading ? 'Verificando...' : 'Entrar'}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-white text-lg font-semibold mb-2">Verificación 2FA</h2>
              <p className="text-slate-400 text-sm mb-4">Ingresa el código de Google Authenticator</p>

              <input
                type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && handle2FA()}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="000000" maxLength={6} autoFocus
              />

              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

              <button onClick={handle2FA} disabled={loading || code.length !== 6}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors">
                {loading ? 'Verificando...' : 'Verificar'}
              </button>

              <button onClick={() => { setNeeds2FA(false); setCode(''); setError(''); }}
                className="w-full mt-2 text-slate-400 hover:text-white text-sm py-2 transition-colors">
                Volver al login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
