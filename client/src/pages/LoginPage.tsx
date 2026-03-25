import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import toast from 'react-hot-toast';

interface UserOption {
  id: number;
  username: string;
  display_name: string;
  role: string;
  avatar_color: string;
}

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/tables');
  }, [isAuthenticated]);

  useEffect(() => {
    api.get('/auth/users').then(r => setUsers(r.data)).catch(() => {});
  }, []);

  const handlePinDigit = (digit: string) => {
    if (pin.length >= 6) return;
    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length >= 4 && selectedUser) {
      attemptLogin(selectedUser.id, newPin);
    }
  };

  const attemptLogin = async (userId: number, pinValue: string) => {
    setLoading(true);
    try {
      await login(userId, pinValue);
      navigate('/tables');
    } catch {
      toast.error('PIN incorrecto');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedUser) {
    return (
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-white text-center mb-2">restPOS</h1>
        <p className="text-blue-200 text-center mb-8">Selecciona tu usuario</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => setSelectedUser(u)}
              className="flex flex-col items-center p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-colors min-h-[100px]"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold mb-2"
                style={{ backgroundColor: u.avatar_color }}
              >
                {u.display_name.charAt(0)}
              </div>
              <span className="text-white text-sm font-medium">{u.display_name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <button onClick={() => { setSelectedUser(null); setPin(''); }} className="text-blue-300 mb-6 text-sm hover:text-white">
        &larr; Cambiar usuario
      </button>
      <div className="text-center mb-6">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-3"
          style={{ backgroundColor: selectedUser.avatar_color }}
        >
          {selectedUser.display_name.charAt(0)}
        </div>
        <h2 className="text-xl font-bold text-white">{selectedUser.display_name}</h2>
      </div>

      {/* PIN dots */}
      <div className="flex justify-center gap-3 mb-6">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full ${i < pin.length ? 'bg-blue-400' : 'bg-white/30'}`} />
        ))}
      </div>

      {/* NumPad */}
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button
            key={n}
            onClick={() => handlePinDigit(String(n))}
            disabled={loading}
            className="h-16 rounded-xl bg-white/10 text-white text-2xl font-bold hover:bg-white/20 active:bg-white/30 transition-colors"
          >
            {n}
          </button>
        ))}
        <div />
        <button
          onClick={() => handlePinDigit('0')}
          disabled={loading}
          className="h-16 rounded-xl bg-white/10 text-white text-2xl font-bold hover:bg-white/20 active:bg-white/30 transition-colors"
        >
          0
        </button>
        <button
          onClick={() => setPin(pin.slice(0, -1))}
          className="h-16 rounded-xl bg-white/10 text-white text-lg hover:bg-white/20 transition-colors"
        >
          &#9003;
        </button>
      </div>
    </div>
  );
}
