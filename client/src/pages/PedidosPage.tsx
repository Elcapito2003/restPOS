import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import {
  Plus, Send, X, Package, MessageCircle,
  AlertTriangle, Check, Truck, XCircle, Clock, Wifi, WifiOff,
} from 'lucide-react';

interface OrderItem {
  id?: number; item_id: number; item_name: string;
  quantity: number; unit?: string; estimated_price?: number; confirmed_price?: number;
}
interface Order {
  id: number; supplier_id: number; supplier_name: string; supplier_phone: string;
  status: string; notes: string; estimated_total: string; confirmed_total: string;
  created_by_name: string; items: OrderItem[];
  sent_at: string; confirmed_at: string; received_at: string; created_at: string;
}
interface Message {
  id: number; order_id: number; supplier_id: number;
  direction: 'out' | 'in'; message: string; phone: string;
  status: string; created_at: string;
}
interface Supplier { id: number; name: string; whatsapp: string; }
interface InvItem { id: number; name: string; unit: string; stock: string; stock_min: string; current_cost: string; suppliers: any[]; }

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft:     { label: 'Borrador',   color: 'bg-gray-100 text-gray-700',   icon: Clock },
  sent:      { label: 'Enviado',    color: 'bg-blue-100 text-blue-700',   icon: Send },
  confirmed: { label: 'Confirmado', color: 'bg-yellow-100 text-yellow-700', icon: Check },
  received:  { label: 'Recibido',   color: 'bg-green-100 text-green-700', icon: Truck },
  cancelled: { label: 'Cancelado',  color: 'bg-red-100 text-red-700',     icon: XCircle },
};

