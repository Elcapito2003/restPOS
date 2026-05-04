import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useOrder } from '../hooks/useOrders';
import { PAYMENT_METHODS } from '../config/constants';
import api from '../config/api';
import toast from 'react-hot-toast';
import { DollarSign, CreditCard, ArrowLeft, Check, Users } from 'lucide-react';
import { openCashDrawer } from '../lib/cashDrawer';

const fmt = (n: number) => `$${n.toFixed(2)}`;

export default function PaymentPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get('order') ? +params.get('order')! : null;
  const { data: order, refetch: refetchOrder } = useOrder(orderId);

  const [method, setMethod] = useState<string>('cash');
  const [amount, setAmount] = useState('');
  const [tip, setTip] = useState('');
  const [received, setReceived] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [closed, setClosed] = useState(false);
  const [lastChange, setLastChange] = useState(0);

  // Fetch existing payments
  useEffect(() => {
    if (orderId) {
      api.get(`/payments/order/${orderId}`).then(r => setPayments(r.data)).catch(() => {});
    }
  }, [orderId]);

  // Compute paid so far
  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amount), 0);
  const orderTotal = parseFloat(order?.total || '0');
  const remaining = Math.max(0, orderTotal - totalPaid);

  // Default amount to remaining
  useEffect(() => {
    if (order && !closed) {
      setAmount(remaining.toFixed(2));
    }
  }, [order, payments, closed]);

  // Split helpers
  const [splitMode, setSplitMode] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const splitAmount = splitCount > 0 ? remaining / splitCount : 0;

  const handlePay = async () => {
    if (!orderId || !amount) return;
    setLoading(true);
    try {
      const res = await api.post('/payments', {
        order_id: orderId,
        method,
        amount: parseFloat(amount),
        tip: tip ? parseFloat(tip) : 0,
        reference: reference || undefined,
        received_amount: method === 'cash' && received ? parseFloat(received) : undefined,
      });

      // Refresh payments list
      const paymentsRes = await api.get(`/payments/order/${orderId}`);
      setPayments(paymentsRes.data);

      if (res.data.status === 'closed') {
        setClosed(true);
        setLastChange(res.data.change || 0);
        toast.success('Pago completado');
        // Abre el cajón después de cualquier cobro completado (cualquier método)
        openCashDrawer({ silent: true });
        // El auto-print de la cuenta se quitó: el usuario imprime cuando aprieta
        // el botón "Imprimir" desde la pantalla de orden.
      } else {
        toast.success(`Pago parcial registrado - Resta: ${fmt(res.data.remaining)}`);
        // Reset form for next payment
        setAmount(res.data.remaining.toFixed(2));
        setTip('');
        setReceived('');
        setReference('');
        setSplitMode(false);
      }

      refetchOrder();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al procesar pago');
    } finally {
      setLoading(false);
    }
  };

  const change = method === 'cash' && received
    ? Math.max(0, parseFloat(received || '0') - parseFloat(amount || '0') - parseFloat(tip || '0'))
    : 0;

  const quickAmounts = [50, 100, 200, 500, 1000];

  const methodLabels: Record<string, string> = {
    cash: 'Efectivo', visa: 'Visa', mastercard: 'MC', amex: 'Amex',
    other_card: 'Tarjeta', transfer: 'Transf.', other: 'Otro',
  };

  if (!orderId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Selecciona una orden para cobrar</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Order Summary */}
      <div className="lg:w-2/5 p-4 bg-white border-b lg:border-b-0 lg:border-r overflow-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-gray-700">
          <ArrowLeft size={16} /> Volver
        </button>
        <h2 className="text-xl font-bold mb-1">Orden #{order?.daily_number}</h2>
        <p className="text-gray-500 text-sm mb-4">{order?.table_label ? `Mesa ${order.table_label}` : 'Rápido'}</p>

        <div className="space-y-2 mb-4">
          {order?.items?.filter((i: any) => i.status !== 'cancelled').map((item: any) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.quantity}x {item.product_name}</span>
              <span>{fmt((parseFloat(item.unit_price) + (item.modifiers?.reduce((s: number, m: any) => s + parseFloat(m.price_extra || 0), 0) || 0)) * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="border-t pt-2 space-y-1">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{fmt(parseFloat(order?.subtotal || '0'))}</span>
          </div>
          {parseFloat(order?.discount_amount || '0') > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>Descuento</span>
              <span>-{fmt(parseFloat(order?.discount_amount))}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span>IVA</span>
            <span>{fmt(parseFloat(order?.tax || '0'))}</span>
          </div>
          <div className="flex justify-between font-bold text-xl pt-2 border-t">
            <span>Total</span>
            <span>{fmt(orderTotal)}</span>
          </div>
        </div>

        {/* Payments made so far */}
        {payments.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <h4 className="text-sm font-bold mb-2 text-gray-600">Pagos realizados</h4>
            {payments.map((p: any, i: number) => (
              <div key={p.id || i} className="flex justify-between text-sm py-1 border-b border-gray-100">
                <span className="flex items-center gap-1">
                  {p.method === 'cash' ? <DollarSign size={12} /> : <CreditCard size={12} />}
                  {methodLabels[p.method] || p.method}
                  {parseFloat(p.tip) > 0 && <span className="text-xs text-teal-600">(+{fmt(parseFloat(p.tip))} prop)</span>}
                </span>
                <span className="font-medium">{fmt(parseFloat(p.amount))}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold mt-2 pt-1">
              <span>Pagado</span>
              <span className="text-emerald-600">{fmt(totalPaid)}</span>
            </div>
            {remaining > 0 && (
              <div className="flex justify-between text-sm font-bold text-red-600">
                <span>Resta</span>
                <span>{fmt(remaining)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Form */}
      <div className="flex-1 p-4 overflow-auto">
        {closed ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign size={40} className="text-emerald-600" />
            </div>
            <h3 className="text-2xl font-bold text-emerald-600 mb-2">Pago Completado</h3>
            {lastChange > 0 && (
              <p className="text-3xl font-bold text-amber-600 mb-2">Cambio: {fmt(lastChange)}</p>
            )}
            {payments.length > 1 && (
              <p className="text-gray-500 mb-2">{payments.length} pagos registrados</p>
            )}
            <button onClick={() => navigate('/tables')} className="btn-primary mt-4">Volver a Mesas</button>
          </div>
        ) : (
          <>
            {/* Remaining banner */}
            {totalPaid > 0 && remaining > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4 flex justify-between items-center">
                <span className="font-medium text-amber-800">Saldo pendiente</span>
                <span className="text-2xl font-bold text-amber-700">{fmt(remaining)}</span>
              </div>
            )}

            <h3 className="font-bold text-lg mb-3">Método de Pago</h3>

            {/* Method selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setMethod(key)}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                    method === key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {key === 'cash' ? <DollarSign size={18} className="mx-auto mb-1" /> : <CreditCard size={18} className="mx-auto mb-1" />}
                  {label}
                </button>
              ))}
            </div>

            {/* Split toggle */}
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => { setSplitMode(!splitMode); if (!splitMode) setAmount(splitAmount.toFixed(2)); else setAmount(remaining.toFixed(2)); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${splitMode ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                <Users size={16} /> Dividir cuenta
              </button>
              {splitMode && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">entre</span>
                  {[2, 3, 4, 5, 6].map(n => (
                    <button key={n} onClick={() => { setSplitCount(n); setAmount((remaining / n).toFixed(2)); }}
                      className={`w-8 h-8 rounded-full text-sm font-bold transition-colors ${splitCount === n && splitMode ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                      {n}
                    </button>
                  ))}
                  <span className="text-sm text-gray-600">= <b>{fmt(splitCount > 0 ? remaining / splitCount : 0)}</b> c/u</span>
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-4 max-w-md">
              <div>
                <label className="text-sm font-medium">Monto a cobrar</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input mt-1 text-lg font-bold" step="0.01" />
              </div>

              <div>
                <label className="text-sm font-medium">Propina</label>
                <input type="number" value={tip} onChange={e => setTip(e.target.value)} className="input mt-1" placeholder="0.00" step="0.01" />
              </div>

              {method === 'cash' && (
                <>
                  <div>
                    <label className="text-sm font-medium">Monto recibido</label>
                    <input type="number" value={received} onChange={e => setReceived(e.target.value)} className="input mt-1" step="0.01" />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {quickAmounts.map(q => (
                      <button key={q} onClick={() => setReceived(String(q))} className="btn-outline text-sm px-3 py-1.5">${q}</button>
                    ))}
                  </div>
                  {change > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                      <span className="text-sm text-amber-600">Cambio:</span>
                      <p className="text-3xl font-bold text-amber-700">{fmt(change)}</p>
                    </div>
                  )}
                </>
              )}

              {method !== 'cash' && (
                <div>
                  <label className="text-sm font-medium">Referencia</label>
                  <input type="text" value={reference} onChange={e => setReference(e.target.value)} className="input mt-1" placeholder="Últimos 4 dígitos..." />
                </div>
              )}

              <button onClick={handlePay} disabled={loading || !amount || parseFloat(amount || '0') <= 0} className="btn-success w-full text-lg py-4">
                {loading ? 'Procesando...' : `Cobrar ${fmt(parseFloat(amount || '0') + parseFloat(tip || '0'))}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
