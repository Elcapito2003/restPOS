import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import LoginPage from './pages/LoginPage';
import TableMapPage from './pages/TableMapPage';
import OrderPage from './pages/OrderPage';
import KitchenDisplayPage from './pages/KitchenDisplayPage';
import PaymentPage from './pages/PaymentPage';
import CashRegisterPage from './pages/CashRegisterPage';
import CashHistoryPage from './pages/CashHistoryPage';
import CorteXPage from './pages/CorteXPage';
import CorteZPage from './pages/CorteZPage';
import ShiftPage from './pages/ShiftPage';
import ReportsPage from './pages/ReportsPage';
import ReportPeriodPage from './pages/reports/ReportPeriodPage';
import ReportWaiterPage from './pages/reports/ReportWaiterPage';
import ReportCategoryPage from './pages/reports/ReportCategoryPage';
import ReportProductPage from './pages/reports/ReportProductPage';
import ReportHourlyPage from './pages/reports/ReportHourlyPage';
import ReportCancellationsPage from './pages/reports/ReportCancellationsPage';
import ReportDiscountsPage from './pages/reports/ReportDiscountsPage';
import ConsultasPage from './pages/ConsultasPage';
import SalesMonitorPage from './pages/SalesMonitorPage';
import ProductsPage from './pages/ProductsPage';
import ModifiersPage from './pages/ModifiersPage';
import ClientesPage from './pages/ClientesPage';
import MeserosPage from './pages/MeserosPage';
import GastosPage from './pages/GastosPage';
import UsersPage from './pages/UsersPage';
import SecurityPage from './pages/SecurityPage';
import FloorEditorPage from './pages/FloorEditorPage';
import SettingsPage from './pages/SettingsPage';
import MaintenancePage from './pages/MaintenancePage';
import HomePage from './pages/HomePage';
import DiscountPresetsPage from './pages/DiscountPresetsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/home" />;
  return <>{children}</>;
}

function R({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  return <ProtectedRoute roles={roles}>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <Routes>
              {/* Auth */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>

              {/* Protected */}
              <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                {/* Home */}
                <Route path="/home" element={<HomePage />} />

                {/* Ventas */}
                <Route path="/tables" element={<TableMapPage />} />
                <Route path="/orders" element={<OrderPage />} />
                <Route path="/payments" element={<PaymentPage />} />
                <Route path="/kitchen" element={<KitchenDisplayPage />} />

                {/* Caja */}
                <Route path="/cash-register" element={<R roles={['admin','manager','cashier']}><CashRegisterPage /></R>} />
                <Route path="/cash-register/corte-x" element={<R roles={['admin','manager','cashier']}><CorteXPage /></R>} />
                <Route path="/cash-register/corte-z" element={<R roles={['admin','manager']}><CorteZPage /></R>} />
                <Route path="/cash-register/history" element={<R roles={['admin','manager']}><CashHistoryPage /></R>} />
                <Route path="/shifts" element={<ShiftPage />} />

                {/* Catálogos */}
                <Route path="/products" element={<R roles={['admin','manager']}><ProductsPage /></R>} />
                <Route path="/modifiers" element={<R roles={['admin','manager']}><ModifiersPage /></R>} />
                <Route path="/clientes" element={<R roles={['admin','manager','cashier']}><ClientesPage /></R>} />
                <Route path="/meseros" element={<R roles={['admin','manager']}><MeserosPage /></R>} />
                <Route path="/floor-editor" element={<R roles={['admin','manager']}><FloorEditorPage /></R>} />

                {/* Operaciones */}
                <Route path="/gastos" element={<R roles={['admin','manager','cashier']}><GastosPage /></R>} />
                <Route path="/descuentos" element={<R roles={['admin','manager']}><DiscountPresetsPage /></R>} />

                {/* Consultas */}
                <Route path="/consultas/monitor" element={<R roles={['admin','manager','cashier']}><SalesMonitorPage /></R>} />
                <Route path="/consultas/abiertas" element={<R roles={['admin','manager','cashier']}><ConsultasPage defaultTab="abiertas" /></R>} />
                <Route path="/consultas/pagadas" element={<R roles={['admin','manager','cashier']}><ConsultasPage defaultTab="pagadas" /></R>} />
                <Route path="/consultas/canceladas" element={<R roles={['admin','manager','cashier']}><ConsultasPage defaultTab="canceladas" /></R>} />
                <Route path="/consultas/historial" element={<R roles={['admin','manager','cashier']}><ConsultasPage defaultTab="pagadas" /></R>} />

                {/* Reportes */}
                <Route path="/reports/daily" element={<R roles={['admin','manager','cashier']}><ReportsPage /></R>} />
                <Route path="/reports/period" element={<R roles={['admin','manager','cashier']}><ReportPeriodPage /></R>} />
                <Route path="/reports/waiter" element={<R roles={['admin','manager','cashier']}><ReportWaiterPage /></R>} />
                <Route path="/reports/category" element={<R roles={['admin','manager','cashier']}><ReportCategoryPage /></R>} />
                <Route path="/reports/product" element={<R roles={['admin','manager','cashier']}><ReportProductPage /></R>} />
                <Route path="/reports/hourly" element={<R roles={['admin','manager','cashier']}><ReportHourlyPage /></R>} />
                <Route path="/reports/cancellations" element={<R roles={['admin','manager','cashier']}><ReportCancellationsPage /></R>} />
                <Route path="/reports/discounts" element={<R roles={['admin','manager','cashier']}><ReportDiscountsPage /></R>} />

                {/* Seguridad */}
                <Route path="/users" element={<R roles={['admin']}><UsersPage /></R>} />
                <Route path="/security" element={<R roles={['admin']}><SecurityPage /></R>} />

                {/* Configuración */}
                <Route path="/settings" element={<R roles={['admin']}><SettingsPage /></R>} />

                {/* Mantenimiento */}
                <Route path="/maintenance" element={<R roles={['admin']}><MaintenancePage /></R>} />

                {/* Legacy redirects */}
                <Route path="/reports" element={<Navigate to="/reports/daily" />} />
              </Route>

              <Route path="*" element={<Navigate to="/home" />} />
            </Routes>
            <Toaster position="top-right" toastOptions={{ duration: 3000, style: { minHeight: '44px' } }} />
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
