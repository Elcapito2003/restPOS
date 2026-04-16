import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { Plus, Package, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Trash2, Link2, X, Tag, PackagePlus, FlaskConical } from 'lucide-react';

interface Item {
  id: number;
  name: string;
  unit: string;
  units_per_package: number;
  unit_content: string;
  current_cost: number;
  stock: number;
  stock_min: number;
  item_type: string;
  suppliers: { supplier_id: number; supplier_name: string; price: number; delivery_days: number }[];
}

interface Supplier { id: number; name: string; }

export default function InventarioPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'items' | 'movements' | 'purchases' | 'presentations'>('items');
  const [showItemForm, setShowItemForm] = useState(false);
  const [showMovForm, setShowMovForm] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [showPresForm, setShowPresForm] = useState(false);
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [itemTypeFilter, setItemTypeFilter] = useState<'insumo' | 'produccion'>('insumo');
  // Presentation form
  const [presForm, setPresForm] = useState({ item_id: '', brand: '', description: '', content_quantity: '', content_unit: '', reference_price: '' });
  // Receive by presentation form
  const [recvForm, setRecvForm] = useState({ presentation_id: '', pieces: '1' });

  // Item form state
  const [itemForm, setItemForm] = useState({ name: '', unit: '', units_per_package: '1', unit_content: '', stock_min: '0' });
  // Movement form state
  const [movForm, setMovForm] = useState({ item_id: '', type: 'entrada', quantity: '', reason: '' });
  // Link supplier form state
  const [linkForm, setLinkForm] = useState({ item_id: '', supplier_id: '', price: '', delivery_days: '1' });
  // Purchase form state
  const [purchForm, setPurchForm] = useState({ item_id: '', supplier_id: '', quantity: '', unit_cost: '', tax_percent: '16' });
  // Purchase date filter
  const today = dayjs().format('YYYY-MM-DD');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data: items } = useQuery<Item[]>({
    queryKey: ['inventory-items'],
    queryFn: () => api.get('/inventory/items').then(r => r.data),
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers').then(r => r.data),
  });

  const { data: movements } = useQuery({
    queryKey: ['inventory-movements'],
    queryFn: () => api.get('/inventory/movements').then(r => r.data),
  });

  const { data: purchases } = useQuery({
    queryKey: ['purchases', startDate, endDate],
    queryFn: () => api.get('/inventory/purchases', { params: { start: startDate, end: endDate } }).then(r => r.data),
  });

  const { data: presentations } = useQuery({
    queryKey: ['presentations'],
    queryFn: () => api.get('/inventory/presentations').then(r => r.data),
  });

  const createPresMut = useMutation({
    mutationFn: (data: any) => api.post('/inventory/presentations', data),
    onSuccess: () => { invalidateAll(); qc.invalidateQueries({ queryKey: ['presentations'] }); setShowPresForm(false); setPresForm({ item_id: '', brand: '', description: '', content_quantity: '', content_unit: '', reference_price: '' }); toast.success('Presentación creada'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  });

  const deletePresMut = useMutation({
    mutationFn: (id: number) => api.delete(`/inventory/presentations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['presentations'] }); toast.success('Presentación eliminada'); },
  });

  const receiveMut = useMutation({
    mutationFn: (data: any) => api.post('/inventory/receive-by-presentation', data),
    onSuccess: (res) => { invalidateAll(); setShowReceiveForm(false); setRecvForm({ presentation_id: '', pieces: '1' }); toast.success(res.data.message); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  });

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => api.get('/inventory/low-stock').then(r => r.data),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['inventory-items'] });
    qc.invalidateQueries({ queryKey: ['inventory-movements'] });
    qc.invalidateQueries({ queryKey: ['purchases'] });
    qc.invalidateQueries({ queryKey: ['low-stock'] });
  };

  const createItemMut = useMutation({
    mutationFn: (data: any) => api.post('/inventory/items', data),
    onSuccess: () => { invalidateAll(); setShowItemForm(false); setItemForm({ name: '', unit: '', units_per_package: '1', unit_content: '', stock_min: '0' }); toast.success('Insumo creado'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  });

  const createMovMut = useMutation({
    mutationFn: (data: any) => api.post('/inventory/movements', data),
    onSuccess: () => { invalidateAll(); setShowMovForm(false); setMovForm({ item_id: '', type: 'entrada', quantity: '', reason: '' }); toast.success('Movimiento registrado'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  });

  const linkMut = useMutation({
    mutationFn: (data: any) => api.post('/inventory/item-suppliers', data),
    onSuccess: () => { invalidateAll(); setShowLinkForm(false); setLinkForm({ item_id: '', supplier_id: '', price: '', delivery_days: '1' }); toast.success('Proveedor asignado'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  });

  const purchaseMut = useMutation({
    mutationFn: (data: any) => api.post('/inventory/purchases', data),
    onSuccess: () => { invalidateAll(); setShowPurchaseForm(false); setPurchForm({ item_id: '', supplier_id: '', quantity: '', unit_cost: '', tax_percent: '16' }); toast.success('Compra registrada'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error'),
  });

  const deleteItemMut = useMutation({
    mutationFn: (id: number) => api.delete(`/inventory/items/${id}`),
    onSuccess: () => { invalidateAll(); toast.success('Insumo eliminado'); },
  });

  const tabs = [
    { key: 'items', label: 'Insumos', icon: Package },
    { key: 'presentations', label: 'Presentaciones', icon: Tag },
    { key: 'movements', label: 'Movimientos', icon: ArrowUpCircle },
    { key: 'purchases', label: 'Compras', icon: ArrowDownCircle },
  ] as const;

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Inventario</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowReceiveForm(true)} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-green-700"><PackagePlus size={16} /> Recibir Mercancía</button>
          <button onClick={() => setShowPurchaseForm(true)} className="btn-primary gap-1 text-sm"><ArrowDownCircle size={16} /> Registrar Compra</button>
          <button onClick={() => setShowMovForm(true)} className="btn-secondary gap-1 text-sm"><ArrowUpCircle size={16} /> Movimiento</button>
          <button onClick={() => setShowItemForm(true)} className="btn-secondary gap-1 text-sm"><Plus size={16} /> Nuevo Insumo</button>
        </div>
      </div>

      {/* Low stock alerts */}
      {lowStock && lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
            <AlertTriangle size={18} /> Stock Bajo ({lowStock.length} insumos)
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((i: any) => (
              <span key={i.id} className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs">
                {i.name}: {parseFloat(i.stock).toFixed(1)} / {parseFloat(i.stock_min).toFixed(1)} {i.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Items Tab */}
      {tab === 'items' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setItemTypeFilter('insumo')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                itemTypeFilter === 'insumo' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              <Package size={16} /> Insumos ({items?.filter(i => (i.item_type || 'insumo') === 'insumo').length || 0})
            </button>
            <button onClick={() => setItemTypeFilter('produccion')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                itemTypeFilter === 'produccion' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              <FlaskConical size={16} /> Producciones ({items?.filter(i => i.item_type === 'produccion').length || 0})
            </button>
          </div>
          <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">{itemTypeFilter === 'insumo' ? 'Insumo' : 'Producción'}</th>
                <th className="text-left p-3">Unidad</th>
                <th className="text-right p-3">Stock</th>
                <th className="text-right p-3">Mínimo</th>
                <th className="text-right p-3">Costo</th>
                <th className="text-left p-3">{itemTypeFilter === 'insumo' ? 'Proveedores' : 'Tipo'}</th>
                <th className="text-right p-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items?.filter(i => (i.item_type || 'insumo') === itemTypeFilter).map(i => {
                const isLow = i.stock_min > 0 && parseFloat(String(i.stock)) <= parseFloat(String(i.stock_min));
                return (
                  <tr key={i.id} className={`hover:bg-gray-50 ${isLow ? 'bg-red-50' : ''}`}>
                    <td className="p-3 font-medium">{i.name}</td>
                    <td className="p-3 text-gray-500">{i.units_per_package > 1 ? `${i.units_per_package}x${i.unit_content || i.unit}` : i.unit}</td>
                    <td className={`p-3 text-right font-medium ${isLow ? 'text-red-600' : ''}`}>{parseFloat(String(i.stock)).toFixed(1)}</td>
                    <td className="p-3 text-right text-gray-400">{parseFloat(String(i.stock_min)).toFixed(1)}</td>
                    <td className="p-3 text-right">${parseFloat(String(i.current_cost)).toFixed(2)}</td>
                    <td className="p-3 text-xs text-gray-500">
                      {i.suppliers?.length > 0
                        ? i.suppliers.map((s: any) => `${s.supplier_name} ($${s.price})`).join(', ')
                        : <button onClick={() => { setLinkForm({ ...linkForm, item_id: String(i.id) }); setShowLinkForm(true); }} className="text-blue-600 hover:underline flex items-center gap-1"><Link2 size={12} /> Asignar</button>
                      }
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={() => { setLinkForm({ ...linkForm, item_id: String(i.id) }); setShowLinkForm(true); }} className="text-blue-600 hover:text-blue-800 mr-2"><Link2 size={16} /></button>
                      <button onClick={() => { if (confirm('¿Eliminar?')) deleteItemMut.mutate(i.id); }} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                );
              })}
              {(!items || items.filter(i => (i.item_type || 'insumo') === itemTypeFilter).length === 0) && (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">{itemTypeFilter === 'insumo' ? 'Sin insumos registrados' : 'Sin producciones registradas'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Movements Tab */}
      {tab === 'movements' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">Fecha</th>
                <th className="text-left p-3">Insumo</th>
                <th className="text-left p-3">Tipo</th>
                <th className="text-right p-3">Cantidad</th>
                <th className="text-left p-3">Motivo</th>
                <th className="text-left p-3">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {movements?.map((m: any) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="p-3 text-gray-500">{dayjs(m.created_at).format('DD/MM HH:mm')}</td>
                  <td className="p-3 font-medium">{m.item_name}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.type === 'entrada' ? 'bg-green-100 text-green-700' :
                      m.type === 'salida' ? 'bg-blue-100 text-blue-700' :
                      m.type === 'merma' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {m.type}
                    </span>
                  </td>
                  <td className={`p-3 text-right font-medium ${m.type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                    {m.type === 'entrada' ? '+' : '-'}{parseFloat(m.quantity).toFixed(1)} {m.unit}
                  </td>
                  <td className="p-3 text-gray-500">{m.reason || '-'}</td>
                  <td className="p-3">{m.display_name || '-'}</td>
                </tr>
              ))}
              {(!movements || movements.length === 0) && (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Sin movimientos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Purchases Tab */}
      {tab === 'purchases' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Desde:</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input w-auto" />
            <label className="text-sm font-medium">Hasta:</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input w-auto" />
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-left p-3">Insumo</th>
                  <th className="text-left p-3">Proveedor</th>
                  <th className="text-right p-3">Cantidad</th>
                  <th className="text-right p-3">Costo/Ud</th>
                  <th className="text-right p-3">IVA%</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-left p-3">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchases?.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-500">{dayjs(p.created_at).format('DD/MM HH:mm')}</td>
                    <td className="p-3 font-medium">{p.item_name}</td>
                    <td className="p-3">{p.supplier_name || '-'}</td>
                    <td className="p-3 text-right">{parseFloat(p.quantity).toFixed(1)}</td>
                    <td className="p-3 text-right">${parseFloat(p.unit_cost).toFixed(2)}</td>
                    <td className="p-3 text-right">{p.tax_percent}%</td>
                    <td className="p-3 text-right font-medium">${parseFloat(p.total).toFixed(2)}</td>
                    <td className="p-3">{p.display_name || '-'}</td>
                  </tr>
                ))}
                {(!purchases || purchases.length === 0) && (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400">Sin compras en este período</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Presentations Tab */}
      {tab === 'presentations' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowPresForm(true)} className="btn-primary gap-1 text-sm"><Plus size={16} /> Nueva Presentación</button>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">Insumo</th>
                  <th className="text-left p-3">Marca</th>
                  <th className="text-left p-3">Descripción</th>
                  <th className="text-right p-3">Contenido</th>
                  <th className="text-right p-3">Precio Ref.</th>
                  <th className="text-right p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {presentations?.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium">{p.item_name}</td>
                    <td className="p-3">{p.brand || '-'}</td>
                    <td className="p-3 text-gray-500">{p.description || '-'}</td>
                    <td className="p-3 text-right font-medium">{Number(p.content_quantity)} {p.content_unit}</td>
                    <td className="p-3 text-right">{Number(p.reference_price) > 0 ? `$${Number(p.reference_price).toFixed(2)}` : '-'}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => { if (confirm('¿Eliminar?')) deletePresMut.mutate(p.id); }} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {(!presentations || presentations.length === 0) && (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">Sin presentaciones. El admin debe crearlas para que los empleados puedan recibir mercancía.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Item Modal */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3">
            <div className="flex justify-between items-center"><h3 className="font-bold">Nuevo Insumo</h3><button onClick={() => setShowItemForm(false)}><X size={20} /></button></div>
            <input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} className="input" placeholder="Nombre del insumo *" />
            <div className="grid grid-cols-2 gap-3">
              <input value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })} className="input" placeholder="Unidad (kg, L, pza) *" />
              <input type="number" value={itemForm.stock_min} onChange={e => setItemForm({ ...itemForm, stock_min: e.target.value })} className="input" placeholder="Stock mínimo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={itemForm.units_per_package} onChange={e => setItemForm({ ...itemForm, units_per_package: e.target.value })} className="input" placeholder="Uds/Paquete" />
              <input value={itemForm.unit_content} onChange={e => setItemForm({ ...itemForm, unit_content: e.target.value })} className="input" placeholder="Contenido/Ud" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowItemForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => createItemMut.mutate({ name: itemForm.name, unit: itemForm.unit, units_per_package: parseInt(itemForm.units_per_package) || 1, unit_content: itemForm.unit_content || undefined, stock_min: parseFloat(itemForm.stock_min) || 0 })} disabled={!itemForm.name || !itemForm.unit} className="btn-primary flex-1">Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showMovForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3">
            <div className="flex justify-between items-center"><h3 className="font-bold">Registrar Movimiento</h3><button onClick={() => setShowMovForm(false)}><X size={20} /></button></div>
            <select value={movForm.item_id} onChange={e => setMovForm({ ...movForm, item_id: e.target.value })} className="input">
              <option value="">Seleccionar insumo</option>
              {items?.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
            <select value={movForm.type} onChange={e => setMovForm({ ...movForm, type: e.target.value })} className="input">
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="merma">Merma</option>
              <option value="ajuste">Ajuste</option>
            </select>
            <input type="number" value={movForm.quantity} onChange={e => setMovForm({ ...movForm, quantity: e.target.value })} className="input" placeholder="Cantidad" step="0.1" />
            <input value={movForm.reason} onChange={e => setMovForm({ ...movForm, reason: e.target.value })} className="input" placeholder="Motivo (opcional)" />
            <div className="flex gap-2">
              <button onClick={() => setShowMovForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => createMovMut.mutate({ item_id: parseInt(movForm.item_id), type: movForm.type, quantity: parseFloat(movForm.quantity), reason: movForm.reason || undefined })} disabled={!movForm.item_id || !movForm.quantity} className="btn-primary flex-1">Registrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Link Supplier Modal */}
      {showLinkForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3">
            <div className="flex justify-between items-center"><h3 className="font-bold">Asignar Proveedor</h3><button onClick={() => setShowLinkForm(false)}><X size={20} /></button></div>
            <select value={linkForm.item_id} onChange={e => setLinkForm({ ...linkForm, item_id: e.target.value })} className="input">
              <option value="">Seleccionar insumo</option>
              {items?.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <select value={linkForm.supplier_id} onChange={e => setLinkForm({ ...linkForm, supplier_id: e.target.value })} className="input">
              <option value="">Seleccionar proveedor</option>
              {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={linkForm.price} onChange={e => setLinkForm({ ...linkForm, price: e.target.value })} className="input" placeholder="Precio" step="0.01" />
              <input type="number" value={linkForm.delivery_days} onChange={e => setLinkForm({ ...linkForm, delivery_days: e.target.value })} className="input" placeholder="Días entrega" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowLinkForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => linkMut.mutate({ item_id: parseInt(linkForm.item_id), supplier_id: parseInt(linkForm.supplier_id), price: parseFloat(linkForm.price), delivery_days: parseInt(linkForm.delivery_days) || 1 })} disabled={!linkForm.item_id || !linkForm.supplier_id || !linkForm.price} className="btn-primary flex-1">Asignar</button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      {showPurchaseForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3">
            <div className="flex justify-between items-center"><h3 className="font-bold">Registrar Compra</h3><button onClick={() => setShowPurchaseForm(false)}><X size={20} /></button></div>
            <select value={purchForm.item_id} onChange={e => setPurchForm({ ...purchForm, item_id: e.target.value })} className="input">
              <option value="">Seleccionar insumo</option>
              {items?.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
            <select value={purchForm.supplier_id} onChange={e => setPurchForm({ ...purchForm, supplier_id: e.target.value })} className="input">
              <option value="">Seleccionar proveedor</option>
              {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={purchForm.quantity} onChange={e => setPurchForm({ ...purchForm, quantity: e.target.value })} className="input" placeholder="Cantidad" step="0.1" />
              <input type="number" value={purchForm.unit_cost} onChange={e => setPurchForm({ ...purchForm, unit_cost: e.target.value })} className="input" placeholder="Costo/Ud" step="0.01" />
            </div>
            <input type="number" value={purchForm.tax_percent} onChange={e => setPurchForm({ ...purchForm, tax_percent: e.target.value })} className="input" placeholder="IVA %" />
            {purchForm.quantity && purchForm.unit_cost && (
              <div className="text-right text-lg font-bold text-green-600">
                Total: ${(parseFloat(purchForm.quantity) * parseFloat(purchForm.unit_cost) * (1 + (parseFloat(purchForm.tax_percent) || 0) / 100)).toFixed(2)}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowPurchaseForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => purchaseMut.mutate({ item_id: parseInt(purchForm.item_id), supplier_id: purchForm.supplier_id ? parseInt(purchForm.supplier_id) : undefined, quantity: parseFloat(purchForm.quantity), unit_cost: parseFloat(purchForm.unit_cost), tax_percent: parseFloat(purchForm.tax_percent) || 16 })} disabled={!purchForm.item_id || !purchForm.quantity || !purchForm.unit_cost} className="btn-primary flex-1">Registrar Compra</button>
            </div>
          </div>
        </div>
      )}
      {/* New Presentation Modal */}
      {showPresForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3">
            <div className="flex justify-between items-center"><h3 className="font-bold">Nueva Presentación</h3><button onClick={() => setShowPresForm(false)}><X size={20} /></button></div>
            <select value={presForm.item_id} onChange={e => setPresForm({ ...presForm, item_id: e.target.value })} className="input">
              <option value="">Seleccionar insumo</option>
              {items?.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
            <input value={presForm.brand} onChange={e => setPresForm({ ...presForm, brand: e.target.value })} className="input" placeholder="Marca (ej: La Costeña)" />
            <input value={presForm.description} onChange={e => setPresForm({ ...presForm, description: e.target.value })} className="input" placeholder="Descripción (ej: Botella 1 lt)" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={presForm.content_quantity} onChange={e => setPresForm({ ...presForm, content_quantity: e.target.value })} className="input" placeholder="Contenido" step="0.001" />
              <input value={presForm.content_unit} onChange={e => setPresForm({ ...presForm, content_unit: e.target.value })} className="input" placeholder="Unidad (kg, lt, pz)" />
            </div>
            <input type="number" value={presForm.reference_price} onChange={e => setPresForm({ ...presForm, reference_price: e.target.value })} className="input" placeholder="Precio referencia (opcional)" step="0.01" />
            <div className="flex gap-2">
              <button onClick={() => setShowPresForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => createPresMut.mutate({
                item_id: parseInt(presForm.item_id), brand: presForm.brand || undefined,
                description: presForm.description || undefined,
                content_quantity: parseFloat(presForm.content_quantity),
                content_unit: presForm.content_unit,
                reference_price: presForm.reference_price ? parseFloat(presForm.reference_price) : undefined,
              })} disabled={!presForm.item_id || !presForm.content_quantity || !presForm.content_unit}
                className="btn-primary flex-1">Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Receive by Presentation Modal */}
      {showReceiveForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3">
            <div className="flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><PackagePlus size={20} className="text-green-600" /> Recibir Mercancía</h3><button onClick={() => setShowReceiveForm(false)}><X size={20} /></button></div>
            <p className="text-sm text-gray-500">Selecciona la presentación y cuántas piezas recibiste.</p>
            <select value={recvForm.presentation_id} onChange={e => setRecvForm({ ...recvForm, presentation_id: e.target.value })} className="input">
              <option value="">Seleccionar presentación...</option>
              {presentations?.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.item_name} — {p.brand || 'Sin marca'} {Number(p.content_quantity)} {p.content_unit}
                </option>
              ))}
            </select>
            <div>
              <label className="text-sm font-medium">Piezas recibidas</label>
              <input type="number" min={1} value={recvForm.pieces} onChange={e => setRecvForm({ ...recvForm, pieces: e.target.value })} className="input" />
            </div>
            {recvForm.presentation_id && recvForm.pieces && (
              <div className="bg-green-50 rounded-lg p-3 text-sm">
                {(() => {
                  const p = presentations?.find((x: any) => x.id === parseInt(recvForm.presentation_id));
                  if (!p) return null;
                  const total = Number(p.content_quantity) * parseInt(recvForm.pieces);
                  return (
                    <div className="flex justify-between font-medium text-green-700">
                      <span>Entrada al inventario:</span>
                      <span>+{total.toFixed(2)} {p.content_unit} de {p.item_name}</span>
                    </div>
                  );
                })()}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowReceiveForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => receiveMut.mutate({
                presentation_id: parseInt(recvForm.presentation_id),
                pieces: parseInt(recvForm.pieces),
              })} disabled={!recvForm.presentation_id || !recvForm.pieces || receiveMut.isPending}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex-1 hover:bg-green-700">
                {receiveMut.isPending ? 'Procesando...' : 'Confirmar Recepción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
