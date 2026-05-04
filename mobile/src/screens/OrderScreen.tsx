import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, Alert, Pressable,
} from 'react-native';
import {
  ChevronLeft, Send, CreditCard, Printer, Percent, DollarSign, Users, Pencil,
  UserCog, ArrowLeftRight, Combine, Forward, Repeat, X, Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  Order, OrderItem,
  getOrderByTable, removeOrderItem, sendOrderToKitchen,
  setOrderDiscount, setOrderTip, setOrderGuests, setOrderObservations,
  changeOrderWaiter, changeOrderTable, cancelOrder, cancelOrderItem,
  fetchCancellationReasons, fetchActiveUsers, fetchTables, fetchFloors,
  printReceipt, fetchActiveOrders, mergeWithOrder,
} from '../api/client';
import ValueModal from '../components/ValueModal';
import PickerModal, { PickerOption } from '../components/PickerModal';
import Button from '../components/ui/Button';
import { showSuccess, showError, showInfo } from '../lib/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Order'>;

type ModalKind =
  | null
  | { kind: 'discount' }
  | { kind: 'tip' }
  | { kind: 'guests' }
  | { kind: 'notes' }
  | { kind: 'waiter'; options: PickerOption[]; loading: boolean }
  | { kind: 'table'; options: PickerOption[]; loading: boolean }
  | { kind: 'merge'; options: PickerOption[]; loading: boolean }
  | { kind: 'cancelItem'; item: OrderItem; reasons: Array<{ id: number; name: string }>; loading: boolean };

