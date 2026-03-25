import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import { Plus, Edit2, Search } from 'lucide-react';

export default function ClientesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then(r => r.data),
  });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', tax_id: '', client_type: 'general', notes: '' });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/clients', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setShowForm(false); toast.success('Cliente creado'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/clients/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setShowForm(false); toast.success('Cliente actualizado'); },
  });

  const openForm = (client?: any) => {
    if (client) {
      setEditing(client);
      setForm({ name: client.name, phone: client.phone || '', email: client.email || '', address: client.address || '', tax_id: client.tax_id || '', client_type: client.client_type || 'general', notes: client.notes || '' });
    } else {
      setEditing(null);
      setForm({ name: '', phone: '', email: '', address: '', tax_id: '', client_type: 'general', notes: '' });
    }
    setShowForm(true);
  };

  const save = () => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const filtered = clients?.filter((c: any) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Clientes</h2>
        <button onClick={() => openForm()} className="btn-primary gap-1 text-sm"><Plus size={16} /> Nuevo</button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} className="input pl-10" placeholder="Buscar por nombre, teléfono o email..." />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Nombre</th>
              <th className="text-left p-3">Teléfono</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">RFC</th>
              <th className="text-left p-3">Tipo</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered?.map((c: any) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 text-gray-500">{c.phone || '-'}</td>
                <td className="p-3 text-gray-500">{c.email || '-'}</td>
                <td className="p-3 text-gray-500">{c.tax_id || '-'}</td>
                <td className="p-3">{c.client_type}</td>
                <td className="p-3 text-right">
                  <button onClick={() => openForm(c)} className="p-1 hover:bg-gray-200 rounded"><Edit2 size={16} /></button>
                </td>
              </tr>
            ))}
            {(!filtered || filtered.length === 0) && (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">Sin clientes</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-4 space-y-3">
            <h3 className="font-bold">{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" placeholder="Nombre *" />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input" placeholder="Teléfono" />
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" placeholder="Email" />
            </div>
            <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input" placeholder="Dirección" />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })} className="input" placeholder="RFC" />
              <select value={form.client_type} onChange={e => setForm({ ...form, client_type: e.target.value })} className="input">
                <option value="general">General</option>
                <option value="empresa">Empresa</option>
                <option value="empleado">Empleado</option>
                <option value="vip">VIP</option>
              </select>
            </div>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input" placeholder="Notas" rows={2} />
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={save} disabled={!form.name} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
