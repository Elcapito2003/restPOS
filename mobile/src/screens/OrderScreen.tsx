import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { Order, OrderItem, getOrderByTable, removeOrderItem, sendOrderToKitchen } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'Order'>;

export default function OrderScreen({ route, navigation }: Props) {
  const { tableId, tableLabel } = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

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

  const handleRemoveItem = (item: OrderItem) => {
    if (item.status !== 'pending') {
      Alert.alert('No se puede quitar', 'Este ítem ya fue enviado a cocina');
      return;
    }
    Alert.alert('¿Quitar ítem?', `${item.product_name} x${item.quantity}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar', style: 'destructive',
        onPress: async () => {
          if (!order) return;
          try {
            const updated = await removeOrderItem(order.id, item.id);
            setOrder(updated);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'No se pudo quitar');
          }
        }
      },
    ]);
  };

  const handleSend = async () => {
    if (!order) return;
    const pendingCount = order.items.filter(i => i.status === 'pending').length;
    if (pendingCount === 0) {
      Alert.alert('Nada por enviar', 'No hay ítems pendientes');
      return;
    }
    Alert.alert(
      'Enviar a cocina',
      `${pendingCount} ítem${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''}. Se imprimirá comanda en cocina y barra.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            setSending(true);
            try {
              const updated = await sendOrderToKitchen(order.id);
              setOrder(updated);
              Alert.alert('✓ Enviado', 'La comanda se mandó a cocina');
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error || e?.message || 'No se pudo enviar');
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#3B82F6" size="large" />
      </View>
    );
  }

  const items = order?.items ?? [];
  const pendingItems = items.filter(i => i.status === 'pending');
  const sentItems = items.filter(i => i.status !== 'pending');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Mesas</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.tableLabel}>{tableLabel}</Text>
          {order && <Text style={styles.orderNumber}>Orden #{order.daily_number}</Text>}
        </View>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {!order && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Mesa libre</Text>
            <Text style={styles.emptySubtitle}>Agrega productos para abrir la orden</Text>
          </View>
        )}

        {pendingItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>POR ENVIAR</Text>
            {pendingItems.map(item => (
              <ItemRow key={item.id} item={item} onLongPress={() => handleRemoveItem(item)} />
            ))}
          </View>
        )}

        {sentItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>YA EN COCINA</Text>
            {sentItems.map(item => (
              <ItemRow key={item.id} item={item} muted />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {order && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${Number(order.total).toFixed(2)}</Text>
          </View>
        )}
        <View style={styles.footerBtns}>
          <TouchableOpacity
            style={[styles.btn, styles.btnAdd]}
            onPress={() => navigation.navigate('Menu', { orderId: order?.id ?? null, tableId, tableLabel })}
          >
            <Text style={styles.btnText}>+ Agregar productos</Text>
          </TouchableOpacity>
          {pendingItems.length > 0 && (
            <TouchableOpacity
              style={[styles.btn, styles.btnSend, sending && { opacity: 0.6 }]}
              onPress={handleSend}
              disabled={sending}
            >
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Enviar a cocina</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function ItemRow({ item, onLongPress, muted }: { item: OrderItem; onLongPress?: () => void; muted?: boolean }) {
  const modsText = item.modifiers?.map(m => m.modifier_name).filter(Boolean).join(', ');
  const lineTotal = (Number(item.unit_price) + (item.modifiers?.reduce((s, m) => s + Number(m.price_extra), 0) || 0)) * item.quantity;
  return (
    <TouchableOpacity
      activeOpacity={onLongPress ? 0.6 : 1}
      onLongPress={onLongPress}
      style={[styles.itemRow, muted && styles.itemRowMuted]}
    >
      <Text style={styles.itemQty}>{item.quantity}×</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName}>{item.product_name}</Text>
        {modsText ? <Text style={styles.itemMods}>{modsText}</Text> : null}
        {item.notes ? <Text style={styles.itemNotes}>Nota: {item.notes}</Text> : null}
      </View>
      <Text style={styles.itemPrice}>${lineTotal.toFixed(2)}</Text>
    </TouchableOpacity>
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
  orderNumber: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptySubtitle: { color: '#94A3B8', fontSize: 14, marginTop: 6 },
  section: { paddingHorizontal: 14, marginTop: 12 },
  sectionTitle: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6, marginTop: 10 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E293B', borderRadius: 12, padding: 12, marginBottom: 6,
    gap: 10,
  },
  itemRowMuted: { opacity: 0.55 },
  itemQty: { color: '#93C5FD', fontSize: 16, fontWeight: '700', minWidth: 30 },
  itemName: { color: '#fff', fontSize: 15, fontWeight: '500' },
  itemMods: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  itemNotes: { color: '#FBBF24', fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  itemPrice: { color: '#fff', fontSize: 15, fontWeight: '600' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#1E293B', borderTopWidth: 1, borderTopColor: '#334155', padding: 12, paddingBottom: 18 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 },
  totalLabel: { color: '#94A3B8', fontSize: 14 },
  totalValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
  footerBtns: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnAdd: { backgroundColor: '#334155' },
  btnSend: { backgroundColor: '#22C55E' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