export default function OrderScreen({ route, navigation }: Props) {
  const { tableId, tableLabel } = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);

  const load = useCallback(async () => {
    if (!tableId) { setLoading(false); return; }
    try {
      const o = await getOrderByTable(tableId);
      setOrder(o);
    } catch (e: any) {
      showError('Error', e?.message || 'No se pudo cargar la orden');
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const hasOrder = !!order;
  const pendingItems = order?.items.filter(i => i.status === 'pending') ?? [];
  const sentItems = order?.items.filter(i => i.status !== 'pending' && i.status !== 'cancelled') ?? [];

  const needsOrder = () => {
    if (!order) { showInfo('Sin orden', 'Agrega productos primero para abrir la orden'); return true; }
    return false;
  };

  // ─── Actions ──────────────────────────────

  const handleSend = async () => {
    if (!order) { showInfo('Sin orden'); return; }
    if (pendingItems.length === 0) { showInfo('Nada por enviar'); return; }
    Alert.alert(
      'Enviar a cocina',
      `${pendingItems.length} ítem${pendingItems.length !== 1 ? 's' : ''} pendiente${pendingItems.length !== 1 ? 's' : ''}. Se imprimirá la comanda.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar', onPress: async () => {
            setActionLoading('send');
            try {
              setOrder(await sendOrderToKitchen(order.id));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showSuccess('✓ Enviado a cocina');
            } catch (e: any) {
              showError('Error', e?.response?.data?.error || e?.message);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleCobrar = () => showInfo('Cobrar', 'El cobro se hace desde la caja (desktop).');

  const handleImprimir = async () => {
    if (needsOrder() || !order) return;
    setActionLoading('print');
    try {
      await printReceipt(order.id);
      showSuccess('✓ Pre-cuenta enviada', 'Impresora de caja');
    } catch (e: any) {
      showError('Error', e?.response?.data?.error || e?.message);
    } finally {
      setActionLoading(null);
    }
  };

  const openDiscount = () => { if (!needsOrder()) setModal({ kind: 'discount' }); };
  const openTip = () => { if (!needsOrder()) setModal({ kind: 'tip' }); };
  const openGuests = () => { if (!needsOrder()) setModal({ kind: 'guests' }); };
  const openNotes = () => { if (!needsOrder()) setModal({ kind: 'notes' }); };

  const openWaiter = async () => {
    if (needsOrder()) return;
    setModal({ kind: 'waiter', options: [], loading: true });
    try {
      const users = await fetchActiveUsers();
      setModal({
        kind: 'waiter',
        loading: false,
        options: users.map(u => ({
          key: u.id, label: u.display_name, sub: u.role,
          color: u.avatar_color, disabled: u.id === order?.waiter_id,
        })),
      });
    } catch (e: any) { showError('Error', e?.message); setModal(null); }
  };

  const openTable = async () => {
    if (needsOrder()) return;
    setModal({ kind: 'table', options: [], loading: true });
    try {
      const floors = await fetchFloors();
      const all = await Promise.all(floors.map(f => fetchTables(f.id).then(ts => ts.map(t => ({ ...t, floorName: f.name })))));
      const flat = all.flat();
      setModal({
        kind: 'table', loading: false,
        options: flat.map(t => ({
          key: t.id, label: t.label,
          sub: `${t.floorName} · ${t.capacity} pax`,
          disabled: t.status !== 'free' || t.id === order?.table_id,
        })),
      });
    } catch (e: any) { showError('Error', e?.message); setModal(null); }
  };

  const openJuntar = async () => {
    if (needsOrder() || !order) return;
    setModal({ kind: 'merge', options: [], loading: true });
    try {
      const active = await fetchActiveOrders();
      setModal({
        kind: 'merge', loading: false,
        options: active.filter(o => o.id !== order.id && o.status !== 'cancelled').map(o => ({
          key: o.id, label: o.table_label ? `Mesa ${o.table_label}` : `Rápida`,
          sub: `#${o.daily_number} · ${o.waiter_name ?? ''}`,
        })),
      });
    } catch (e: any) { showError('Error', e?.message); setModal(null); }
  };

  const openTraspasar = () => showInfo('Próximamente', 'Selección de ítems para traspasar');
  const openRepetir = () => showInfo('Próximamente', 'Duplicar orden anterior de esta mesa');

  const handleCancelOrder = () => {
    if (!order) return;
    Alert.alert('¿Cancelar orden?', 'Cancela toda la orden. Requiere admin/manager.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar', style: 'destructive',
        onPress: async () => {
          try {
            await cancelOrder(order.id);
            showSuccess('Orden cancelada');
            navigation.goBack();
          } catch (e: any) {
            showError('Error', e?.response?.data?.error || e?.message);
          }
        },
      },
    ]);
  };

  const handleRemoveItem = async (item: OrderItem) => {
    if (!order) return;
    if (item.status === 'pending') {
      Alert.alert('¿Quitar ítem?', `${item.quantity}× ${item.product_name}`, [
        { text: 'No', style: 'cancel' },
        {
          text: 'Quitar', style: 'destructive',
          onPress: async () => {
            try {
              setOrder(await removeOrderItem(order.id, item.id));
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch (e: any) { showError('Error', e?.response?.data?.error || e?.message); }
          },
        },
      ]);
    } else {
      setModal({ kind: 'cancelItem', item, reasons: [], loading: true });
      try {
        const reasons = await fetchCancellationReasons();
        setModal({ kind: 'cancelItem', item, reasons, loading: false });
      } catch (e: any) { showError('Error', e?.message); setModal(null); }
    }
  };

  const submitDiscount = async (v: string) => {
    const pct = parseFloat(v);
    if (isNaN(pct) || pct < 0 || pct > 100) return showError('Inválido', 'Porcentaje 0-100');
    if (!order) return;
    try { setOrder(await setOrderDiscount(order.id, pct)); }
    catch (e: any) { showError('Error', e?.response?.data?.error || e?.message); }
  };

  const submitTip = async (v: string) => {
    const amount = parseFloat(v);
    if (isNaN(amount) || amount < 0) return showError('Inválido', 'Monto no válido');
    if (!order) return;
    try { setOrder(await setOrderTip(order.id, amount)); }
    catch (e: any) { showError('Error', e?.response?.data?.error || e?.message); }
  };

  const submitGuests = async (v: string) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < 1) return showError('Inválido', 'Número de personas');
    if (!order) return;
    try { setOrder(await setOrderGuests(order.id, n)); }
    catch (e: any) { showError('Error', e?.response?.data?.error || e?.message); }
  };

  const submitNotes = async (v: string) => {
    if (!order) return;
    try { setOrder(await setOrderObservations(order.id, v)); }
    catch (e: any) { showError('Error', e?.response?.data?.error || e?.message); }
  };

  const submitWaiter = async (id: string | number) => {
    if (!order) return;
    try { setOrder(await changeOrderWaiter(order.id, Number(id))); showSuccess('Mesero actualizado'); }
    catch (e: any) { showError('Error', e?.response?.data?.error || e?.message); }
  };

  const submitTable = async (id: string | number) => {
    if (!order) return;
    try {
      setOrder(await changeOrderTable(order.id, Number(id)));
      showSuccess('Mesa cambiada');
      setTimeout(() => navigation.goBack(), 600);
    } catch (e: any) { showError('Error', e?.response?.data?.error || e?.message); }
  };

  const submitMerge = async (id: string | number) => {
    if (!order) return;
    try {
      await mergeWithOrder(order.id, Number(id));
      showSuccess('Órdenes juntadas');
      setTimeout(() => navigation.goBack(), 600);
    } catch (e: any) { showError('Error', e?.response?.data?.error || e?.message); }
  };

  const submitCancelItem = async (reasonId: string | number) => {
    if (!order || modal?.kind !== 'cancelItem') return;
    const reason = modal.reasons.find(r => r.id === Number(reasonId));
    try { setOrder(await cancelOrderItem(order.id, modal.item.id, reason?.name ?? 'Sin motivo')); }
    catch (e: any) { showError('Error', e?.response?.data?.error || e?.message); }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-bg-base items-center justify-center">
        <ActivityIndicator color="#60A5FA" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-base">
      {/* Header */}
      <View className="px-4 pt-12 pb-3 flex-row items-center border-b border-bg-border">
        <Pressable onPress={() => navigation.goBack()} className="flex-row items-center py-1">
          <ChevronLeft size={22} color="#60A5FA" />
          <Text className="text-brand-400 text-sm">Mesas</Text>
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-ink-primary text-xl font-bold">{tableLabel}</Text>
          {order && (
            <Text className="text-ink-muted text-xs mt-0.5">
              #{order.daily_number} · {order.guest_count} {order.guest_count !== 1 ? 'personas' : 'persona'}
              {order.waiter_name ? ` · ${order.waiter_name}` : ''}
            </Text>
          )}
        </View>
        <View className="w-16" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Acciones principales — Enviar destaca con gradient */}
        <View className="p-3">
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            <ActionTile
              label="Enviar"
              icon={<Send size={20} color="#fff" />}
              tone="primary"
              loading={actionLoading === 'send'}
              disabled={!hasOrder || pendingItems.length === 0}
              onPress={handleSend}
              wide
            />
            <ActionTile label="Cobrar" icon={<CreditCard size={20} color="#fff" />} tone="success" onPress={handleCobrar} />
            <ActionTile label="Imprimir" icon={<Printer size={20} color="#CBD5E1" />} tone="neutral" loading={actionLoading === 'print'} disabled={!hasOrder} onPress={handleImprimir} />
            <ActionTile label="Descuento" icon={<Percent size={20} color="#fff" />} tone="warning" disabled={!hasOrder} onPress={openDiscount} />
            <ActionTile label="Propina" icon={<DollarSign size={20} color="#fff" />} tone="teal" disabled={!hasOrder} onPress={openTip} />
            <ActionTile label="Personas" icon={<Users size={20} color="#fff" />} tone="purple" disabled={!hasOrder} onPress={openGuests} />
            <ActionTile label="Notas" icon={<Pencil size={20} color="#fff" />} tone="indigo" disabled={!hasOrder} onPress={openNotes} />
            <ActionTile label="Mesero" icon={<UserCog size={20} color="#fff" />} tone="blue" disabled={!hasOrder} onPress={openWaiter} />
            <ActionTile label="Mesa" icon={<ArrowLeftRight size={20} color="#fff" />} tone="orange" disabled={!hasOrder || !tableId} onPress={openTable} />
            <ActionTile label="Juntar" icon={<Combine size={20} color="#fff" />} tone="purple" disabled={!hasOrder} onPress={openJuntar} />
            <ActionTile label="Traspasar" icon={<Forward size={20} color="#CBD5E1" />} tone="neutral" disabled={!hasOrder} onPress={openTraspasar} />
            <ActionTile label="Repetir" icon={<Repeat size={20} color="#fff" />} tone="lime" onPress={openRepetir} />
            <ActionTile label="Cancelar" icon={<X size={20} color="#fff" />} tone="danger" disabled={!hasOrder} onPress={handleCancelOrder} wide />
          </View>
        </View>

        {/* Empty */}
        {!order && (
          <View className="items-center py-10 px-6">
            <Text className="text-ink-primary text-lg font-semibold">Mesa libre</Text>
            <Text className="text-ink-muted text-sm text-center mt-1">Toca "Agregar productos" abajo para abrir la orden</Text>
          </View>
        )}

        {/* Items pendientes */}
        {pendingItems.length > 0 && (
          <View className="px-4 mt-2">
            <Text className="text-ink-muted text-[10px] font-bold tracking-wider mb-2">POR ENVIAR</Text>
            {pendingItems.map(item => (
              <ItemRow key={item.id} item={item} onRemove={() => handleRemoveItem(item)} />
            ))}
          </View>
        )}

        {/* Items en cocina */}
        {sentItems.length > 0 && (
          <View className="px-4 mt-2">
            <Text className="text-ink-muted text-[10px] font-bold tracking-wider mb-2">YA EN COCINA</Text>
            {sentItems.map(item => (
              <ItemRow key={item.id} item={item} onRemove={() => handleRemoveItem(item)} sent />
            ))}
          </View>
        )}

        {/* Notas */}
        {order?.notes ? (
          <View className="px-4 mt-3">
            <Text className="text-ink-muted text-[10px] font-bold tracking-wider mb-2">NOTAS</Text>
            <View className="bg-bg-card border border-bg-border rounded-xl p-3">
              <Text className="text-ink-secondary text-sm italic">{order.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* Descuento */}
        {order && Number(order.discount_amount) > 0 ? (
          <View className="px-5 mt-3 flex-row justify-between">
            <Text className="text-ink-muted text-sm">Descuento</Text>
            <Text className="text-warning text-sm font-semibold">-${Number(order.discount_amount).toFixed(2)}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer */}
      <View className="absolute left-0 right-0 bottom-0 bg-bg-card border-t border-bg-border p-3 pb-5">
        {order && (
          <View className="flex-row justify-between mb-2 px-1">
            <Text className="text-ink-muted">Total</Text>
            <Text className="text-ink-primary text-2xl font-bold">${Number(order.total).toFixed(2)}</Text>
          </View>
        )}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => navigation.navigate('Menu', { orderId: order?.id ?? null, tableId, tableLabel })}
        >
          + Agregar productos
        </Button>
      </View>

      {/* Modales */}
      <ValueModal visible={modal?.kind === 'discount'} title="Descuento" subtitle="% sobre subtotal" keyboardType="decimal-pad" suffix="%" initialValue={order?.discount_amount ? String(order.discount_amount) : ''} placeholder="0" submitLabel="Aplicar" onClose={() => setModal(null)} onSubmit={submitDiscount} />
      <ValueModal visible={modal?.kind === 'tip'} title="Propina" subtitle="Monto en pesos" keyboardType="decimal-pad" prefix="$" placeholder="0.00" submitLabel="Aplicar" onClose={() => setModal(null)} onSubmit={submitTip} />
      <ValueModal visible={modal?.kind === 'guests'} title="Número de personas" keyboardType="number-pad" initialValue={order ? String(order.guest_count) : '1'} placeholder="1" submitLabel="Guardar" onClose={() => setModal(null)} onSubmit={submitGuests} />
      <ValueModal visible={modal?.kind === 'notes'} title="Notas de la orden" subtitle="Visibles en cocina y ticket" multiline initialValue={order?.notes ?? ''} placeholder="Ej. alergia al maní, sin cebolla" submitLabel="Guardar" onClose={() => setModal(null)} onSubmit={submitNotes} />
      <PickerModal visible={modal?.kind === 'waiter'} title="Cambiar mesero" loading={modal?.kind === 'waiter' ? modal.loading : false} options={modal?.kind === 'waiter' ? modal.options : []} onClose={() => setModal(null)} onPick={submitWaiter} />
      <PickerModal visible={modal?.kind === 'table'} title="Cambiar de mesa" loading={modal?.kind === 'table' ? modal.loading : false} options={modal?.kind === 'table' ? modal.options : []} emptyText="Sin mesas libres" onClose={() => setModal(null)} onPick={submitTable} />
      <PickerModal visible={modal?.kind === 'merge'} title="Juntar con otra orden" loading={modal?.kind === 'merge' ? modal.loading : false} options={modal?.kind === 'merge' ? modal.options : []} emptyText="No hay otras órdenes activas" onClose={() => setModal(null)} onPick={submitMerge} />
      <PickerModal visible={modal?.kind === 'cancelItem'} title="Motivo de cancelación" loading={modal?.kind === 'cancelItem' ? modal.loading : false} options={modal?.kind === 'cancelItem' ? modal.reasons.map(r => ({ key: r.id, label: r.name })) : []} emptyText="Sin motivos configurados" onClose={() => setModal(null)} onPick={submitCancelItem} />
    </View>
  );
}

