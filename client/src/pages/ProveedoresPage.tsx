import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2, X, Phone, Mail, Building2, Package, Link2, ArrowLeft, Truck } from 'lucide-react';

interface Supplier {
  id: number; name: string; contact_name: string; phone: string; address: string;
  bank_name: string; account_number: string; clabe: string; email: string; whatsapp: string; notes: string;
  shipping_cost: number; free_shipping_min: number;
}
interface SupplierItem {
  item_id: number; item_name: string; unit: string; price: number; delivery_days: number;
}
interface InvItem { id: number; name: string; unit: string; }

const empty: Omit<Supplier, 'id'> = {
  name: '', contact_name: '', phone: '', address: '',
  bank_name: '', account_number: '', clabe: '',
  email: '', whatsapp: '', notes: '',
  shipping_cost: 0, free_shipping_min: 0,
};

export default function ProveedoresPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(empty);
  const [showBank, setShowBank] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // ─── Queries ───
  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers').then(r => r.data),
  });

  const { data: invItems = [] } = useQuery<InvItem[]>({
    queryKey: ['inventory-items'],
    queryFn: () => api.get('/inventory/items').then(r => r.data),
  });

  const selectedSupplier = suppliers?.find(s => s.id === selectedId) || null;

  const { data: supplierItems = [] } = useQuery<SupplierItem[]>({
    queryKey: ['supplier-items', selectedId],
    queryFn: () => api.get(`/suppliers/${selectedId}/items`).then(r => r.data),
    enabled: !!selectedId,
  });

  // ─── Mutations ───
  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        name: data.name,
        contact_name: data.contact_name || '',
        phone: data.phone || '',
        address: data.address || '',
        bank_name: data.bank_name || '',
        account_number: data.account_number || '',
        clabe: data.clabe || '',
        email: data.email || '',
        whatsapp: data.whatsapp || '',
        notes: data.notes || '',
        shipping_cost: parseFloat(data.shipping_cost) || 0,
        free_shipping_min: parseFloat(data.free_shipping_min) || 0,
      };
      return editing ? api.put(`/suppliers/${editing.id}`, payload) : api.post('/suppliers', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      closeForm();
      toast.success(editing ? 'Proveedor actualizado' : 'Proveedor creado');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/suppliers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      if (selectedId) setSelectedId(null);
      toast.success('Proveedor eliminado');
    },
  });

  const linkMut = useMutation({
    mutationFn: (data: { item_id: number; supplier_id: number; price: number; delivery_days?: number }) =>
      api.post('/inventory/item-suppliers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-items', selectedId] });
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      toast.success('Producto asignado');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  });

  const unlinkMut = useMutation({
    mutationFn: (itemId: number) => api.delete(`/inventory/items/${itemId}/suppliers/${selectedId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-items', selectedId] });
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      toast.success('Producto desvinculado');
    },
  });

  function closeForm() { setShowForm(false); setEditing(null); setForm(empty); setShowBank(false); }
  function openEdit(s: Supplier) { setForm(s); setEditing(s); setShowBank(!!(s.bank_name || s.account_number || s.clabe)); setShowForm(true); }
  function set(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })); }

  // ─── Detail view ───
  if (selectedSupplier) {
    return (
      <SupplierDetail
        supplier={selectedSupplier}
        items={supplierItems}
        invItems={invItems}
        onBack={() => setSelectedId(null)}
        onEdit={() => openEdit(selectedSupplier)}
        onLink={(data) => linkMut.mutate({ ...data, supplier_id: selectedSupplier.id })}
        onUnlink={(itemId) => { if (confirm('¿Desvincular este producto?')) unlinkMut.mutate(itemId); }}
        linkLoading={linkMut.isPending}
      />
    );
  }

  // ─── List view ───
  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Proveedores</h2>
        <button onClick={() => { setForm(empty); setEditing(null); setShowForm(true); }} className="btn-primary gap-1 text-sm">
          <Plus size={16} /> Nuevo Proveedor
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Nombre</th>
              <th className="text-left p-3">Contacto</th>
              <th className="text-left p-3">Telefono</th>
              <th className="text-left p-3">WhatsApp</th>
              <th className="text-left p-3">Productos</th>
              <th className="text-right p-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {suppliers?.map((s: Supplier) => (
              <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedId(s.id)}>
                <td className="p-3 font-medium text-blue-600 hover:underline">{s.name}</td>
                <td className="p-3 text-gray-500">{s.contact_name || '-'}</td>
                <td className="p-3">{s.phone || '-'}</td>
                <td className="p-3">{s.whatsapp || '-'}</td>
                <td className="p-3 text-gray-400 text-xs">
                  <Package size={14} className="inline mr-1" />Ver detalle
                </td>
                <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEdit(s)} className="text-blue-600 hover:text-blue-800 mr-2"><Edit2 size={16} /></button>
                  <button onClick={() => { if (confirm('¿Eliminar este proveedor?')) deleteMutation.mutate(s.id); }} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {(!suppliers || suppliers.length === 0) && (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">Sin proveedores registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {showForm && (
        <SupplierFormModal
          form={form} editing={editing} showBank={showBank}
          set={set} setShowBank={setShowBank}
          onClose={closeForm}
          onSave={() => saveMutation.mutate(form)}
          saving={saveMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── Supplier Detail View ───

function SupplierDetail({ supplier, items, invItems, onBack, onEdit, onLink, onUnlink, linkLoading }: {
  supplier: Supplier; items: SupplierItem[]; invItems: InvItem[];
  onBack: () => void; onEdit: () => void;
  onLink: (data: { item_id: number; price: number; delivery_days?: number }) => void;
  onUnlink: (itemId: number) => void; linkLoading: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [addItemId, setAddItemId] = useState(0);
  const [addPrice, setAddPrice] = useState('');
  const [addIva, setAddIva] = useState(true);
  const [addDays, setAddDays] = useState('1');

  const linkedIds = items.map(i => i.item_id);
  const available = invItems.filter(i => !linkedIds.includes(i.id));

  function handleAdd() {
    if (!addItemId || !addPrice) return;
    const priceNum = parseFloat(addPrice);
    const finalPrice = addIva ? priceNum * 1.16 : priceNum;
    onLink({ item_id: addItemId, price: Math.round(finalPrice * 100) / 100, delivery_days: parseInt(addDays) || 1 });
    setAddItemId(0); setAddPrice(''); setAddDays('1');
    setShowAdd(false);
  }

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700"><ArrowLeft size={20} /></button>
        <h2 className="text-xl font-bold flex-1">{supplier.name}</h2>
        <button onClick={onEdit} className="btn-secondary text-sm gap-1"><Edit2 size={14} /> Editar</button>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {supplier.contact_name && (
          <div className="card p-3">
            <p className="text-xs text-gray-400">Contacto</p>
            <p className="font-medium text-sm">{supplier.contact_name}</p>
          </div>
        )}
        {supplier.phone && (
          <div className="card p-3">
            <p className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} /> Telefono</p>
            <p className="font-medium text-sm">{supplier.phone}</p>
          </div>
        )}
        {supplier.whatsapp && (
          <div className="card p-3">
            <p className="text-xs text-gray-400">WhatsApp</p>
            <p className="font-medium text-sm">{supplier.whatsapp}</p>
          </div>
        )}
        {supplier.email && (
          <div className="card p-3">
            <p className="text-xs text-gray-400 flex items-center gap-1"><Mail size={10} /> Email</p>
            <p className="font-medium text-sm">{supplier.email}</p>
          </div>
        )}
        {supplier.address && (
          <div className="card p-3 col-span-2">
            <p className="text-xs text-gray-400">Direccion</p>
            <p className="font-medium text-sm">{supplier.address}</p>
          </div>
        )}
        {(supplier.bank_name || supplier.account_number || supplier.clabe) && (
          <div className="card p-3 col-span-2">
            <p className="text-xs text-gray-400 flex items-center gap-1"><Building2 size={10} /> Datos bancarios</p>
            <p className="text-sm">{[supplier.bank_name, supplier.account_number, supplier.clabe].filter(Boolean).join(' · ')}</p>
          </div>
        )}
        {supplier.notes && (
          <div className="card p-3 col-span-2">
            <p className="text-xs text-gray-400">Notas</p>
            <p className="text-sm">{supplier.notes}</p>
          </div>
        )}
        {(Number(supplier.shipping_cost) > 0 || Number(supplier.free_shipping_min) > 0) && (
          <div className="card p-3 col-span-2">
            <p className="text-xs text-gray-400 flex items-center gap-1"><Truck size={10} /> Envio</p>
            <p className="text-sm">
              {Number(supplier.shipping_cost) > 0 && <span className="font-medium">${Number(supplier.shipping_cost).toFixed(2)} por envio</span>}
              {Number(supplier.shipping_cost) > 0 && Number(supplier.free_shipping_min) > 0 && <span className="text-gray-400"> · </span>}
              {Number(supplier.free_shipping_min) > 0 && <span className="text-green-600">Gratis a partir de ${Number(supplier.free_shipping_min).toFixed(2)}</span>}
            </p>
          </div>
        )}
      </div>

      {/* Products section */}
      <div className="card overflow-hidden">
        <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Package size={16} /> Productos asignados ({items.length})
          </h3>
          <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs px-2 py-1 gap-1">
            <Plus size={14} /> Asignar Producto
          </button>
        </div>

        {/* Add product form */}
        {showAdd && (
          <div className="p-3 border-b bg-blue-50 space-y-2">
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4">
                <label className="text-xs font-medium">Producto</label>
                <select value={addItemId} onChange={e => setAddItemId(Number(e.target.value))} className="input text-sm">
                  <option value={0}>Seleccionar...</option>
                  {available.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium">Precio</label>
                <input type="number" step="0.01" value={addPrice} onChange={e => setAddPrice(e.target.value)}
                  className="input text-sm" placeholder="0.00" />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-1 text-xs font-medium cursor-pointer">
                  <input type="checkbox" checked={addIva} onChange={e => setAddIva(e.target.checked)} className="rounded" />
                  +IVA (16%)
                </label>
                {addPrice && (
                  <p className="text-xs text-gray-500 mt-1">
                    Final: ${(parseFloat(addPrice || '0') * (addIva ? 1.16 : 1)).toFixed(2)}
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium">Dias entrega</label>
                <input type="number" min={1} value={addDays} onChange={e => setAddDays(e.target.value)}
                  className="input text-sm" />
              </div>
              <div className="col-span-2 flex gap-1">
                <button onClick={handleAdd} disabled={!addItemId || !addPrice || linkLoading}
                  className="btn-primary text-xs px-3 py-2 flex-1">Asignar</button>
                <button onClick={() => setShowAdd(false)} className="btn-secondary text-xs px-2 py-2"><X size={14} /></button>
              </div>
            </div>
          </div>
        )}

        {/* Products table */}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Producto</th>
              <th className="text-left p-3">Unidad</th>
              <th className="text-right p-3">Precio (con IVA)</th>
              <th className="text-right p-3">Precio (sin IVA)</th>
              <th className="text-right p-3">Dias entrega</th>
              <th className="text-right p-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(i => (
              <tr key={i.item_id} className="hover:bg-gray-50">
                <td className="p-3 font-medium">{i.item_name}</td>
                <td className="p-3 text-gray-500">{i.unit}</td>
                <td className="p-3 text-right font-medium text-green-700">${Number(i.price).toFixed(2)}</td>
                <td className="p-3 text-right text-gray-400">${(Number(i.price) / 1.16).toFixed(2)}</td>
                <td className="p-3 text-right">{i.delivery_days || '-'} dias</td>
                <td className="p-3 text-right">
                  <button onClick={() => onUnlink(i.item_id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400">
                  <Link2 size={24} className="mx-auto mb-2 opacity-50" />
                  Sin productos asignados. Haz clic en "Asignar Producto" para comenzar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Supplier Form Modal ───

function SupplierFormModal({ form, editing, showBank, set, setShowBank, onClose, onSave, saving }: {
  form: any; editing: Supplier | null; showBank: boolean;
  set: (field: string, value: string) => void; setShowBank: (v: boolean) => void;
  onClose: () => void; onSave: () => void; saving: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">{editing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nombre *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="Nombre del proveedor" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Contacto</label>
              <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className="input" placeholder="Persona de contacto" />
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1"><Phone size={14} /> Telefono</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input" placeholder="Telefono" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium flex items-center gap-1"><Mail size={14} /> Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input" placeholder="email@ejemplo.com" />
            </div>
            <div>
              <label className="text-sm font-medium">WhatsApp</label>
              <input value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} className="input" placeholder="521234567890" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Direccion</label>
            <input value={form.address} onChange={e => set('address', e.target.value)} className="input" placeholder="Direccion" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium flex items-center gap-1"><Truck size={14} /> Costo de envio</label>
              <input type="number" step="0.01" value={form.shipping_cost || ''} onChange={e => set('shipping_cost', e.target.value)} className="input" placeholder="0.00" />
            </div>
            <div>
              <label className="text-sm font-medium">Envio gratis desde $</label>
              <input type="number" step="0.01" value={form.free_shipping_min || ''} onChange={e => set('free_shipping_min', e.target.value)} className="input" placeholder="0 = siempre cobra envio" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showBank} onChange={e => setShowBank(e.target.checked)} className="rounded" />
            <Building2 size={14} /> Datos bancarios
          </label>

          {showBank && (
            <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
              <div>
                <label className="text-xs font-medium">Banco</label>
                <input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className="input text-sm" placeholder="Banco" />
              </div>
              <div>
                <label className="text-xs font-medium">No. Cuenta</label>
                <input value={form.account_number} onChange={e => set('account_number', e.target.value)} className="input text-sm" placeholder="Cuenta" />
              </div>
              <div>
                <label className="text-xs font-medium">CLABE</label>
                <input value={form.clabe} onChange={e => set('clabe', e.target.value)} className="input text-sm" placeholder="CLABE" />
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Notas</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" placeholder="Notas adicionales" />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={onSave} disabled={!form.name || saving} className="btn-primary flex-1">
            {editing ? 'Guardar Cambios' : 'Crear Proveedor'}
          </button>
        </div>
      </div>
    </div>
  );
}
