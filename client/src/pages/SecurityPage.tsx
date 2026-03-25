import { useQuery } from '@tanstack/react-query';
import api from '../config/api';
import { ROLES } from '../config/constants';
import { Shield } from 'lucide-react';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['Todo el sistema', 'Configuración', 'Seguridad', 'Reportes', 'Catálogos', 'Ventas', 'Caja', 'Cocina'],
  manager: ['Reportes', 'Catálogos', 'Ventas', 'Caja', 'Cocina', 'Consultas', 'Operaciones'],
  cashier: ['Ventas', 'Caja', 'Consultas', 'Reportes básicos'],
  waiter: ['Ventas (Comedor)', 'Tomar ordenes', 'Enviar a cocina'],
  kitchen: ['Display de cocina', 'Marcar items listos'],
};

export default function SecurityPage() {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const roleGroups = Object.entries(ROLES).map(([key, label]) => ({
    role: key,
    label,
    users: users?.filter((u: any) => u.role === key) || [],
    permissions: ROLE_PERMISSIONS[key] || [],
  }));

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Seguridad - Perfiles y Permisos</h2>

      <div className="space-y-4">
        {roleGroups.map(group => (
          <div key={group.role} className="card overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex items-center gap-3">
              <Shield size={20} className="text-blue-600" />
              <div>
                <h3 className="font-bold">{group.label}</h3>
                <p className="text-xs text-gray-500">{group.users.length} usuario(s)</p>
              </div>
            </div>
            <div className="p-4">
              <div className="mb-3">
                <p className="text-sm font-medium mb-1">Permisos:</p>
                <div className="flex flex-wrap gap-1">
                  {group.permissions.map(p => (
                    <span key={p} className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">{p}</span>
                  ))}
                </div>
              </div>
              {group.users.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Usuarios:</p>
                  <div className="flex flex-wrap gap-2">
                    {group.users.map((u: any) => (
                      <div key={u.id} className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: u.avatar_color || '#3B82F6' }}>
                          {u.display_name?.charAt(0)}
                        </div>
                        <span className="text-sm">{u.display_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
