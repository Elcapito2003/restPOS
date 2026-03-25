import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import { ROLES } from '../config/constants';
import { Plus, Edit2, UserX } from 'lucide-react';
import toast from 'react-hot-toast';

const AVATAR_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

export default function UsersPage() {
  const qc = useQueryClient();
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState('waiter');
  const [color, setColor] = useState('#3B82F6');

  const createUser = useMutation({
    mutationFn: (data: any) => api.post('/users', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowForm(false); toast.success('Usuario creado'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/users/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowForm(false); toast.success('Usuario actualizado'); },
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Usuario desactivado'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  });

  const openForm = (user?: any) => {
    if (user) {
      setEditing(user);
      setUsername(user.username);
      setDisplayName(user.display_name);
      setPin('');
      setRole(user.role);
      setColor(user.avatar_color);
    } else {
      setEditing(null);
      setUsername('');
      setDisplayName('');
      setPin('');
      setRole('waiter');
      setColor('#3B82F6');
    }
    setShowForm(true);
  };

  const save = () => {
    const data: any = { username, display_name: displayName, role, avatar_color: color };
    if (pin) data.pin = pin;
    if (editing) {
      updateUser.mutate({ id: editing.id, ...data });
    } else {
      data.pin = pin;
      createUser.mutate(data);
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Usuarios</h2>
        <button onClick={() => openForm()} className="btn-primary gap-1 text-sm"><Plus size={16} /> Nuevo</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {users?.map((user: any) => (
          <div key={user.id} className="card p-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
                style={{ backgroundColor: user.avatar_color }}
              >
                {user.display_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{user.display_name}</p>
                <p className="text-sm text-gray-500">@{user.username}</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {ROLES[user.role as keyof typeof ROLES]}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => openForm(user)} className="p-2 hover:bg-gray-100 rounded-lg" title="Editar">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => { if (confirm(`¿Desactivar a ${user.display_name}?`)) deleteUser.mutate(user.id); }}
                  className="p-2 hover:bg-red-50 rounded-lg text-red-500" title="Desactivar">
                  <UserX size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-4">
            <h3 className="font-bold mb-3">{editing ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="input mb-3" placeholder="Nombre" />
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="input mb-3" placeholder="Usuario" />
            <input type="password" value={pin} onChange={e => setPin(e.target.value)} className="input mb-3" placeholder={editing ? 'Nuevo PIN (dejar vacío para no cambiar)' : 'PIN (4-6 dígitos)'} />
            <select value={role} onChange={e => setRole(e.target.value)} className="input mb-3">
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="mb-3">
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 mt-1">
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-gray-900' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={save} disabled={!displayName || !username || (!editing && !pin)} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
