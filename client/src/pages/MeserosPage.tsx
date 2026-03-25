import { useQuery } from '@tanstack/react-query';
import api from '../config/api';
import dayjs from 'dayjs';

export default function MeserosPage() {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });
  const { data: openShifts } = useQuery({
    queryKey: ['shifts', 'open'],
    queryFn: () => api.get('/shifts').then(r => r.data),
  });

  const waiters = users?.filter((u: any) => ['waiter', 'admin', 'manager'].includes(u.role)) || [];
  const shiftMap = new Map<number, any>();
  openShifts?.forEach((s: any) => shiftMap.set(s.user_id, s));

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Meseros y Repartidores</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {waiters.map((u: any) => {
          const shift = shiftMap.get(u.id);
          return (
            <div key={u.id} className="card p-4 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-2" style={{ backgroundColor: u.avatar_color || '#3B82F6' }}>
                {u.display_name?.charAt(0)}
              </div>
              <p className="font-medium">{u.display_name}</p>
              <p className="text-xs text-gray-500 capitalize">{u.role}</p>
              {shift ? (
                <span className="inline-block mt-2 px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700">
                  En turno desde {dayjs(shift.opened_at).format('HH:mm')}
                </span>
              ) : (
                <span className="inline-block mt-2 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-500">
                  Sin turno
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
