import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  Order, OrderItem,
  getOrderByTable, removeOrderItem, sendOrderToKitchen,
  setOrderDiscount, setOrderTip, setOrderGuests, setOrderObservations,
  changeOrderWaiter, changeOrderTable, cancelOrder, cancelOrderItem,
  fetchCancellationReasons, fetchActiveUsers, fetchTables, fetchFloors,
  printReceipt, printComanda, fetchActiveOrders, mergeWithOrder,
} from '../api/client';
import ActionButton from '../components/ActionButton';
import ValueModal from '../components/ValueModal';
import PickerModal, { PickerOption } from '../components/PickerModal';

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
      Alert.alert('Error', e?.message || 'No se pudo cargar la orden');
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const hasOrder = !!order;
  const pendingItems = order?.items.filter(i => i.status === 'pending') ?? [];
  const sentItems = order?.items.filter(i => i.status !== 'pending' && i.status !== 'cancelled') ?? [];

  // ─── Actions ─────────────────────────────────────────

  const needsOrder = () => {
    if (!order) { Alert.alert('Sin orden', 'Agrega productos primero para abrir la orden'); return true; }
    return false;
  };

  const handleSend = async () => {
    if (!order) { Alert.alert('Sin orden', 'No hay nada por enviar'); return; }
    if (pendingItems.length === 0) { Alert.alert('Nada por enviar', 'No hay ítems pendientes'); return; }
    Alert.alert(
      'Enviar a cocina',
      `${pendingItems.length} ítem${pendingItems.length !== 1 ? 's' : ''} pendiente${pendingItems.length !== 1 ? 's' : ''}. Se imprimirá la comanda en cocina y barra.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            setActionLoading('send');
            try {
              const updated = await sendOrderToKitchen(order.id);
              setOrder(updated);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || e?.message);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleCobrar = () => {
    Alert.alert('Cobrar', 'El cobro se hace desde la caja (desktop). El mesero solo toma la orden.');
  };

  const handleImprimir = async () => {
    if (needsOrder() || !order) return;
    setActionLoading('print');
    try {
      await printReceipt(order.id);
      Alert.alert('✓ Enviado a impresora', 'Pre-cuenta en la impresora de caja');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || e?.message);
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
          key: u.id,
          label: u.display_name,
          sub: u.role,
          color: u.avatar_color,
          disabled: u.id === order?.waiter_id,
        })),
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message);
      setModal(null);
    }
  };

  const openTable = async () => {
    if (needsOrder()) return;
    setModal({ kind: 'table', options: [], loading: true });
    try {
      const floors = await fetchFloors();
      const all = await Promise.all(floors.map(f => fetchTables(f.id).then(ts => ts.map(t => ({ ...t, floorName: f.name })))));
      const flat = all.flat();
      setModal({
        kind: 'table',
        loading: false,
        options: flat.map(t => ({
          key: t.id,
          label: t.label,
          sub: `${t.floorName} · ${t.capacity} pax`,
          disabled: t.status !== 'free' || t.id === order?.table_id,
        })),
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message);
      setModal(null);
    }
  };

  const openJuntar = async () => {
    if (needsOrder() || !order) return;
    setModal({ kind: 'merge', options: [], loading: true });
    try {
      const active = await fetchActiveOrders();
      const options = active
        .filter(o => o.id !== order.id && o.status !== 'cancelled')
        .map(o => ({
          key: o.id,
          label: o.table_label ? `Mesa ${o.table_label}` : `Rápida`,
          sub: `#${o.daily_number} · ${o.waiter_name ?? ''}`,
        }));
      setModal({ kind: 'merge', loading: false, options });
    } catch (e: any) {
      Alert.alert('Error', e?.message);
      setModal(null);
    }
  };

  const openTraspasar = () => {
    Alert.alert('Traspasar', 'Próximamente: seleccionar ítems y traspasarlos a otra orden. Por ahora usa el desktop.');
  };

  const openRepetir = () => {
    Alert.alert('Repetir', 'Próximamente: duplica la orden anterior de esta mesa. Por ahora usa el desktop.');
  };

  const handleCancelOrder = () => {
    if (!order) return;
    Alert.alert(
      '¿Cancelar orden?',
      'Esto cancela toda la orden. Se requiere permiso admin o manager en el backend.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelOrder(order.id);
              Alert.alert('✓ Cancelada', '', [{ text: 'OK', onPress: () => navigation.goBack() }]);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || e?.message);
            }
          },
        },
      ]
    );
  };

  const handleRemoveItem = async (item: OrderItem) => {
    if (!order) return;
    if (item.status === 'pending') {
      Alert.alert('¿Quitar ítem?', `${item.quantity}× ${item.product_name}`, [
        { text: 'No', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await removeOrderItem(order.id, item.id);
              setOrder(updated);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || e?.message);
            }
          },
        },
      ]);
    } else {
      // sent/preparing/ready → requires cancellation with reason
      setModal({ kind: 'cancelItem', item, reasons: [], loading: true });
      try {
        const reasons = await fetchCancellationReasons();
        setModal({ kind: 'cancelItem', item, reasons, loading: false });
      } catch (e: any) {
        Alert.alert('Error', e?.message);
        setModal(null);
      }
    }
  };

  // ─── Modal submit handlers ─────────────────────────

  const submitDiscount = async (v: string) => {
    const pct = parseFloat(v);
    if (isNaN(pct) || pct < 0 || pct > 100) return Alert.alert('Inválido', 'Porcentaje entre 0 y 100');
    if (!order) return;
    try { setOrder(await setOrderDiscount(order.id, pct)); }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.error || e?.message); }
  };

  const submitTip = async (v: string) => {
    const amount = parseFloat(v);
    if (isNaN(amount) || amount < 0) return Alert.alert('Inválido', 'Monto no válido');
    if (!order) return;
    try { setOrder(await setOrderTip(order.id, amount)); }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.error || e?.message); }
  };

  const submitGuests = async (v: string) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < 1) return Alert.alert('Inválido', 'Número de personas');
    if (!order) return;
    try { setOrder(await setOrderGuests(order.id, n)); }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.error || e?.message); }
  };

  const submitNotes = async (v: string) => {
    if (!order) return;
    try { setOrder(await setOrderObservations(order.id, v)); }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.error || e?.message); }
  };

  const submitWaiter = async (waiterId: string | number) => {
    if (!order) return;
    try { setOrder(await changeOrderWaiter(order.id, Number(waiterId))); }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.error || e?.message); }
  };

  const submitTable = async (tableId: string | number) => {
    if (!order) return;
    try {
      const updated = await changeOrderTable(order.id, Number(tableId));
      setOrder(updated);
      Alert.alert('✓ Mesa cambiada', 'La orden se movió a la nueva mesa', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.error || e?.message); }
  };

  const submitMerge = async (targetOrderId: string | number) => {
    if (!order) return;
    try {
      await mergeWithOrder(order.id, Number(targetOrderId));
      Alert.alert('✓ Juntadas', 'Las órdenes fueron combinadas', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.error || e?.message); }
  };

  const submitCancelItem = async (reasonId: string | number) => {
    if (!order || modal?.kind !== 'cancelItem') return;
    const reason = modal.reasons.find(r => r.id === Number(reasonId));
    try {
      setOrder(await cancelOrderItem(order.id, modal.item.id, reason?.name ?? 'Sin motivo'));
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.error || e?.message); }
  };

  // ─── Render ────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#3B82F6" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Mesas</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.tableLabel}>{tableLabel}</Text>
          {order && (
            <Text style={styles.orderNumber}>
              #{order.daily_number} · {order.guest_count} pers{order.guest_count !== 1 ? 'onas' : 'ona'}
              {order.waiter_name ? ` · ${order.waiter_name}` : ''}
            </Text>
          )}
        </View>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Acciones */}
        <View style={styles.actionsGrid}>
          <ActionButton label="Enviar" icon="➤" color="#60A5FA" onPress={handleSend} loading={actionLoading === 'send'} disabled={!hasOrder || pendingItems.length === 0} />
          <ActionButton label="Cobrar" icon="💳" color="#86EFAC" onPress={handleCobrar} />
          <ActionButton label="Imprimir" icon="🖨" color="#475569" onPress={handleImprimir} loading={actionLoading === 'print'} disabled={!hasOrder} />
          <ActionButton label="Descuento" icon="%" color="#F59E0B" onPress={openDiscount} disabled={!hasOrder} />

          <ActionButton label="Propina" icon="$" color="#14B8A6" onPress={openTip} disabled={!hasOrder} />
          <ActionButton label="Personas" icon="👥" color="#A855F7" onPress={openGuests} disabled={!hasOrder} />
          <ActionButton label="Notas" icon="✎" color="#6366F1" onPress={openNotes} disabled={!hasOrder} />
          <ActionButton label="Cambiar Mesero" icon="👤" color="#3B82F6" onPress={openWaiter} disabled={!hasOrder} />

          <ActionButton label="Cambiar Mesa" icon="⇄" color="#F97316" onPress={openTable} disabled={!hasOrder || !tableId} />
          <ActionButton label="Juntar" icon="⋃" color="#8B5CF6" onPress={openJuntar} disabled={!hasOrder} />
          <ActionButton label="Traspasar" icon="⤳" color="#94A3B8" onPress={openTraspasar} disabled={!hasOrder} />
          <ActionButton label="Repetir" icon="↻" color="#84CC16" onPress={openRepetir} />

          <ActionButton label="Cancelar" icon="⊘" color="#DC2626" onPress={handleCancelOrder} disabled={!hasOrder} />
        </View>

        {/* Items */}
        {!order && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Mesa libre</Text>
            <Text style={styles.emptySubtitle}>Toca "Agregar productos" para abrir la orden</Text>
          </View>
        )}

        {pendingItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>POR ENVIAR</Text>
            {pendingItems.map(item => (
              <ItemRow key={item.id} item={item} onRemove={() => handleRemoveItem(item)} />
            ))}
          </View>
        )}

        {sentItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>YA EN COCINA</Text>
            {sentItems.map(item => (
              <ItemRow key={item.id} item={item} onRemove={() => handleRemoveItem(item)} sent />
            ))}
          </View>
        )}

        {order?.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NOTAS</Text>
            <View style={styles.notesBox}><Text style={styles.notesText}>{order.notes}</Text></View>
          </View>
        ) : null}

        {order && Number(order.discount_amount) > 0 ? (
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Descuento</Text>
            <Text style={styles.totalsValue}>-${Number(order.discount_amount).toFixed(2)}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {order && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${Number(order.total).toFixed(2)}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.addBtn]}
          onPress={() => navigation.navigate('Menu', { orderId: order?.id ?? null, tableId, tableLabel })}
        >
          <Text style={styles.addBtnText}>+ Agregar productos</Text>
        </TouchableOpacity>
      </View>

      {/* Modales */}
      <ValueModal
        visible={modal?.kind === 'discount'}
        title="Descuento"
        subtitle="Porcentaje sobre el subtotal"
        keyboardType="decimal-pad"
        suffix="%"
        initialValue={order?.discount_amount ? String(order.discount_amount) : ''}
        placeholder="0"
        submitLabel="Aplicar"
        onClose={() => setModal(null)}
        onSubmit={submitDiscount}
      />
      <ValueModal
        visible={modal?.kind === 'tip'}
        title="Propina"
        subtitle="Monto en pesos"
        keyboardType="decimal-pad"
        prefix="$"
        placeholder="0.00"
        submitLabel="Aplicar"
        onClose={() => setModal(null)}
        onSubmit={submitTip}
      />
      <ValueModal
        visible={modal?.kind === 'guests'}
        title="Número de personas"
        keyboardType="number-pad"
        initialValue={order ? String(order.guest_count) : '1'}
        placeholder="1"
        submitLabel="Guardar"
        onClose={() => setModal(null)}
        onSubmit={submitGuests}
      />
      <ValueModal
        visible={modal?.kind === 'notes'}
        title="Notas de la orden"
        subtitle="Visibles en cocina y el ticket"
        multiline
        initialValue={order?.notes ?? ''}
        placeholder="Ej. alergia al maní, sin cebolla, cumpleaños"
        submitLabel="Guardar"
        onClose={() => setModal(null)}
        onSubmit={submitNotes}
      />
      <PickerModal
        visible={modal?.kind === 'waiter'}
        title="Cambiar mesero"
        loading={modal?.kind === 'waiter' ? modal.loading : false}
        options={modal?.kind === 'waiter' ? modal.options : []}
        onClose={() => setModal(null)}
        onPick={submitWaiter}
      />
      <PickerModal
        visible={modal?.kind === 'table'}
        title="Cambiar de mesa"
        loading={modal?.kind === 'table' ? modal.loading : false}
        options={modal?.kind === 'table' ? modal.options : []}
        emptyText="Sin mesas libres"
        onClose={() => setModal(null)}
        onPick={submitTable}
      />
      <PickerModal
        visible={modal?.kind === 'merge'}
        title="Juntar con otra orden"
        loading={modal?.kind === 'merge' ? modal.loading : false}
        options={modal?.kind === 'merge' ? modal.options : []}
        emptyText="No hay otras órdenes activas"
        onClose={() => setModal(null)}
        onPick={submitMerge}
      />
      <PickerModal
        visible={modal?.kind === 'cancelItem'}
        title="Motivo de cancelación"
        loading={modal?.kind === 'cancelItem' ? modal.loading : false}
        options={modal?.kind === 'cancelItem' ? modal.reasons.map(r => ({ key: r.id, label: r.name })) : []}
        emptyText="Sin motivos configurados"
        onClose={() => setModal(null)}
        onPick={submitCancelItem}
      />
    </View>
  );
}

