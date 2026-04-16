import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import {
  Plus, X, ChefHat, Play, History, BookOpen, Trash2, Check, AlertTriangle,
  Package, FlaskConical,
} from 'lucide-react';

interface InvItem { id: number; name: string; unit: string; stock: string; current_cost: string; item_type: string; }
interface Ingredient { id?: number; inventory_item_id: number; item_name?: string; quantity: number; unit: string; item_stock?: number; item_cost?: number; }
interface Production { id: number; name: string; inventory_item_id: number; yield_quantity: string; yield_unit: string; estimated_cost: string; notes: string; current_stock: number; ingredients: Ingredient[]; }
interface LogEntry { id: number; production_name: string; batches: string; total_yield: string; total_cost: string; user_name: string; notes: string; created_at: string; ingredients: any[]; }
interface ProductWithRecipe { id: number; name: string; price: string; category: string; recipe_count: number; recipe: any[]; }

export default function ProduccionesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'recetas' | 'producir' | 'historial' | 'platillos'>('recetas');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const tabs = [
    { id: 'recetas' as const, label: 'Recetas de Producción', icon: FlaskConical },
    { id: 'producir' as const, label: 'Producir', icon: Play },
    { id: 'historial' as const, label: 'Historial', icon: History },
    { id: 'platillos' as const, label: 'Recetas de Platillo', icon: BookOpen },
  ];

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Producciones</h2>
        {tab === 'recetas' && (
          <button onClick={() => { setEditId(null); setShowForm(true); }} className="btn-primary text-sm gap-1">
            <Plus size={16} /> Nueva Producción
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              tab === t.id ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'recetas' && <RecetasTab onEdit={(id) => { setEditId(id); setShowForm(true); }} />}
      {tab === 'producir' && <ProducirTab />}
      {tab === 'historial' && <HistorialTab />}
      {tab === 'platillos' && <PlatillosTab />}

      {showForm && (
        <ProductionForm editId={editId} onClose={() => { setShowForm(false); setEditId(null); }} />
      )}
    </div>
  );
}

// ─── Tab: Recetas de Producción ───

