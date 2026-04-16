import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import {
  Package, Truck, DollarSign, Clock, Check, X, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, History,
} from 'lucide-react';

interface OrderItem {
  id: number; item_id: number; item_name: string;
  quantity: number; unit: string;
  estimated_price: number; confirmed_price: number;
  received_quantity: number; received_price: number;
}

interface Order {
  id: number; supplier_id: number; supplier_name: string;
  status: string; payment_status: string; payment_amount: string;
  estimated_total: string; confirmed_total: string; received_total: string;
  reception_notes: string; payment_method: string;
  sent_at: string; confirmed_at: string; received_at: string; paid_at: string; created_at: string;
  items: OrderItem[];
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  sent:      { label: 'Enviado',    color: 'bg-blue-100 text-blue-700',   icon: Truck },
  confirmed: { label: 'Confirmado', color: 'bg-yellow-100 text-yellow-700', icon: Check },
  received:  { label: 'Recibido',   color: 'bg-green-100 text-green-700', icon: Package },
  cancelled: { label: 'Cancelado',  color: 'bg-red-100 text-red-700',     icon: X },
};

const payStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-red-100 text-red-700' },
  partial: { label: 'Parcial',   color: 'bg-yellow-100 text-yellow-700' },
  paid:    { label: 'Pagado',    color: 'bg-green-100 text-green-700' },
};