function ItemRow({ item, onRemove, sent }: { item: OrderItem; onRemove: () => void; sent?: boolean }) {
  const modsText = item.modifiers?.map(m => m.modifier_name).filter(Boolean).join(', ');
  const modsExtra = item.modifiers?.reduce((s, m) => s + Number(m.price_extra), 0) ?? 0;
  const lineTotal = (Number(item.unit_price) + modsExtra) * item.quantity;
  return (
    <View style={[itemStyles.row, sent && itemStyles.rowSent]}>
      <Text style={itemStyles.qty}>{item.quantity}×</Text>
      <View style={{ flex: 1 }}>
        <Text style={itemStyles.name}>{item.product_name}</Text>
        {modsText ? <Text style={itemStyles.mods}>{modsText}</Text> : null}
        {item.notes ? <Text style={itemStyles.notes}>Nota: {item.notes}</Text> : null}
      </View>
      <Text style={itemStyles.price}>${lineTotal.toFixed(2)}</Text>
      <TouchableOpacity style={[itemStyles.removeBtn, sent && itemStyles.removeBtnSent]} onPress={onRemove}>
        <Text style={itemStyles.removeBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backBtn: { width: 70 },
  backText: { color: '#93C5FD', fontSize: 15 },
  headerCenter: { flex: 1, alignItems: 'center' },
  tableLabel: { color: '#fff', fontSize: 22, fontWeight: '700' },
  orderNumber: { color: '#94A3B8', fontSize: 11, marginTop: 2, textAlign: 'center' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10 },
  emptyState: { padding: 30, alignItems: 'center' },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptySubtitle: { color: '#94A3B8', fontSize: 14, marginTop: 6, textAlign: 'center' },
  section: { paddingHorizontal: 14, marginTop: 8 },
  sectionTitle: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6, marginTop: 10 },
  notesBox: { backgroundColor: '#1E293B', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#334155' },
  notesText: { color: '#CBD5E1', fontSize: 13, fontStyle: 'italic' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 18, marginTop: 10 },
  totalsLabel: { color: '#94A3B8', fontSize: 13 },
  totalsValue: { color: '#FBBF24', fontSize: 14, fontWeight: '600' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#1E293B', borderTopWidth: 1, borderTopColor: '#334155', padding: 12, paddingBottom: 18 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 },
  totalLabel: { color: '#94A3B8', fontSize: 14 },
  totalValue: { color: '#fff', fontSize: 22, fontWeight: '700' },
  addBtn: { backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});

const itemStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E293B', borderRadius: 12, padding: 12, marginBottom: 6, gap: 10,
  },
  rowSent: { opacity: 0.65, borderLeftWidth: 3, borderLeftColor: '#64748B' },
  qty: { color: '#93C5FD', fontSize: 16, fontWeight: '700', minWidth: 30 },
  name: { color: '#fff', fontSize: 15, fontWeight: '500' },
  mods: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  notes: { color: '#FBBF24', fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  price: { color: '#fff', fontSize: 15, fontWeight: '600' },
  removeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#7F1D1D', alignItems: 'center', justifyContent: 'center' },
  removeBtnSent: { backgroundColor: '#334155' },
  removeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
