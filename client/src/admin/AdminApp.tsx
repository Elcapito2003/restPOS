import { useState } from 'react';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import AdminLoginPage from './pages/AdminLoginPage';
import DashboardPage from './pages/DashboardPage';
import NewRestaurantPage from './pages/NewRestaurantPage';
import RestaurantDetailPage from './pages/RestaurantDetailPage';
import AuditLogPage from './pages/AuditLogPage';
import SettingsPage from './pages/SettingsPage';

type AdminPage = 'dashboard' | 'new-restaurant' | 'restaurant-detail' | 'audit-log' | 'settings';

function AdminContent() {
  const { isAuthenticated } = useAdminAuth();
  const [page, setPage] = useState<AdminPage>('dashboard');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  if (!isAuthenticated) return <AdminLoginPage />;

  if (page === 'new-restaurant') {
    return (
      <NewRestaurantPage
        onBack={() => setPage('dashboard')}
        onCreated={() => setRefreshKey(k => k + 1)}
      />
    );
  }

  if (page === 'restaurant-detail' && selectedTenantId) {
    return (
      <RestaurantDetailPage
        tenantId={selectedTenantId}
        onBack={() => setPage('dashboard')}
      />
    );
  }

  if (page === 'audit-log') {
    return <AuditLogPage onBack={() => setPage('dashboard')} />;
  }

  if (page === 'settings') {
    return <SettingsPage onBack={() => setPage('dashboard')} />;
  }

  return (
    <DashboardPage
      key={refreshKey}
      onNewRestaurant={() => setPage('new-restaurant')}
      onSelectTenant={(id: string) => { setSelectedTenantId(id); setPage('restaurant-detail'); }}
      onOpenAuditLog={() => setPage('audit-log')}
      onOpenSettings={() => setPage('settings')}
    />
  );
}

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <AdminContent />
    </AdminAuthProvider>
  );
}