function RecetasTab({ onEdit }: { onEdit: (id: number) => void }) {
  const qc = useQueryClient();
  const { data: productions = [] } = useQuery<Production[]>({
    queryKey: ['productions'],
    queryFn: () => api.get('/productions').then(r => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/productions/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['productions'] }); toast.success('Producción eliminada'); },
  });

  return (
    <div className="space-y-3">
      {productions.length === 0 && (
        <div className="card p-8 text-center text-gray-400">
          <FlaskConical size={40} className="mx-auto mb-2 opacity-50" />
          <p>Sin producciones. Crea tu primera receta.</p>
        </div>
      )}
      {productions.map(p => (
        <div key={p.id} className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ChefHat size={18} className="text-orange-500" />
                <span className="font-bold text-lg">{p.name}</span>
                <span className="text-sm text-gray-400">Rinde: {Number(p.yield_quantity)} {p.yield_unit}/lote</span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                <span>Stock actual: <strong className={Number(p.current_stock) <= 0 ? 'text-red-600' : 'text-green-600'}>{Number(p.current_stock).toFixed(1)} {p.yield_unit}</strong></span>
                <span>Costo/unidad: <strong>${Number(p.estimated_cost).toFixed(2)}</strong></span>
              </div>
              {p.ingredients.length > 0 && (
                <div className="mt-2 text-xs text-gray-400">
                  Ingredientes: {p.ingredients.map(i => `${i.item_name} (${Number(i.quantity)} ${i.unit})`).join(', ')}
                </div>
              )}
              {p.notes && <p className="text-xs text-gray-400 mt-1">{p.notes}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => onEdit(p.id)} className="btn-secondary text-xs px-3">Editar</button>
              <button onClick={() => { if (confirm('Eliminar?')) deleteMut.mutate(p.id); }}
                className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Producir ───

function ProducirTab() {
  const qc = useQueryClient();
  const [selectedProd, setSelectedProd] = useState<number>(0);
  const [batches, setBatches] = useState(1);
  const [notes, setNotes] = useState('');

  const { data: productions = [] } = useQuery<Production[]>({
    queryKey: ['productions'],
    queryFn: () => api.get('/productions').then(r => r.data),
  });

  const prod = productions.find(p => p.id === selectedProd);

  const executeMut = useMutation({
    mutationFn: () => api.post(`/productions/${selectedProd}/execute`, { batches, notes }),
    onSuccess: (res) => {
      const d = res.data;
      toast.success(`Producción lista: +${d.total_yield} ${prod?.yield_unit}. Costo: $${Number(d.total_cost).toFixed(2)}`);
      qc.invalidateQueries({ queryKey: ['productions'] });
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      qc.invalidateQueries({ queryKey: ['production-logs'] });
      setSelectedProd(0);
      setBatches(1);
      setNotes('');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al producir'),
  });

  return (
    <div className="card p-6 max-w-2xl space-y-4">
      <h3 className="font-bold text-lg flex items-center gap-2"><Play size={20} className="text-green-600" /> Registrar Producción</h3>

      <div>
        <label className="text-sm font-medium">Producción</label>
        <select value={selectedProd} onChange={e => setSelectedProd(Number(e.target.value))} className="input">
          <option value={0}>Seleccionar...</option>
          {productions.map(p => (
            <option key={p.id} value={p.id}>{p.name} (stock: {Number(p.current_stock).toFixed(1)} {p.yield_unit})</option>
          ))}
        </select>
      </div>

      {prod && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Lotes a producir</label>
              <input type="number" min={0.5} step={0.5} value={batches} onChange={e => setBatches(Number(e.target.value))} className="input" />
              <p className="text-xs text-gray-400 mt-1">= {(Number(prod.yield_quantity) * batches).toFixed(1)} {prod.yield_unit}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Notas (opcional)</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="Observaciones..." />
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Ingrediente</th>
                  <th className="text-right p-2">Necesario</th>
                  <th className="text-right p-2">En stock</th>
                  <th className="text-right p-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {prod.ingredients.map(ing => {
                  const needed = Number(ing.quantity) * batches;
                  const stock = Number(ing.item_stock || 0);
                  const ok = stock >= needed;
                  return (
                    <tr key={ing.inventory_item_id}>
                      <td className="p-2">{ing.item_name}</td>
                      <td className="p-2 text-right font-medium">{needed.toFixed(2)} {ing.unit}</td>
                      <td className="p-2 text-right">{stock.toFixed(2)} {ing.unit}</td>
                      <td className="p-2 text-right">
                        {ok
                          ? <Check size={16} className="text-green-500 inline" />
                          : <AlertTriangle size={16} className="text-red-500 inline" />
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span>Producción total:</span>
              <strong>{(Number(prod.yield_quantity) * batches).toFixed(1)} {prod.yield_unit}</strong>
            </div>
            <div className="flex justify-between">
              <span>Costo estimado:</span>
              <strong>${(Number(prod.estimated_cost) * Number(prod.yield_quantity) * batches).toFixed(2)}</strong>
            </div>
          </div>

          <button onClick={() => executeMut.mutate()} disabled={executeMut.isPending}
            className="btn-primary w-full gap-2 py-3">
            <ChefHat size={18} /> {executeMut.isPending ? 'Produciendo...' : 'Confirmar Producción'}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Tab: Historial ───

function HistorialTab() {
  const { data: logs = [] } = useQuery<LogEntry[]>({
    queryKey: ['production-logs'],
    queryFn: () => api.get('/productions/logs').then(r => r.data),
  });
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left p-3">Fecha</th>
            <th className="text-left p-3">Producción</th>
            <th className="text-right p-3">Lotes</th>
            <th className="text-right p-3">Rendimiento</th>
            <th className="text-right p-3">Costo</th>
            <th className="text-left p-3">Usuario</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {logs.map(log => (
            <>
              <tr key={log.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                <td className="p-3 text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleDateString('es-MX')} {new Date(log.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</td>
                <td className="p-3 font-medium">{log.production_name}</td>
                <td className="p-3 text-right">{Number(log.batches)}</td>
                <td className="p-3 text-right">{Number(log.total_yield).toFixed(1)}</td>
                <td className="p-3 text-right font-medium">${Number(log.total_cost).toFixed(2)}</td>
                <td className="p-3 text-gray-500">{log.user_name || '-'}</td>
              </tr>
              {expandedLog === log.id && (
                <tr key={`${log.id}-detail`}>
                  <td colSpan={6} className="p-3 bg-gray-50">
                    <div className="text-xs space-y-1">
                      <p className="font-medium text-gray-600">Ingredientes usados:</p>
                      {log.ingredients.map((ing: any, i: number) => (
                        <div key={i} className="flex justify-between max-w-md">
                          <span>{ing.item_name}</span>
                          <span>{Number(ing.quantity_used).toFixed(2)} {ing.unit} (${(Number(ing.quantity_used) * Number(ing.unit_cost)).toFixed(2)})</span>
                        </div>
                      ))}
                      {log.notes && <p className="text-gray-400 mt-1">Notas: {log.notes}</p>}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
          {logs.length === 0 && (
            <tr><td colSpan={6} className="p-8 text-center text-gray-400">Sin producciones registradas</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab: Recetas de Platillo ───

function PlatillosTab() {
  const qc = useQueryClient();
  const [editProduct, setEditProduct] = useState<number | null>(null);

  const { data: products = [] } = useQuery<ProductWithRecipe[]>({
    queryKey: ['product-recipes'],
    queryFn: () => api.get('/product-recipes').then(r => r.data),
  });

  const { data: invItems = [] } = useQuery<InvItem[]>({
    queryKey: ['inventory-items-all'],
    queryFn: () => api.get('/inventory/items').then(r => r.data),
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Define qué insumos/producciones consume cada platillo al venderse.</p>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Producto</th>
              <th className="text-left p-3">Categoría</th>
              <th className="text-left p-3">Receta</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3 text-gray-500">{p.category}</td>
                <td className="p-3 text-xs text-gray-400">
                  {p.recipe_count > 0
                    ? p.recipe.map((r: any) => `${r.item_name} (${Number(r.quantity)} ${r.unit})`).join(', ')
                    : <span className="text-yellow-500">Sin receta</span>
                  }
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => setEditProduct(p.id)} className="btn-secondary text-xs px-3">
                    {p.recipe_count > 0 ? 'Editar' : 'Definir'} Receta
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editProduct && (
        <RecipeEditor productId={editProduct} invItems={invItems}
          onClose={() => { setEditProduct(null); qc.invalidateQueries({ queryKey: ['product-recipes'] }); }} />
      )}
    </div>
  );
}

// ─── Recipe Editor Modal ───

function RecipeEditor({ productId, invItems, onClose }: {
  productId: number; invItems: InvItem[]; onClose: () => void;
}) {
  const [ingredients, setIngredients] = useState<{ inventory_item_id: number; quantity: number; unit: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/product-recipes/${productId}`).then(r => {
      setIngredients(r.data.map((i: any) => ({
        inventory_item_id: i.inventory_item_id, quantity: Number(i.quantity), unit: i.unit,
      })));
      setLoading(false);
    });
  }, [productId]);

  const saveMut = useMutation({
    mutationFn: () => api.put(`/product-recipes/${productId}`, { ingredients }),
    onSuccess: () => { toast.success('Receta guardada'); onClose(); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const addIngredient = () => setIngredients(prev => [...prev, { inventory_item_id: 0, quantity: 0, unit: '' }]);
  const removeIngredient = (idx: number) => setIngredients(prev => prev.filter((_, i) => i !== idx));

  // Filter to only show insumos and producciones (not sale products)
  const availableItems = invItems.filter(i => i.item_type === 'insumo' || i.item_type === 'produccion');

  if (loading) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">Receta de Consumo por Unidad Vendida</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <p className="text-sm text-gray-500">Define cuánto de cada insumo/producción se consume al vender 1 unidad de este producto.</p>

        {ingredients.map((ing, idx) => {
          const item = invItems.find(i => i.id === ing.inventory_item_id);
          return (
            <div key={idx} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium">Insumo/Producción</label>
                <select value={ing.inventory_item_id} onChange={e => {
                  const newId = Number(e.target.value);
                  const newItem = invItems.find(i => i.id === newId);
                  setIngredients(prev => prev.map((p, i) => i === idx ? { ...p, inventory_item_id: newId, unit: newItem?.unit || p.unit } : p));
                }} className="input">
                  <option value={0}>Seleccionar...</option>
                  {availableItems.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.unit}) {i.item_type === 'produccion' ? '[PROD]' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="text-xs font-medium">Cantidad</label>
                <input type="number" min={0} step={0.001} value={ing.quantity}
                  onChange={e => setIngredients(prev => prev.map((p, i) => i === idx ? { ...p, quantity: Number(e.target.value) } : p))}
                  className="input" />
              </div>
              <div className="w-20">
                <label className="text-xs font-medium">Unidad</label>
                <input value={ing.unit} onChange={e => setIngredients(prev => prev.map((p, i) => i === idx ? { ...p, unit: e.target.value } : p))}
                  className="input" placeholder={item?.unit || 'kg'} />
              </div>
              <button onClick={() => removeIngredient(idx)} className="text-red-400 hover:text-red-600 pb-2"><X size={16} /></button>
            </div>
          );
        })}

        <button onClick={addIngredient} className="btn-secondary text-sm gap-1 w-full">
          <Plus size={14} /> Agregar Ingrediente
        </button>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="btn-primary flex-1 gap-1">
            <Check size={16} /> {saveMut.isPending ? 'Guardando...' : 'Guardar Receta'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Production Form Modal ───

function ProductionForm({ editId, onClose }: { editId: number | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [yieldQty, setYieldQty] = useState(1);
  const [yieldUnit, setYieldUnit] = useState('kg');
  const [notes, setNotes] = useState('');
  const [ingredients, setIngredients] = useState<{ inventory_item_id: number; quantity: number; unit: string }[]>([]);
  const [loading, setLoading] = useState(!!editId);

  const { data: invItems = [] } = useQuery<InvItem[]>({
    queryKey: ['inventory-items-all'],
    queryFn: () => api.get('/inventory/items').then(r => r.data),
  });

  const insumos = invItems.filter(i => i.item_type === 'insumo');

  useEffect(() => {
    if (editId) {
      api.get(`/productions/${editId}`).then(r => {
        const p = r.data;
        setName(p.name);
        setYieldQty(Number(p.yield_quantity));
        setYieldUnit(p.yield_unit);
        setNotes(p.notes || '');
        setIngredients(p.ingredients.map((i: any) => ({
          inventory_item_id: i.inventory_item_id, quantity: Number(i.quantity), unit: i.unit,
        })));
        setLoading(false);
      });
    }
  }, [editId]);

  const saveMut = useMutation({
    mutationFn: () => {
      const data = { name, yield_quantity: yieldQty, yield_unit: yieldUnit, notes, ingredients };
      return editId ? api.put(`/productions/${editId}`, data) : api.post('/productions', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productions'] });
      toast.success(editId ? 'Producción actualizada' : 'Producción creada');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const addIngredient = () => setIngredients(prev => [...prev, { inventory_item_id: 0, quantity: 0, unit: '' }]);
  const removeIngredient = (idx: number) => setIngredients(prev => prev.filter((_, i) => i !== idx));

  // Calculate estimated cost
  const estCost = ingredients.reduce((sum, ing) => {
    const item = invItems.find(i => i.id === ing.inventory_item_id);
    return sum + ing.quantity * Number(item?.current_cost || 0);
  }, 0);

  if (loading) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">{editId ? 'Editar' : 'Nueva'} Producción</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3">
            <label className="text-sm font-medium">Nombre *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Ej: Salsa Verde" />
          </div>
          <div>
            <label className="text-sm font-medium">Rendimiento por lote *</label>
            <input type="number" min={0.1} step={0.1} value={yieldQty} onChange={e => setYieldQty(Number(e.target.value))} className="input" />
          </div>
          <div>
            <label className="text-sm font-medium">Unidad *</label>
            <select value={yieldUnit} onChange={e => setYieldUnit(e.target.value)} className="input">
              <option>kg</option><option>lt</option><option>pz</option><option>gr</option><option>ml</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Costo estimado/unidad</label>
            <div className="input bg-gray-50 text-gray-600">${yieldQty > 0 ? (estCost / yieldQty).toFixed(2) : '0.00'}</div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Notas</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="Observaciones opcionales..." />
        </div>

        <div>
          <label className="text-sm font-medium">Ingredientes (Insumos) *</label>
          {ingredients.map((ing, idx) => {
            const item = insumos.find(i => i.id === ing.inventory_item_id);
            return (
              <div key={idx} className="flex gap-2 items-end mt-2">
                <div className="flex-1">
                  <select value={ing.inventory_item_id} onChange={e => {
                    const newId = Number(e.target.value);
                    const newItem = insumos.find(i => i.id === newId);
                    setIngredients(prev => prev.map((p, i) => i === idx ? { ...p, inventory_item_id: newId, unit: newItem?.unit || p.unit } : p));
                  }} className="input">
                    <option value={0}>Seleccionar insumo...</option>
                    {insumos.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.unit}) - stock: {Number(i.stock).toFixed(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <input type="number" min={0} step={0.01} value={ing.quantity} placeholder="Cant."
                    onChange={e => setIngredients(prev => prev.map((p, i) => i === idx ? { ...p, quantity: Number(e.target.value) } : p))}
                    className="input" />
                </div>
                <div className="w-16 text-sm text-gray-500 pb-2">{item?.unit || ing.unit || '-'}</div>
                <button onClick={() => removeIngredient(idx)} className="text-red-400 hover:text-red-600 pb-2"><Trash2 size={16} /></button>
              </div>
            );
          })}
          <button onClick={addIngredient} className="btn-secondary text-xs mt-2 gap-1">
            <Plus size={14} /> Agregar Ingrediente
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <div className="flex justify-between">
            <span>Costo total del lote:</span>
            <strong>${estCost.toFixed(2)}</strong>
          </div>
          <div className="flex justify-between">
            <span>Costo por {yieldUnit}:</span>
            <strong>${yieldQty > 0 ? (estCost / yieldQty).toFixed(2) : '0.00'}</strong>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !name || ingredients.length === 0}
            className="btn-primary flex-1 gap-1">
            <Check size={16} /> {saveMut.isPending ? 'Guardando...' : editId ? 'Actualizar' : 'Crear Producción'}
          </button>
        </div>
      </div>
    </div>
  );
}