// ─── ActionTile ───
type Tone = 'primary' | 'success' | 'danger' | 'warning' | 'teal' | 'purple' | 'indigo' | 'blue' | 'orange' | 'lime' | 'neutral';
const TONE_BG: Record<Tone, string> = {
  primary: 'bg-brand-500',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  teal: 'bg-[#14B8A6]',
  purple: 'bg-[#A855F7]',
  indigo: 'bg-[#6366F1]',
  blue: 'bg-[#3B82F6]',
  orange: 'bg-[#F97316]',
  lime: 'bg-[#84CC16]',
  neutral: 'bg-bg-elevated border border-bg-border',
};

function ActionTile({
  label, icon, tone, onPress, disabled, loading, wide,
}: {
  label: string; icon: React.ReactNode; tone: Tone;
  onPress?: () => void; disabled?: boolean; loading?: boolean; wide?: boolean;
}) {
  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        width: wide ? '48%' : '23.5%',
      })}
      className={`${TONE_BG[tone]} rounded-2xl py-3 items-center justify-center min-h-[68]`}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          {icon}
          <Text className={`${tone === 'neutral' ? 'text-ink-secondary' : 'text-white'} text-xs font-semibold mt-1`}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// ─── ItemRow ───
function ItemRow({ item, onRemove, sent }: { item: OrderItem; onRemove: () => void; sent?: boolean }) {
  const modsText = item.modifiers?.map(m => m.modifier_name).filter(Boolean).join(', ');
  const modsExtra = item.modifiers?.reduce((s, m) => s + Number(m.price_extra), 0) ?? 0;
  const lineTotal = (Number(item.unit_price) + modsExtra) * item.quantity;

  return (
    <View
      className={`flex-row items-center bg-bg-card rounded-xl p-3 mb-1.5 gap-2.5 ${sent ? 'opacity-65 border-l-4 border-bg-border' : 'border border-bg-border'}`}
    >
      <Text className="text-brand-400 text-base font-bold w-7">{item.quantity}×</Text>
      <View className="flex-1">
        <Text className="text-ink-primary text-sm font-medium">{item.product_name}</Text>
        {modsText ? <Text className="text-ink-muted text-xs mt-0.5">{modsText}</Text> : null}
        {item.notes ? <Text className="text-warning text-[11px] italic mt-0.5">Nota: {item.notes}</Text> : null}
      </View>
      <Text className="text-ink-primary text-sm font-semibold">${lineTotal.toFixed(2)}</Text>
      <Pressable
        onPress={onRemove}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        className={`w-9 h-9 rounded-full items-center justify-center ${sent ? 'bg-bg-elevated' : 'bg-danger/80'}`}
      >
        {sent ? <X size={16} color="#94A3B8" /> : <Trash2 size={14} color="#fff" />}
      </Pressable>
    </View>
  );
}