export default function PedidosPage() {
  const qc = useQueryClient();
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const chatEnd = useRef<HTMLDivElement>(null);

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['purchasing-orders'],
    queryFn: () => api.get('/purchasing/orders').then(r => r.data),
    refetchInterval: 15000,
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers').then(r => r.data),
  });

  const { data: invItems = [] } = useQuery<InvItem[]>({
    queryKey: ['inventory-items'],
    queryFn: () => api.get('/inventory/items').then(r => r.data),
  });

  const { data: clawStatus } = useQuery({
    queryKey: ['openclaw-status'],
    queryFn: () => api.get('/purchasing/openclaw-status').then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['purchasing-conversation', selectedSupplierId],
    queryFn: () => api.get(`/purchasing/conversation/${selectedSupplierId}`).then(r => r.data),
    enabled: !!selectedSupplierId,
    refetchInterval: 10000,
  });

  // Sidebar: suppliers with WhatsApp
  const suppliersWithWa = suppliers.filter(s => s.whatsapp);
  const supplierSidebar = suppliersWithWa.map(s => {
    const so = orders.filter(o => o.supplier_id === s.id);
    const activeOrder = so.find(o => ['draft', 'sent', 'confirmed'].includes(o.status));
    const lastOrder = so[0];
    return { ...s, activeOrder, lastOrder, orderCount: so.length };
  });

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId) || null;
  const supplierOrders = orders.filter(o => o.supplier_id === selectedSupplierId);
  const activeOrder = supplierOrders.find(o => ['draft', 'sent', 'confirmed'].includes(o.status));

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Create order AND send it immediately
  const createAndSendMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/purchasing/orders', data);
      const orderId = res.data.id;
      // Send immediately via WhatsApp
      await api.post(`/purchasing/orders/${orderId}/send`);
      return { orderId, supplierId: data.supplier_id };
    },
    onSuccess: ({ supplierId }) => {
      qc.invalidateQueries({ queryKey: ['purchasing-orders'] });
      qc.invalidateQueries({ queryKey: ['purchasing-conversation', supplierId] });
      setSelectedSupplierId(supplierId);
      setShowNew(false);
      toast.success('Pedido enviado por WhatsApp');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al crear pedido'),
  });

  const sendMsgMut = useMutation({
    mutationFn: (msg: string) => {
      if (!activeOrder) throw new Error('No hay pedido activo');
      return api.post(`/purchasing/orders/${activeOrder.id}/message`, { message: msg });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchasing-conversation', selectedSupplierId] });
      setChatMsg('');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al enviar mensaje'),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/purchasing/orders/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchasing-orders'] });
      toast.success('Estado actualizado');
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: number) => api.delete(`/purchasing/orders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchasing-orders'] });
      toast.success('Pedido cancelado');
    },
  });

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* ─── Left: Supplier conversations ─── */}
      <div className="w-80 border-r bg-gray-50 flex flex-col">
        <div className="p-3 border-b flex items-center justify-between bg-white">
          <h2 className="font-bold text-lg">Pedidos</h2>
          <div className="flex items-center gap-2">
            <span title={clawStatus?.connected ? 'OpenClaw conectado' : 'OpenClaw desconectado'}>
              {clawStatus?.connected
                ? <Wifi size={16} className="text-green-500" />
                : <WifiOff size={16} className="text-red-400" />
              }
            </span>
            <button onClick={() => setShowNew(true)} className="btn-primary text-xs px-2 py-1 gap-1">
              <Plus size={14} /> Nuevo Pedido
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {suppliersWithWa.length === 0 && (
            <p className="text-center text-gray-400 p-6 text-sm">Sin proveedores con WhatsApp</p>
          )}
          {supplierSidebar.map(s => {
            const sc = s.activeOrder ? statusConfig[s.activeOrder.status] || statusConfig.draft : null;
            return (
              <div
                key={s.id}
                onClick={() => setSelectedSupplierId(s.id)}
                className={`p-3 border-b cursor-pointer hover:bg-white transition-colors ${
                  selectedSupplierId === s.id ? 'bg-white border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{s.name}</span>
                  {sc && (
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${sc.color}`}>
                      <sc.icon size={12} /> {sc.label}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {s.orderCount > 0
                    ? `${s.orderCount} pedido${s.orderCount > 1 ? 's' : ''}`
                    : 'Sin pedidos'}
                  {s.lastOrder && (
                    <span className="ml-2">&middot; {new Date(s.lastOrder.created_at).toLocaleDateString('es-MX')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Right: Conversation ─── */}
      <div className="flex-1 flex flex-col">
        {!selectedSupplier ? (
          <div className="flex-1 flex items-center justify-center text-gray-300">
            <div className="text-center">
              <MessageCircle size={48} className="mx-auto mb-2" />
              <p>Selecciona un proveedor o crea un nuevo pedido</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b bg-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">{selectedSupplier.name}</h3>
                <p className="text-sm text-gray-400">{selectedSupplier.whatsapp}</p>
              </div>
              <div className="flex items-center gap-2">
                {activeOrder && activeOrder.status === 'sent' && (
                  <button
                    onClick={() => statusMut.mutate({ id: activeOrder.id, status: 'confirmed' })}
                    className="bg-yellow-500 text-white px-3 py-1.5 rounded-lg text-sm gap-1 flex items-center"
                  >
                    <Check size={14} /> Confirmar
                  </button>
                )}
                {activeOrder && activeOrder.status === 'confirmed' && (
                  <button
                    onClick={() => statusMut.mutate({ id: activeOrder.id, status: 'received' })}
                    className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm gap-1 flex items-center"
                  >
                    <Truck size={14} /> Recibido
                  </button>
                )}
                {activeOrder && !['cancelled', 'received'].includes(activeOrder.status) && (
                  <button
                    onClick={() => { if (confirm('Cancelar pedido?')) cancelMut.mutate(activeOrder.id); }}
                    className="text-red-500 hover:text-red-700 text-sm"
                    title="Cancelar pedido activo"
                  >
                    <XCircle size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Active order summary bar */}
            {activeOrder && (
              <div className="px-4 py-2 border-b bg-gray-50 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-600">
                    Pedido #{activeOrder.id} &middot; {(activeOrder.items || []).map(i => `${i.item_name} x${Number(i.quantity)}`).join(', ')}
                  </span>
                  <span className="font-bold">${Number(activeOrder.estimated_total || 0).toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Chat */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]">
              {messages.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-8">
                  <MessageCircle size={24} className="mx-auto mb-2 opacity-50" />
                  Sin mensajes aun.
                </p>
              )}
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
                    m.direction === 'out' ? 'bg-[#dcf8c6] rounded-tr-none' : 'bg-white rounded-tl-none'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                    <p className="text-[10px] text-gray-400 text-right mt-1">
                      {new Date(m.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      {m.direction === 'out' && (
                        <span className="ml-1">
                          {m.status === 'sent' ? '✓' : m.status === 'delivered' ? '✓✓' : m.status === 'read' ? '✓✓' : '⏳'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={chatEnd} />
            </div>

            {/* Message input */}
            {activeOrder && !['cancelled', 'received'].includes(activeOrder.status) && (
              <div className="p-3 border-t bg-white flex gap-2">
                <input
                  value={chatMsg}
                  onChange={e => setChatMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && chatMsg.trim()) sendMsgMut.mutate(chatMsg.trim()); }}
                  placeholder="Escribe un mensaje..."
                  className="input flex-1"
                />
                <button
                  onClick={() => { if (chatMsg.trim()) sendMsgMut.mutate(chatMsg.trim()); }}
                  disabled={!chatMsg.trim() || sendMsgMut.isPending}
                  className="btn-primary px-4"
                >
                  <Send size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── New Order Modal ─── */}
      {showNew && (
        <NewOrderModal
          suppliers={suppliersWithWa}
          invItems={invItems}
          onClose={() => setShowNew(false)}
          onCreate={(data) => createAndSendMut.mutate(data)}
          loading={createAndSendMut.isPending}
        />
      )}
    </div>
  );
}

// ─── New Order Modal ───

function NewOrderModal({ suppliers, invItems, onClose, onCreate, loading }: {
  suppliers: Supplier[]; invItems: InvItem[];
  onClose: () => void; onCreate: (data: any) => void; loading: boolean;
}) {
  const [supplierId, setSupplierId] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [addItemId, setAddItemId] = useState(0);
  const [addQty, setAddQty] = useState(1);

  const lowStock = invItems.filter(i => Number(i.stock) <= Number(i.stock_min) && Number(i.stock_min) > 0);

  function addItem() {
    const inv = invItems.find(i => i.id === addItemId);
    if (!inv || items.some(i => i.item_id === addItemId)) return;
    const sp = inv.suppliers?.find((s: any) => s.supplier_id === supplierId);
    setItems(prev => [...prev, {
      item_id: inv.id, item_name: inv.name, quantity: addQty,
      unit: inv.unit, estimated_price: sp?.price || Number(inv.current_cost) || 0,
    }]);
    setAddItemId(0);
    setAddQty(1);
  }

  function addLowStockItems() {
    const newItems: OrderItem[] = [];
    for (const inv of lowStock) {
      if (items.some(i => i.item_id === inv.id)) continue;
      const needed = Math.max(Number(inv.stock_min) - Number(inv.stock), 1);
      const sp = inv.suppliers?.find((s: any) => s.supplier_id === supplierId);
      newItems.push({
        item_id: inv.id, item_name: inv.name, quantity: Math.ceil(needed),
        unit: inv.unit, estimated_price: sp?.price || Number(inv.current_cost) || 0,
      });
    }
    setItems(prev => [...prev, ...newItems]);
  }

  const total = items.reduce((s, i) => s + (i.estimated_price || 0) * i.quantity, 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">Nuevo Pedido</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div>
          <label className="text-sm font-medium">Proveedor *</label>
          <select value={supplierId} onChange={e => setSupplierId(Number(e.target.value))} className="input">
            <option value={0}>Seleccionar proveedor...</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.whatsapp})</option>
            ))}
          </select>
        </div>

        {lowStock.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-amber-700 flex items-center gap-1">
                <AlertTriangle size={14} /> {lowStock.length} items con stock bajo
              </span>
              <button onClick={addLowStockItems} disabled={!supplierId}
                className="text-xs bg-amber-500 text-white px-2 py-1 rounded hover:bg-amber-600 disabled:opacity-50">
                Agregar todos
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium">Agregar producto</label>
            <select value={addItemId} onChange={e => setAddItemId(Number(e.target.value))} className="input">
              <option value={0}>Seleccionar...</option>
              {invItems.filter(i => !items.some(x => x.item_id === i.id)).map(i => (
                <option key={i.id} value={i.id}>{i.name} (stock: {Number(i.stock).toFixed(0)} {i.unit})</option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label className="text-sm font-medium">Cant.</label>
            <input type="number" min={1} value={addQty} onChange={e => setAddQty(Number(e.target.value))} className="input" />
          </div>
          <button onClick={addItem} disabled={!addItemId} className="btn-primary px-3 py-2"><Plus size={16} /></button>
        </div>

        {items.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Producto</th>
                  <th className="text-right p-2 w-24">Cantidad</th>
                  <th className="text-right p-2">Precio</th>
                  <th className="text-right p-2">Subtotal</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map(item => (
                  <tr key={item.item_id}>
                    <td className="p-2">{item.item_name} <span className="text-gray-400 text-xs">({item.unit})</span></td>
                    <td className="p-2">
                      <input type="number" min={1} value={item.quantity}
                        onChange={e => setItems(prev => prev.map(i => i.item_id === item.item_id ? { ...i, quantity: Number(e.target.value) } : i))}
                        className="input text-right w-20 ml-auto" />
                    </td>
                    <td className="p-2 text-right text-gray-500">${(item.estimated_price || 0).toFixed(2)}</td>
                    <td className="p-2 text-right font-medium">${((item.estimated_price || 0) * item.quantity).toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <button onClick={() => setItems(prev => prev.filter(i => i.item_id !== item.item_id))} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={3} className="p-2 text-right">Total Estimado:</td>
                  <td className="p-2 text-right">${total.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div>
          <label className="text-sm font-medium">Notas (opcional)</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="Notas del pedido..." />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={() => onCreate({ supplier_id: supplierId, notes, items })}
            disabled={!supplierId || items.length === 0 || loading}
            className="btn-primary flex-1 gap-1"
          >
            <Send size={16} /> {loading ? 'Enviando...' : 'Crear y Enviar por WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  );
}
