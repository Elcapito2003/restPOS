import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  UtensilsCrossed, Zap, FileSearch, Clock, LogIn, LogOut,
  Monitor, Calculator, Receipt, Wallet,
  Package, Sliders, FolderTree, Users, LayoutGrid, UserCog, Settings, Wrench,
  ShoppingCart, Briefcase, Tag,
} from 'lucide-react';

type View = 'pos' | 'admin';

const posButtons = [
  { label: 'Comedor', icon: UtensilsCrossed, to: '/tables', key: 'F7' },
  { label: 'Rápido', icon: Zap, to: '/orders?mode=quick', key: 'F9' },
  { label: 'Retiro / depósito', icon: Wallet, to: '/cash-register', key: '' },
  { label: 'Consultar ctas.', icon: FileSearch, to: '/consultas/abiertas', key: 'F5' },
  { label: 'Abrir turno', icon: LogIn, to: '/shifts', key: 'F2' },
  { label: 'Cerrar turno', icon: LogOut, to: '/shifts', key: 'F3' },
  { label: 'Monitor ventas', icon: Monitor, to: '/consultas/monitor', key: '' },
  { label: 'Corte caja X', icon: Calculator, to: '/cash-register/corte-x', key: '' },
];

const adminButtons = [
  { label: 'Productos', icon: Package, to: '/products', key: '' },
  { label: 'Modificadores', icon: Sliders, to: '/modifiers', key: '' },
  { label: 'Categorías', icon: FolderTree, to: '/products', key: '' },
  { label: 'Meseros', icon: Users, to: '/meseros', key: '' },
  { label: 'Pisos / Mesas', icon: LayoutGrid, to: '/floor-editor', key: '' },
  { label: 'Descuentos', icon: Tag, to: '/descuentos', key: '' },
  { label: 'Usuarios', icon: UserCog, to: '/users', key: '' },
  { label: 'Reportes', icon: Receipt, to: '/reports/daily', key: '' },
  { label: 'Configuración', icon: Settings, to: '/settings', key: '' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>('pos');

  const buttons = view === 'pos' ? posButtons : adminButtons;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-full flex flex-col bg-slate-800">
      {/* ═══ Top Toolbar - Big icon buttons ═══ */}
      <div className="shrink-0 bg-gradient-to-b from-orange-200 to-orange-100 border-b border-orange-400">
        <div className="flex">
          {buttons.map(btn => (
            <button key={btn.label} onClick={() => navigate(btn.to)}
              className="flex flex-col items-center justify-center px-3 py-2 min-w-[100px] flex-1 max-w-[140px] hover:bg-orange-300/50 active:bg-orange-300 transition-colors border-r border-orange-300/50 group">
              {btn.key && (
                <span className="text-[10px] text-orange-600 font-mono self-start mb-0.5">{btn.key}</span>
              )}
              <btn.icon size={32} className="text-orange-900 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
              <span className="text-xs font-medium text-orange-900 mt-1 text-center leading-tight">{btn.label}</span>
            </button>
          ))}
          {/* Salir button - rightmost */}
          <button onClick={handleLogout}
            className="flex flex-col items-center justify-center px-3 py-2 min-w-[80px] ml-auto hover:bg-red-200/50 active:bg-red-300 transition-colors border-l border-orange-300/50 group">
            <span className="text-[10px] text-orange-600 font-mono self-start mb-0.5">ESC</span>
            <LogOut size={32} className="text-red-700 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
            <span className="text-xs font-medium text-red-800 mt-1">Salir</span>
          </button>
        </div>
      </div>

      {/* ═══ Main area ═══ */}
      <div className="flex-1 relative overflow-hidden">
        {/* Background/branding area */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 flex items-center justify-center">
          <div className="text-center opacity-20">
            <h1 className="text-7xl font-black tracking-wider text-white">restPOS</h1>
            <p className="text-xl text-gray-300 mt-2">Sistema Punto de Venta</p>
          </div>
        </div>

        {/* Info bar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-4 pb-4">
          {/* Left: System info */}
          <div className="bg-white/90 backdrop-blur rounded-lg px-6 py-4 shadow-lg">
            <p className="font-bold text-gray-800">restPOS v1.0</p>
            <p className="text-sm text-gray-600">Usuario: <b>{user?.display_name}</b> ({user?.role})</p>
            <p className="text-sm text-gray-500">Conexión establecida</p>
          </div>

          {/* Right: Main navigation cards */}
          <div className="flex gap-3">
            <button onClick={() => setView('admin')}
              className={`flex flex-col items-center justify-center w-36 h-28 rounded-lg shadow-lg transition-all hover:scale-105 active:scale-95 ${
                view === 'admin'
                  ? 'bg-orange-500 text-white ring-2 ring-orange-300 ring-offset-2 ring-offset-slate-800'
                  : 'bg-white/90 backdrop-blur text-gray-800 hover:bg-orange-50'
              }`}>
              <Briefcase size={36} strokeWidth={1.5} />
              <span className="text-sm font-bold mt-2">Administración</span>
            </button>
            <button onClick={() => setView('pos')}
              className={`flex flex-col items-center justify-center w-36 h-28 rounded-lg shadow-lg transition-all hover:scale-105 active:scale-95 ${
                view === 'pos'
                  ? 'bg-orange-500 text-white ring-2 ring-orange-300 ring-offset-2 ring-offset-slate-800'
                  : 'bg-white/90 backdrop-blur text-gray-800 hover:bg-orange-50'
              }`}>
              <ShoppingCart size={36} strokeWidth={1.5} />
              <span className="text-sm font-bold mt-2">Pto. de venta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