export default function RecepcionPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'recibir' | 'pagar' | 'historial'>('recibir');
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const { data: receptionOrders = [] } = useQuery<Order[]>({
    queryKey: ['reception-orders'],
    queryFn: () => api.get('/purchasing/reception').then(r => r.data),
    enabled: tab === 'recibir',
    refetchInterval: 15000,
  });

  const { data: paymentOrders = [] } = useQuery<Order[]>({
    queryKey: ['payment-orders'],
    queryFn: () => api.get('/purchasing/reception/pending-payment').then(r => r.data),
    enabled: tab === 'pagar',
    refetchInterval: 15000,
  });

  const { data: historyOrders = [] } = useQuery<Order[]>({
    queryKey: ['history-orders'],
    queryFn: () => api.get('/purchasing/reception/history').then(r => r.data),
    enabled: tab === 'historial',
  });

  const tabs = [
    { id: 'recibir' as const, label: 'Pendientes de Recibir', icon: Truck, count: receptionOrders.filter(o => o.status !== 'received').length },
    { id: 'pagar' as const, label: 'Pendientes de Pago', icon: DollarSign, count: paymentOrders.length },
    { id: 'historial' as const, label: 'Historial', icon: History, count: 0 },
  ];

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Recepciones y Pagos</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setExpandedOrder(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              tab === t.id ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={16} />
            {t.label}
            {t.count > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pendientes de Recibir */}
      {tab === 'recibir' && (
        <div className="space-y-3">
          {receptionOrders.filter(o => o.status !== 'received').length === 0 && (
            <div className="card p-8 text-center text-gray-400">
              <CheckCircle size={40} className="mx-auto mb-2 opacity-50" />
              <p>No hay pedidos pendientes de recibir</p>
            </div>
          )}
          {receptionOrders.filter(o => o.status !== 'received').map(order => (
            <ReceptionCard key={order.id} order={order} expanded={expandedOrder === order.id}
              onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
              onReceived={() => {
                qc.invalidateQueries({ queryKey: ['reception-orders'] });
                qc.invalidateQueries({ queryKey: ['payment-orders'] });
                setExpandedOrder(null);
              }}
            />
          ))}
        </div>
      )}

      {/* Pendientes de Pago */}
      {tab === 'pagar' && (
        <div className="space-y-3">
          {paymentOrders.length === 0 && (
            <div className="card p-8 text-center text-gray-400">
              <CheckCircle size={40} className="mx-auto mb-2 opacity-50" />
              <p>No hay pedidos pendientes de pago</p>
            </div>
          )}
          {paymentOrders.map(order => (
            <PaymentCard key={order.id} order={order} expanded={expandedOrder === order.id}
              onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
              onPaid={() => {
                qc.invalidateQueries({ queryKey: ['payment-orders'] });
                qc.invalidateQueries({ queryKey: ['history-orders'] });
                setExpandedOrder(null);
              }}
            />
          ))}
        </div>
      )}

      {/* Historial */}
      {tab === 'historial' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">#</th>
                <th className="text-left p-3">Proveedor</th>
                <th className="text-left p-3">Items</th>
                <th className="text-right p-3">Total</th>
                <th className="text-left p-3">Estado</th>
                <th className="text-left p-3">Pago</th>
                <th className="text-left p-3">Fecha Recepción</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {historyOrders.map(o => {
                const sc = statusConfig[o.status] || statusConfig.sent;
                const pc = payStatusConfig[o.payment_status] || payStatusConfig.pending;
                const total = Number(o.received_total || o.confirmed_total || o.estimated_total || 0);
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-400">#{o.id}</td>
                    <td className="p-3 font-medium">{o.supplier_name}</td>
                    <td className="p-3 text-xs text-gray-500">
                      {o.items.map(i => `${i.item_name} x${Number(i.received_quantity || i.quantity)}`).join(', ')}
                    </td>
                    <td className="p-3 text-right font-medium">${total.toFixed(2)}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${sc.color}`}>{sc.label}</span>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${pc.color}`}>{pc.label}</span>
                    </td>
                    <td className="p-3 text-xs text-gray-500">
                      {o.received_at ? new Date(o.received_at).toLocaleDateString('es-MX') : '-'}
                    </td>
                  </tr>
                );
              })}
              {historyOrders.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">Sin historial</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Reception Card ───

function ReceptionCard({ order, expanded, onToggle, onReceived }: {
  order: Order; expanded: boolean; onToggle: () => void; onReceived: () => void;
}) {
  const [items, setItems] = useState<{ id: number; received_quantity: number; received_price: number }[]>(
    order.items.map(i => ({
      id: i.id,
      received_quantity: Number(i.quantity),
      received_price: Number(i.confirmed_price || i.estimated_price || 0),
    }))
  );
  const [notes, setNotes] = useState('');

  const receiveMut = useMutation({
    mutationFn: () => api.post(`/purchasing/orders/${order.id}/receive`, { items, notes }),
    onSuccess: () => {
      toast.success(`Pedido #${order.id} recibido. Inventario actualizado.`);
      onReceived();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const sc = statusConfig[order.status] || statusConfig.sent;
  const total = items.reduce((s, i) => s + i.received_quantity * i.received_price, 0);
  const daysSinceSent = order.sent_at
    ? Math.floor((Date.now() - new Date(order.sent_at).getTime()) / 86400000)
    : 0;

  return (
    <div className="card overflow-hidden">
      <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold">#{order.id}</span>
              <span className="font-medium">{order.supplier_name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${sc.color}`}>{sc.label}</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {order.items.length} items &middot; ${Number(order.estimated_total || 0).toFixed(2)} estimado
              {daysSinceSent > 0 && (
                <span className={daysSinceSent > 3 ? 'text-red-500 font-medium' : ''}>
                  {' '}&middot; hace {daysSinceSent} día{daysSinceSent !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
      </div>

      {expanded && (
        <div className="border-t p-4 space-y-3">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-left pb-2">Producto</th>
                <th className="text-right pb-2 w-24">Pedido</th>
                <th className="text-right pb-2 w-28">Recibido</th>
                <th className="text-right pb-2 w-28">Precio</th>
                <th className="text-right pb-2 w-24">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.items.map((oi, idx) => {
                const ri = items[idx];
                const diff = ri.received_quantity !== Number(oi.quantity);
                return (
                  <tr key={oi.id}>
                    <td className="py-2">
                      {oi.item_name}
                      <span className="text-xs text-gray-400 ml-1">({oi.unit || 'pz'})</span>
                    </td>
                    <td className="py-2 text-right text-gray-500">{Number(oi.quantity)}</td>
                    <td className="py-2 text-right">
                      <input type="number" min={0} step="0.1" value={ri.received_quantity}
                        onChange={e => setItems(prev => prev.map((p, i) => i === idx ? { ...p, received_quantity: Number(e.target.value) } : p))}
                        className={`input text-right w-24 ${diff ? 'border-yellow-400 bg-yellow-50' : ''}`} />
                    </td>
                    <td className="py-2 text-right">
                      <input type="number" min={0} step="0.01" value={ri.received_price}
                        onChange={e => setItems(prev => prev.map((p, i) => i === idx ? { ...p, received_price: Number(e.target.value) } : p))}
                        className="input text-right w-24" />
                    </td>
                    <td className="py-2 text-right font-medium">
                      ${(ri.received_quantity * ri.received_price).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t font-bold">
                <td colSpan={4} className="py-2 text-right">Total:</td>
                <td className="py-2 text-right">${total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <div>
            <label className="text-sm font-medium text-gray-600">Notas de recepción</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="Opcional..." />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onToggle} className="btn-secondary">Cancelar</button>
            <button onClick={() => receiveMut.mutate()} disabled={receiveMut.isPending}
              className="btn-primary gap-1">
              <Check size={16} /> {receiveMut.isPending ? 'Procesando...' : 'Confirmar Recepción'}
            </button>
          </div>

          {items.some((ri, idx) => ri.received_quantity !== Number(order.items[idx].quantity)) && (
            <p className="text-xs text-yellow-600 flex items-center gap-1">
              <AlertTriangle size={14} /> Las cantidades recibidas difieren de las pedidas
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Payment Card ───

function PaymentCard({ order, expanded, onToggle, onPaid }: {
  order: Order; expanded: boolean; onToggle: () => void; onPaid: () => void;
}) {
  const total = Number(order.received_total || order.confirmed_total || order.estimated_total || 0);
  const paid = Number(order.payment_amount || 0);
  const remaining = total - paid;
  const [amount, setAmount] = useState(remaining);
  const [method, setMethod] = useState('efectivo');

  const payMut = useMutation({
    mutationFn: () => api.post(`/purchasing/orders/${order.id}/pay`, { amount, method }),
    onSuccess: (res) => {
      const ps = res.data.payment_status;
      toast.success(ps === 'paid' ? `Pedido #${order.id} pagado completamente` : `Abono registrado para pedido #${order.id}`);
      onPaid();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const pc = payStatusConfig[order.payment_status] || payStatusConfig.pending;

  return (
    <div className="card overflow-hidden">
      <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold">#{order.id}</span>
              <span className="font-medium">{order.supplier_name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${pc.color}`}>{pc.label}</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Total: ${total.toFixed(2)}
              {paid > 0 && <span> &middot; Pagado: ${paid.toFixed(2)}</span>}
              <span className="font-medium text-red-600"> &middot; Adeudo: ${remaining.toFixed(2)}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-red-600">${remaining.toFixed(2)}</span>
          {expanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t p-4 space-y-3">
          {/* Items summary */}
          <div className="text-xs text-gray-500 space-y-1">
            {order.items.map((i: any, idx: number) => (
              <div key={idx} className="flex justify-between">
                <span>{i.item_name} x{Number(i.received_quantity || i.quantity)} {i.unit}</span>
                <span>${(Number(i.received_price || 0) * Number(i.received_quantity || i.quantity)).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-3 grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-600">Monto a pagar</label>
              <input type="number" min={0} step="0.01" value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="input" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Método</label>
              <select value={method} onChange={e => setMethod(e.target.value)} className="input">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="cheque">Cheque</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => payMut.mutate()} disabled={payMut.isPending || amount <= 0}
                className="btn-primary w-full gap-1">
                <DollarSign size={16} /> {payMut.isPending ? 'Procesando...' : amount >= remaining ? 'Pagar Todo' : 'Abonar'}
              </button>
            </div>
          </div>

          {order.received_at && (
            <p className="text-xs text-gray-400">
              Recibido el {new Date(order.received_at).toLocaleDateString('es-MX')}
              {order.reception_notes && ` — ${order.reception_notes}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
