import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, ChevronDown } from 'lucide-react';

interface SubItem {
  label: string;
  to?: string;
  action?: () => void;
  divider?: boolean;
}

interface MenuItem {
  label: string;
  items: SubItem[];
  roles: string[];
}

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems: MenuItem[] = [
    {
      label: 'Configuración',
      roles: ['admin'],
      items: [
        { label: 'Configuración General', to: '/settings' },
        { label: 'Formatos de Impresión', to: '/settings' },
        { divider: true, label: '' },
        { label: 'Salir del Sistema', action: handleLogout },
      ],
    },
    {
      label: 'Catálogos',
      roles: ['admin', 'manager'],
      items: [
        { label: 'Productos / Grupos', to: '/products' },
        { label: 'Modificadores', to: '/modifiers' },
        { label: 'Motivos de Cancelación', to: '/products' },
        { divider: true, label: '' },
        { label: 'Meseros y Repartidores', to: '/meseros' },
        { label: 'Clientes', to: '/clientes' },
        { divider: true, label: '' },
        { label: 'Mesas / Mapa de Mesas', to: '/floor-editor' },
        { divider: true, label: '' },
        { label: 'Descuentos y Códigos', to: '/descuentos' },
      ],
    },
    {
      label: 'Caja',
      roles: ['admin', 'manager', 'cashier'],
      items: [
        { label: 'Apertura de Turno', to: '/shifts' },
        { label: 'Cierre de Turno', to: '/shifts' },
        { divider: true, label: '' },
        { label: 'Retiros y Depósitos', to: '/cash-register' },
        { label: 'Abrir / Cerrar Caja', to: '/cash-register' },
        { divider: true, label: '' },
        { label: 'Corte X (Parcial)', to: '/cash-register/corte-x' },
        { label: 'Corte Z (Cierre Diario)', to: '/cash-register/corte-z' },
        { divider: true, label: '' },
        { label: 'Historial de Cajas', to: '/cash-register/history' },
      ],
    },
    {
      label: 'Ventas',
      roles: ['admin', 'manager', 'waiter', 'cashier'],
      items: [
        { label: 'Servicio Comedor', to: '/tables' },
        { label: 'Servicio Rápido', to: '/orders?mode=quick' },
        { label: 'Cobrar Cuenta', to: '/payments' },
        { divider: true, label: '' },
        { label: 'Display Cocina', to: '/kitchen' },
      ],
    },
    {
      label: 'Operaciones',
      roles: ['admin', 'manager'],
      items: [
        { label: 'Gastos', to: '/gastos' },
        { divider: true, label: '' },
        { label: 'Editor de Planta', to: '/floor-editor' },
      ],
    },
    {
      label: 'Consultas',
      roles: ['admin', 'manager', 'cashier'],
      items: [
        { label: 'Monitor de Ventas', to: '/consultas/monitor' },
        { divider: true, label: '' },
        { label: 'Cuentas Abiertas', to: '/consultas/abiertas' },
        { label: 'Cuentas Pagadas', to: '/consultas/pagadas' },
        { label: 'Cuentas Canceladas', to: '/consultas/canceladas' },
        { divider: true, label: '' },
        { label: 'Turnos Abiertos', to: '/shifts' },
        { label: 'Historial de Ventas', to: '/consultas/historial' },
      ],
    },
    {
      label: 'Reportes',
      roles: ['admin', 'manager', 'cashier'],
      items: [
        { label: 'Reporte Diario', to: '/reports/daily' },
        { label: 'Ventas por Período', to: '/reports/period' },
        { divider: true, label: '' },
        { label: 'Ventas por Mesero', to: '/reports/waiter' },
        { label: 'Ventas por Categoría', to: '/reports/category' },
        { label: 'Ventas por Producto', to: '/reports/product' },
        { label: 'Ventas por Hora', to: '/reports/hourly' },
        { divider: true, label: '' },
        { label: 'Cancelaciones', to: '/reports/cancellations' },
        { label: 'Descuentos y Cortesías', to: '/reports/discounts' },
      ],
    },
    {
      label: 'Seguridad',
      roles: ['admin'],
      items: [
        { label: 'Perfiles y Permisos', to: '/security' },
        { label: 'Usuarios', to: '/users' },
      ],
    },
    {
      label: 'Mantenimiento',
      roles: ['admin'],
      items: [
        { label: 'Herramientas', to: '/maintenance' },
      ],
    },
  ];

  const filteredMenus = menuItems.filter(m => m.roles.includes(user?.role || ''));

  // Close on navigation
  useEffect(() => {
    setOpenMenu(null);
  }, [location.pathname]);

  const openDropdown = useCallback((label: string) => {
    const btn = buttonRefs.current[label];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom, left: rect.left });
    }
    setOpenMenu(prev => prev === label ? null : label);
  }, []);

  const handleItemClick = (item: SubItem) => {
    if (item.action) item.action();
    if (item.to) navigate(item.to);
    setOpenMenu(null);
  };

  const activeMenu = filteredMenus.find(m => m.label === openMenu);

  return (
    <div className="flex flex-col h-screen">
      {/* Top menu bar - SoftRestaurant style */}
      <header className="bg-slate-800 text-white shrink-0 z-50">
        {/* Brand bar */}
        <div className="flex items-center justify-between px-4 h-10 bg-slate-900 border-b border-slate-700">
          <button onClick={() => navigate('/home')} className="text-sm font-bold tracking-wide text-blue-400 hover:text-blue-300 transition-colors">restPOS</button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: user?.avatar_color || '#3B82F6' }}
              >
                {user?.display_name?.charAt(0) || '?'}
              </div>
              <span className="text-xs text-gray-300">{user?.display_name}</span>
              <span className="text-xs text-gray-500">({user?.role})</span>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 p-1" title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Menu bar */}
        <div className="flex items-stretch h-9 px-1">
          {filteredMenus.map((menu) => (
            <button
              key={menu.label}
              ref={el => { buttonRefs.current[menu.label] = el; }}
              onClick={() => openDropdown(menu.label)}
              onMouseEnter={() => {
                if (openMenu && openMenu !== menu.label) openDropdown(menu.label);
              }}
              className={`h-full px-3 text-sm flex items-center gap-1 transition-colors whitespace-nowrap ${
                openMenu === menu.label
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {menu.label}
              <ChevronDown size={12} className={`transition-transform ${openMenu === menu.label ? 'rotate-180' : ''}`} />
            </button>
          ))}
        </div>
      </header>

      {/* Dropdown portal */}
      {openMenu && activeMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[998]" onClick={() => setOpenMenu(null)} />
          <div
            className="fixed bg-white text-gray-800 shadow-xl border border-gray-200 rounded-b-lg min-w-[220px] z-[999] py-1"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
          >
            {activeMenu.items.map((item, idx) => (
              item.divider ? (
                <div key={idx} className="border-t border-gray-200 my-1" />
              ) : (
                <button
                  key={idx}
                  onClick={() => handleItemClick(item)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  {item.label}
                </button>
              )
            ))}
          </div>
        </>,
        document.body
      )}

      {/* Page content */}
      <main className="flex-1 overflow-auto bg-gray-100">
        <Outlet />
      </main>
    </div>
  );
}
