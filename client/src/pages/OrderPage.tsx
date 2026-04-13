import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCategoryTree, useProducts, useProduct } from '../hooks/useProducts';
import {
  useOrder, useOrderByTable, useCreateOrder, useAddItem, useUpdateItem, useRemoveItem,
  useSendToKitchen, useSetDiscount, useCancelOrder, useCancelItem,
  useChangeWaiter, useChangeTable, useSetTip, useSetObservations, useSetGuestCount,
  useCancellationReasons, useMergeOrders, useActiveOrders,
} from '../hooks/useOrders';
import {
  Send, Minus, Plus, Percent, MessageSquare, X, ChevronLeft,
  Ban, UserCheck, ArrowRightLeft, Users, FileText, DollarSign,
  Merge, Printer, CreditCard, ShieldCheck, Check, Keyboard
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ORDER_ITEM_STATUS } from '../config/constants';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';

// ─── PIN Auth Modal for discount authorization ───
function DiscountPinAuth({ onSuccess, onCancel }: { onSuccess: (userId: number) => void; onCancel: () => void }) {
  const { data: users } = useQuery({
    queryKey: ['auth-users'],
    queryFn: () => api.get('/auth/users').then(r => r.data),
  });
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const adminUsers = users?.filter((u: any) => ['admin', 'manager'].includes(u.role)) || [];

  const handleVerify = async () => {
    if (!selectedUser || !pin) return;
    setVerifying(true); setError('');
    try {
      const res = await api.post('/auth/verify-pin', { userId: selectedUser, pin });
      if (res.data.valid) onSuccess(selectedUser);
    } catch { setError('PIN incorrecto'); setPin(''); } finally { setVerifying(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-amber-100 to-orange-100 border-b border-orange-300 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-orange-700" />
            <span className="font-bold text-sm text-orange-900">Autorización requerida para descuento</span>
          </div>
          <button onClick={onCancel} className="text-gray-500 hover:text-red-500"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Usuario autorizado:</label>
            <div className="grid grid-cols-2 gap-2">
              {adminUsers.map((u: any) => (
                <button key={u.id} onClick={() => { setSelectedUser(u.id); setError(''); }}
                  className={`p-2 rounded-lg border-2 flex items-center gap-2 text-left transition-all text-sm ${selectedUser === u.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: u.avatar_color || '#3B82F6' }}>{u.display_name?.charAt(0)}</div>
                  <div className="min-w-0"><p className="font-medium truncate">{u.display_name}</p><p className="text-xs text-gray-500">{u.role}</p></div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña:</label>
            <input type="password" value={pin} onChange={e => { setPin(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              className="input text-lg tracking-widest" placeholder="••••" autoFocus maxLength={6} />
            {error && <p className="text-red-500 text-sm mt-1 font-medium">{error}</p>}
          </div>
        </div>
        <div className="flex border-t">
          <button onClick={() => {}} className="flex-1 flex flex-col items-center gap-1 py-3 bg-amber-50 hover:bg-amber-100 border-r text-amber-800 transition-colors">
            <Keyboard size={20} /><span className="text-xs font-medium">Teclado</span>
          </button>
          <button onClick={handleVerify} disabled={!selectedUser || !pin || verifying}
            className="flex-1 flex flex-col items-center gap-1 py-3 bg-emerald-50 hover:bg-emerald-100 border-r text-emerald-700 transition-colors disabled:opacity-40">
            <Check size={20} /><span className="text-xs font-medium">{verifying ? 'Verificando...' : 'Aceptar'}</span>
          </button>
          <button onClick={onCancel} className="flex-1 flex flex-col items-center gap-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 transition-colors">
            <X size={20} /><span className="text-xs font-medium">Cancelar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tableId = params.get('table') ? +params.get('table')! : null;
  const isQuickMode = params.get('mode') === 'quick';
  const [quickOrderId, setQuickOrderId] = useState<number | null>(
    params.get('order') ? +params.get('order')! : null
  );

  const { data: categoryTree } = useCategoryTree();
  // Navigation: null = show grupos, { cat, level } = show subgrupos or products
  const [navCat, setNavCat] = useState<any>(null);
  const [navLevel, setNavLevel] = useState(0); // 0=grupos, 1=subgrupos, 2=products

  const activeCat = navCat?.id || undefined;
  const { data: products } = useProducts(activeCat as number | undefined);

  const handleGrupoClick = (grupo: any) => {
    if (grupo.children?.length > 0) {
      // Has subgroups — show them
      setNavCat(grupo);
      setNavLevel(1);
    } else {
      // No subgroups — show products directly
      setNavCat(grupo);
      setNavLevel(2);
    }
  };

  const handleSubgrupoClick = (sub: any) => {
    setNavCat(sub);
    setNavLevel(2);
  };

  const handleNavBack = () => {
    if (navLevel === 2 && navCat) {
      // Find parent grupo
      const parent = categoryTree?.find((g: any) =>
        g.children?.some((c: any) => c.id === navCat.id)
      );
      if (parent) {
        setNavCat(parent);
        setNavLevel(1);
        return;
      }
    }
    setNavCat(null);
    setNavLevel(0);
  };
  const { data: orderByTable, refetch: refetchOrderByTable } = useOrderByTable(tableId);
  const { data: orderById, refetch: refetchOrderById } = useOrder(quickOrderId);
  const order = isQuickMode ? orderById : orderByTable;
  const refetchOrder = isQuickMode ? refetchOrderById : refetchOrderByTable;
  const createOrder = useCreateOrder();
  const addItem = useAddItem();
  const updateItem = useUpdateItem();
  const removeItem = useRemoveItem();
  const sendToKitchen = useSendToKitchen();
  const setDiscount = useSetDiscount();
  const cancelOrder = useCancelOrder();
  const cancelItem = useCancelItem();
  const changeWaiter = useChangeWaiter();
  const changeTable = useChangeTable();
  const setTip = useSetTip();
  const setObservations = useSetObservations();
  const setGuestCount = useSetGuestCount();
  const mergeOrders = useMergeOrders();
  const { data: cancellationReasons } = useCancellationReasons();
  const { data: activeOrders } = useActiveOrders();

  // Auth for discount
  const { user: currentUser } = useAuth();
  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  // Discount presets
  const { data: discountPresets } = useQuery({
    queryKey: ['discount-presets-active'],
    queryFn: () => api.get('/discounts?active=true').then(r => r.data),
  });

  // Users for waiter change
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
    enabled: false,
  });

  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const { data: productDetail } = useProduct(selectedProduct);
  const [showModifiers, setShowModifiers] = useState(false);
  const [selectedModifiers, setSelectedModifiers] = useState<number[]>([]);
  const [itemNotes, setItemNotes] = useState('');

  // Modal states
  const [showDiscount, setShowDiscount] = useState(false);
  const [showDiscountAuth, setShowDiscountAuth] = useState(false);
  const [discountAuthorizedBy, setDiscountAuthorizedBy] = useState<number | null>(null);
  const [showCustomDiscount, setShowCustomDiscount] = useState(false);
  const [discountValue, setDiscountValue] = useState('');
  const [showItemNotes, setShowItemNotes] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showCancelItem, setShowCancelItem] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelOrder, setShowCancelOrder] = useState(false);
  const [showChangeWaiter, setShowChangeWaiter] = useState(false);
  const [showChangeTable, setShowChangeTable] = useState(false);

  // Tables for table change (all tables)
  const { data: allTables, isLoading: loadingTables } = useQuery({
    queryKey: ['tables-all'],
    queryFn: async () => {
      const floors = await api.get('/floors').then(r => r.data);
      const tables: any[] = [];
      for (const f of floors) {
        const res = await api.get(`/floors/${f.id}/tables`);
        res.data?.forEach((t: any) => tables.push(t));
      }
      return tables;
    },
    enabled: showChangeTable,
  });
  const [showTip, setShowTip] = useState(false);
  const [tipValue, setTipValue] = useState('');
  const [showObservations, setShowObservations] = useState(false);
  const [obsText, setObsText] = useState('');
  const [showGuests, setShowGuests] = useState(false);
  const [guestValue, setGuestValue] = useState('');
  const [showMerge, setShowMerge] = useState(false);


  // Auto-create order for table mode
  useEffect(() => {
    if (tableId && !order && !createOrder.isPending && !isQuickMode) {
      createOrder.mutate({ table_id: tableId }, {
        onSuccess: () => refetchOrder(),
        onError: (err: any) => {
          if (err.response?.status !== 404) toast.error('Error al crear orden');
        },
      });
    }
  }, [tableId, order]);

  // Auto-create order for quick mode
  useEffect(() => {
    if (isQuickMode && !quickOrderId && !createOrder.isPending) {
      createOrder.mutate({ order_type: 'quick' }, {
        onSuccess: (newOrder: any) => {
          setQuickOrderId(newOrder.id);
        },
        onError: () => toast.error('Error al crear orden rápida'),
      });
    }
  }, [isQuickMode, quickOrderId]);

  const handleProductClick = async (product: any) => {
    if (!order) return;
    try {
      const res = await api.get(`/products/${product.id}`);
      const detail = res.data;
      if (detail.modifier_groups?.length > 0) {
        setSelectedProduct(product.id);
        setShowModifiers(true);
        setSelectedModifiers([]);
        setItemNotes('');
      } else {
        addItem.mutate({ orderId: order.id, product_id: product.id }, {
          onSuccess: () => refetchOrder(),
        });
      }
    } catch {
      addItem.mutate({ orderId: order.id, product_id: product.id }, {
        onSuccess: () => refetchOrder(),
      });
    }
  };

  // Check if all forced/required modifier groups are satisfied
  const getGroupValidation = () => {
    if (!productDetail?.modifier_groups) return { allSatisfied: true, groups: [] };
    const groups = productDetail.modifier_groups.map((group: any) => {
      const isForcedOrRequired = group.is_forced || group.is_required;
      const minSelect = group.min_select || (isForcedOrRequired ? 1 : 0);
      const selectedCount = group.modifiers?.filter((m: any) => selectedModifiers.includes(m.id)).length || 0;
      const satisfied = selectedCount >= minSelect;
      return { ...group, isForcedOrRequired, minSelect, selectedCount, satisfied };
    });
    return { allSatisfied: groups.every((g: any) => g.satisfied), groups };
  };

  const handleAddWithModifiers = () => {
    if (!order || !selectedProduct) return;
    const { allSatisfied } = getGroupValidation();
    if (!allSatisfied) { return; }
    addItem.mutate({
      orderId: order.id, product_id: selectedProduct,
      notes: itemNotes || undefined,
      modifiers: selectedModifiers.map(id => ({ modifier_id: id })),
    }, {
      onSuccess: () => { setShowModifiers(false); setSelectedProduct(null); setSelectedModifiers([]); setItemNotes(''); refetchOrder(); },
    });
  };

  const handleSend = () => {
    if (!order) return;
    const pendingItems = order.items?.filter((i: any) => i.status === 'pending');
    if (!pendingItems?.length) { toast.error('No hay items pendientes'); return; }
    sendToKitchen.mutate(order.id, { onSuccess: () => refetchOrder() });
  };

  const handleQuantityChange = (item: any, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      removeItem.mutate({ orderId: order!.id, itemId: item.id }, { onSuccess: () => refetchOrder() });
    } else {
      updateItem.mutate({ orderId: order!.id, itemId: item.id, quantity: newQty }, { onSuccess: () => refetchOrder() });
    }
  };

  if (!tableId && !isQuickMode) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">Selecciona una mesa para tomar orden</p>
          <button onClick={() => navigate('/tables')} className="btn-primary">Ir a Mesas</button>
        </div>
      </div>
    );
  }

  // SoftRestaurant-style action buttons for the order panel
  const actionButtons = [
    { label: 'Enviar', icon: Send, color: 'bg-blue-600 text-white', action: handleSend, disabled: !order?.items?.some((i: any) => i.status === 'pending') },
    { label: 'Cobrar', icon: CreditCard, color: 'bg-emerald-600 text-white', action: () => order && navigate(`/payments?order=${order.id}`), disabled: !order?.items?.length || (order?.status !== 'sent' && order?.status !== 'partial') },
    { label: 'Imprimir', icon: Printer, color: 'bg-gray-600 text-white', action: () => toast.success('Nota impresa (simulación)') },
    { label: 'Descuento', icon: Percent, color: 'bg-amber-500 text-white', action: () => {
      if (isAdminOrManager) { setDiscountAuthorizedBy(currentUser!.id); setShowDiscount(true); }
      else { setShowDiscountAuth(true); }
    } },
    { label: 'Propina', icon: DollarSign, color: 'bg-teal-500 text-white', action: () => { setTipValue(String(order?.tip || '')); setShowTip(true); } },
    { label: 'Personas', icon: Users, color: 'bg-purple-500 text-white', action: () => { setGuestValue(String(order?.guest_count || 1)); setShowGuests(true); } },
    { label: 'Notas', icon: FileText, color: 'bg-indigo-500 text-white', action: () => { setObsText(order?.notes || ''); setShowObservations(true); } },
    { label: 'Cambiar Mesero', icon: UserCheck, color: 'bg-sky-500 text-white', action: () => setShowChangeWaiter(true) },
    ...(!isQuickMode ? [{ label: 'Cambiar Mesa', icon: ArrowRightLeft, color: 'bg-orange-500 text-white', action: () => setShowChangeTable(true) }] : []),
    { label: 'Juntar', icon: Merge, color: 'bg-violet-500 text-white', action: () => setShowMerge(true) },
    { label: 'Cancelar', icon: Ban, color: 'bg-red-600 text-white', action: () => setShowCancelOrder(true) },
  ];

  return (
    <div className="h-full flex">
      {/* Left: Products (55%) */}
      <div className="w-[55%] flex flex-col border-r">
        {/* Nav header */}
        {navLevel > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b shrink-0">
            <button onClick={handleNavBack}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium">
              <ChevronLeft size={16} /> Atrás
            </button>
            <span className="text-sm font-bold text-gray-700">{navCat?.name}</span>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4">
          {/* Level 0: Show grupo bubbles */}
          {navLevel === 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {categoryTree?.map((grupo: any) => (
                <button key={grupo.id} onClick={() => handleGrupoClick(grupo)}
                  className="rounded-2xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:shadow-lg active:scale-95 transition-all p-5 flex flex-col items-center justify-center gap-2 min-h-[100px]"
                  style={{ borderColor: grupo.color || undefined }}>
                  <span className="text-lg font-bold text-gray-800">{grupo.name}</span>
                  <span className="text-xs text-gray-400">
                    {grupo.children?.length > 0 ? `${grupo.children.length} subgrupos` : 'Ver productos'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Level 1: Show subgrupo bubbles */}
          {navLevel === 1 && navCat?.children && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {navCat.children.map((sub: any) => (
                <button key={sub.id} onClick={() => handleSubgrupoClick(sub)}
                  className="rounded-2xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:shadow-lg active:scale-95 transition-all p-5 flex flex-col items-center justify-center gap-2 min-h-[100px]">
                  <span className="text-lg font-bold text-gray-800">{sub.name}</span>
                  <span className="text-xs text-gray-400">Ver productos</span>
                </button>
              ))}
            </div>
          )}

          {/* Level 2: Show products */}
          {navLevel === 2 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {products?.map((product: any) => (
                <button key={product.id} onClick={() => handleProductClick(product)} disabled={!product.is_available}
                  className="card p-3 text-left hover:shadow-md active:scale-95 transition-all disabled:opacity-40">
                  <p className="font-medium text-sm leading-tight">{product.name}</p>
                  <p className="text-blue-600 font-bold mt-1">${parseFloat(product.price).toFixed(2)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Order (45%) */}
      <div className="w-[45%] flex flex-col bg-white">
        {/* Order header */}
        <div className="p-3 border-b bg-gray-50">
          <div className="flex justify-between items-center">
            <div>
              <span className="font-bold">{isQuickMode ? 'Rápido' : `Mesa ${order?.table_label}`}</span>
              {order?.daily_number && <span className="text-gray-500 ml-2">#{order.daily_number}</span>}
              <span className="text-gray-400 text-xs ml-2">Mesero: {order?.waiter_name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Users size={14} />{order?.guest_count || 1} pers.
            </div>
          </div>
        </div>

        {/* Action buttons - SoftRestaurant style grid */}
        <div className="grid grid-cols-4 gap-1 p-2 bg-gray-100 border-b shrink-0">
          {actionButtons.map((btn) => (
            <button key={btn.label} onClick={btn.action} disabled={btn.disabled}
              className={`${btn.color} rounded px-1 py-1.5 text-xs font-medium flex flex-col items-center gap-0.5 transition-opacity disabled:opacity-40 active:scale-95 min-h-[44px]`}>
              <btn.icon size={16} />
              <span className="leading-tight">{btn.label}</span>
            </button>
          ))}
        </div>

        {/* Order items */}
        <div className="flex-1 overflow-auto">
          {order?.items?.map((item: any) => {
            const statusInfo = ORDER_ITEM_STATUS[item.status as keyof typeof ORDER_ITEM_STATUS];
            return (
              <div key={item.id} className="p-2 border-b flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between">
                    <span className={`font-medium text-sm ${statusInfo?.color || ''}`}>{item.product_name}</span>
                    <span className="text-sm font-medium">${((parseFloat(item.unit_price) + (item.modifiers?.reduce((s: number, m: any) => s + parseFloat(m.price_extra || 0), 0) || 0)) * item.quantity).toFixed(2)}</span>
                  </div>
                  {item.modifiers?.map((m: any) => (
                    <span key={m.id} className="text-xs text-gray-500 block">
                      + {m.modifier_name}{parseFloat(m.price_extra) > 0 && ` ($${parseFloat(m.price_extra).toFixed(2)})`}
                    </span>
                  ))}
                  {item.notes && <span className="text-xs text-amber-600 block">* {item.notes}</span>}
                  {item.cancel_reason && <span className="text-xs text-red-500 block">Cancelado: {item.cancel_reason}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.status === 'pending' ? (
                    <>
                      <button onClick={() => handleQuantityChange(item, -1)} className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center hover:bg-gray-200"><Minus size={12} /></button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => handleQuantityChange(item, 1)} className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center hover:bg-gray-200"><Plus size={12} /></button>
                      <button onClick={() => { setShowItemNotes(item.id); setNoteText(item.notes || ''); }} className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center hover:bg-gray-200"><MessageSquare size={12} /></button>
                    </>
                  ) : item.status !== 'cancelled' ? (
                    <>
                      <span className="text-sm text-gray-500 mr-1">x{item.quantity}</span>
                      <button onClick={() => { setShowCancelItem(item.id); setCancelReason(''); }}
                        className="w-7 h-7 rounded bg-red-50 flex items-center justify-center hover:bg-red-100 text-red-500" title="Cancelar producto">
                        <Ban size={12} />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-red-500 line-through">x{item.quantity}</span>
                  )}
                </div>
              </div>
            );
          })}
          {(!order?.items || order.items.length === 0) && (
            <div className="p-8 text-center text-gray-400"><p>Agrega productos a la orden</p></div>
          )}
        </div>

        {/* Totals */}
        <div className="border-t p-3 bg-gray-50 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>${parseFloat(order?.subtotal || '0').toFixed(2)}</span></div>
          {parseFloat(order?.discount_amount || '0') > 0 && (
            <div className="flex justify-between text-red-600"><span>Descuento ({order?.discount_percent}%)</span><span>-${parseFloat(order?.discount_amount).toFixed(2)}</span></div>
          )}
          <div className="flex justify-between"><span>IVA</span><span>${parseFloat(order?.tax || '0').toFixed(2)}</span></div>
          {parseFloat(order?.tip || '0') > 0 && (
            <div className="flex justify-between text-teal-600"><span>Propina</span><span>${parseFloat(order?.tip).toFixed(2)}</span></div>
          )}
          <div className="flex justify-between font-bold text-lg border-t pt-1"><span>Total</span><span>${parseFloat(order?.total || '0').toFixed(2)}</span></div>
        </div>
      </div>

      {/* ===== MODALS ===== */}

      {/* Modifier Modal */}
      {showModifiers && productDetail && (() => {
        const { allSatisfied, groups: validatedGroups } = getGroupValidation();
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-auto">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold">{productDetail.name}</h3>
                <button onClick={() => { setShowModifiers(false); setSelectedProduct(null); }}><X size={20} /></button>
              </div>
              <div className="p-4 space-y-4">
                {validatedGroups.map((group: any) => (
                  <div key={group.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{group.name}</h4>
                      {group.isForcedOrRequired && (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${group.satisfied ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {group.satisfied ? `${group.selectedCount}/${group.minSelect}` : `${group.selectedCount}/${group.minSelect} requerido`}
                        </span>
                      )}
                      {group.is_forced && <span className="text-xs text-red-500 font-medium">Forzado</span>}
                    </div>
                    <div className="space-y-1">
                      {group.modifiers?.map((mod: any) => (
                        <button key={mod.id} onClick={() => setSelectedModifiers(prev => prev.includes(mod.id) ? prev.filter(id => id !== mod.id) : [...prev, mod.id])}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedModifiers.includes(mod.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                          <span>{mod.name}</span>
                          {parseFloat(mod.price_extra) > 0 && <span className="text-blue-600 float-right">+${parseFloat(mod.price_extra).toFixed(2)}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div>
                  <label className="text-sm font-medium">Notas</label>
                  <input type="text" value={itemNotes} onChange={e => setItemNotes(e.target.value)} className="input mt-1" placeholder="Notas especiales..." />
                </div>
              </div>
              <div className="p-4 border-t">
                <button onClick={handleAddWithModifiers} disabled={!allSatisfied} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
                  {allSatisfied ? 'Agregar' : 'Selecciona los modificadores requeridos'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Discount PIN Auth */}
      {showDiscountAuth && (
        <DiscountPinAuth
          onSuccess={(userId) => { setDiscountAuthorizedBy(userId); setShowDiscountAuth(false); setShowDiscount(true); }}
          onCancel={() => setShowDiscountAuth(false)}
        />
      )}

      {/* Discount Modal */}
      {showDiscount && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-4">
            <h3 className="font-bold mb-3">Descuento General</h3>

            {/* Preset buttons */}
            {discountPresets?.length > 0 && (
              <div className="space-y-2 mb-3">
                {discountPresets.map((p: any) => (
                  <button key={p.id} onClick={() => {
                    if (!order) return;
                    setDiscount.mutate({ orderId: order.id, discount_percent: parseFloat(p.discount_percent), preset_id: p.id, authorized_by: discountAuthorizedBy }, {
                      onSuccess: () => { setShowDiscount(false); setDiscountValue(''); setShowCustomDiscount(false); setDiscountAuthorizedBy(null); refetchOrder(); toast.success(`Descuento "${p.name}" aplicado`); },
                    });
                  }} className="w-full text-left p-3 rounded-lg border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all flex items-center justify-between">
                    <div>
                      <span className="font-medium">{p.name}</span>
                      {p.code && <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono">{p.code}</span>}
                    </div>
                    <span className="font-bold text-amber-600">{parseFloat(p.discount_percent)}%</span>
                  </button>
                ))}
              </div>
            )}

            {/* Divider */}
            {discountPresets?.length > 0 && (
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 border-t" /><span className="text-xs text-gray-400">o personalizado</span><div className="flex-1 border-t" />
              </div>
            )}

            {/* Custom percent */}
            {!showCustomDiscount && discountPresets?.length > 0 ? (
              <button onClick={() => setShowCustomDiscount(true)} className="w-full p-2.5 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-600 text-sm font-medium transition-colors">
                Personalizado...
              </button>
            ) : (
              <>
                <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} className="input mb-3" placeholder="Porcentaje (0-100)" min="0" max="100" autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => { setShowDiscount(false); setShowCustomDiscount(false); setDiscountValue(''); setDiscountAuthorizedBy(null); }} className="btn-secondary flex-1">Cancelar</button>
                  <button onClick={() => {
                    if (order && discountValue) {
                      setDiscount.mutate({ orderId: order.id, discount_percent: parseFloat(discountValue), authorized_by: discountAuthorizedBy }, {
                        onSuccess: () => { setShowDiscount(false); setShowCustomDiscount(false); setDiscountValue(''); setDiscountAuthorizedBy(null); refetchOrder(); },
                      });
                    }
                  }} className="btn-primary flex-1">Aplicar</button>
                </div>
              </>
            )}

            {/* Remove existing discount */}
            {parseFloat(order?.discount_percent || '0') > 0 && (
              <button onClick={() => {
                if (!order) return;
                setDiscount.mutate({ orderId: order.id, discount_percent: 0, preset_id: null, authorized_by: null }, {
                  onSuccess: () => { setShowDiscount(false); setShowCustomDiscount(false); setDiscountValue(''); setDiscountAuthorizedBy(null); refetchOrder(); toast.success('Descuento eliminado'); },
                });
              }} className="w-full mt-3 p-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors">
                Quitar Descuento Actual ({order?.discount_percent}%)
              </button>
            )}

            {/* Cancel when showing only presets */}
            {!showCustomDiscount && discountPresets?.length > 0 && (
              <button onClick={() => { setShowDiscount(false); setShowCustomDiscount(false); setDiscountAuthorizedBy(null); }} className="btn-secondary w-full mt-3">Cancelar</button>
            )}
          </div>
        </div>
      )}

      {/* Item Notes Modal */}
      {showItemNotes !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xs p-4">
            <h3 className="font-bold mb-3">Comentarios de Preparación</h3>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} className="input mb-3 min-h-[80px]" placeholder="Ej: sin cebolla, extra picante..." />
            <div className="flex gap-2">
              <button onClick={() => setShowItemNotes(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => { updateItem.mutate({ orderId: order!.id, itemId: showItemNotes, notes: noteText }, { onSuccess: () => { setShowItemNotes(null); setNoteText(''); refetchOrder(); } }); }} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Item Modal */}
      {showCancelItem !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-4">
            <h3 className="font-bold mb-3">Cancelar Producto</h3>
            <p className="text-sm text-gray-500 mb-3">Selecciona el motivo de cancelación:</p>
            <div className="space-y-2 mb-3 max-h-52 overflow-y-auto">
              {cancellationReasons?.filter((r: any, idx: number, arr: any[]) => arr.findIndex((x: any) => x.name === r.name) === idx).map((r: any) => (
                <button key={r.id} onClick={() => setCancelReason(r.name)}
                  className={`w-full text-left p-2 rounded-lg border text-sm ${cancelReason === r.name ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  {r.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCancelItem(null)} className="btn-secondary flex-1">No Cancelar</button>
              <button onClick={() => { if (cancelReason) { cancelItem.mutate({ orderId: order!.id, itemId: showCancelItem, reason: cancelReason }, { onSuccess: () => { setShowCancelItem(null); refetchOrder(); } }); } }}
                disabled={!cancelReason} className="btn-danger flex-1">Cancelar Producto</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {showCancelOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xs p-4 text-center">
            <Ban size={40} className="mx-auto text-red-500 mb-3" />
            <h3 className="font-bold mb-2">Cancelar Cuenta</h3>
            <p className="text-sm text-gray-500 mb-4">Se cancelará toda la cuenta #{order?.daily_number}</p>
            <div className="flex gap-2">
              <button onClick={() => setShowCancelOrder(false)} className="btn-secondary flex-1">No</button>
              <button onClick={() => { cancelOrder.mutate(order!.id, { onSuccess: () => { setShowCancelOrder(false); navigate(isQuickMode ? '/home' : '/tables'); } }); }} className="btn-danger flex-1">Sí, Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Change Waiter Modal */}
      {showChangeWaiter && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-4">
            <h3 className="font-bold mb-3">Cambiar Mesero</h3>
            <div className="space-y-2 max-h-60 overflow-auto">
              {users?.filter((u: any) => ['waiter', 'admin', 'manager'].includes(u.role)).map((u: any) => (
                <button key={u.id} onClick={() => { changeWaiter.mutate({ orderId: order!.id, waiter_id: u.id }, { onSuccess: () => { setShowChangeWaiter(false); refetchOrder(); } }); }}
                  className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 hover:bg-blue-50 ${u.id === order?.waiter_id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: u.avatar_color || '#3B82F6' }}>{u.display_name?.charAt(0)}</div>
                  <span className="font-medium text-sm">{u.display_name}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowChangeWaiter(false)} className="btn-secondary w-full mt-3">Cancelar</button>
          </div>
        </div>
      )}

      {/* Change Table Modal */}
      {showChangeTable && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-4">
            <h3 className="font-bold mb-3">Cambiar Mesa</h3>
            <div className="grid grid-cols-3 gap-2 max-h-60 overflow-auto">
              {allTables?.filter((t: any) => t.id !== order?.table_id).map((t: any) => (
                <button key={t.id} onClick={() => { changeTable.mutate({ orderId: order!.id, table_id: t.id }, { onSuccess: () => { setShowChangeTable(false); refetchOrder(); } }); }}
                  className={`p-3 rounded-lg border text-center transition-colors ${t.status === 'free' ? 'border-gray-200 hover:bg-blue-50' : 'border-orange-300 bg-orange-50 hover:bg-orange-100'}`}>
                  <span className="font-medium text-sm">{t.label}</span>
                  {t.status !== 'free' && <span className="block text-xs text-orange-600">Ocupada</span>}
                </button>
              ))}
              {loadingTables && <p className="col-span-3 text-center text-gray-400 text-sm py-4">Cargando mesas...</p>}
              {!loadingTables && (!allTables || allTables.filter((t: any) => t.id !== order?.table_id).length === 0) && <p className="col-span-3 text-center text-gray-400 text-sm py-4">No hay otras mesas</p>}
            </div>
            <button onClick={() => setShowChangeTable(false)} className="btn-secondary w-full mt-3">Cancelar</button>
          </div>
        </div>
      )}

      {/* Tip Modal */}
      {showTip && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xs p-4">
            <h3 className="font-bold mb-3">Propina Incluida</h3>
            <input type="number" value={tipValue} onChange={e => setTipValue(e.target.value)} className="input mb-3" placeholder="Monto de propina" step="0.01" />
            <div className="flex gap-2">
              <button onClick={() => setShowTip(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => { if (order && tipValue) { setTip.mutate({ orderId: order.id, amount: parseFloat(tipValue) }, { onSuccess: () => { setShowTip(false); refetchOrder(); } }); } }} className="btn-primary flex-1">Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* Observations Modal */}
      {showObservations && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-4">
            <h3 className="font-bold mb-3">Observaciones de la Cuenta</h3>
            <textarea value={obsText} onChange={e => setObsText(e.target.value)} className="input mb-3 min-h-[100px]" placeholder="Notas, observaciones..." />
            <div className="flex gap-2">
              <button onClick={() => setShowObservations(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => { if (order) { setObservations.mutate({ orderId: order.id, notes: obsText }, { onSuccess: () => { setShowObservations(false); refetchOrder(); } }); } }} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Guest Count Modal */}
      {showGuests && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xs p-4">
            <h3 className="font-bold mb-3">Número de Personas</h3>
            <input type="number" value={guestValue} onChange={e => setGuestValue(e.target.value)} className="input mb-3" min="1" />
            <div className="flex gap-2">
              <button onClick={() => setShowGuests(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => { if (order && guestValue) { setGuestCount.mutate({ orderId: order.id, guest_count: parseInt(guestValue) }, { onSuccess: () => { setShowGuests(false); refetchOrder(); } }); } }} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Orders Modal */}
      {showMerge && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-4">
            <h3 className="font-bold mb-3">Juntar Cuentas</h3>
            <p className="text-sm text-gray-500 mb-3">Selecciona la cuenta destino (los productos de esta cuenta se moverán allá):</p>
            <div className="space-y-2 max-h-60 overflow-auto">
              {activeOrders?.filter((o: any) => o.id !== order?.id).map((o: any) => (
                <button key={o.id} onClick={() => { mergeOrders.mutate({ sourceOrderId: order!.id, target_order_id: o.id }, { onSuccess: () => { setShowMerge(false); navigate(isQuickMode ? '/home' : '/tables'); } }); }}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-blue-50">
                  <span className="font-medium">{o.table_label || 'Sin mesa'} #{o.daily_number}</span>
                  <span className="text-gray-500 text-sm ml-2">${parseFloat(o.total).toFixed(2)}</span>
                </button>
              ))}
              {(!activeOrders || activeOrders.filter((o: any) => o.id !== order?.id).length === 0) && (
                <p className="text-center text-gray-400 text-sm py-4">No hay otras cuentas abiertas</p>
              )}
            </div>
            <button onClick={() => setShowMerge(false)} className="btn-secondary w-full mt-3">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
