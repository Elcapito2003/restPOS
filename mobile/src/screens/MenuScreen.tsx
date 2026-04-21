import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
  Modal,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  Category, Product, ModifierGroup, Modifier,
  fetchCategoriesTree, fetchProducts, fetchModifierGroups,
  addOrderItem, createOrder,
} from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'Menu'>;

export default function MenuScreen({ route, navigation }: Props) {
  const { orderId: initialOrderId, tableId, tableLabel } = route.params;

  const [categories, setCategories] = useState<Category[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [activeRoot, setActiveRoot] = useState<Category | null>(null);
  const [activeSub, setActiveSub] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productLoading, setProductLoading] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(initialOrderId);

  const [picker, setPicker] = useState<{ product: Product; groups: ModifierGroup[] } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cats, mods] = await Promise.all([fetchCategoriesTree(), fetchModifierGroups()]);
        setCategories(cats);
        setModifierGroups(mods);
        if (cats.length) setActiveRoot(cats[0]);
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'No se pudo cargar el menú');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeCategory = activeSub || activeRoot;
  const subcategories = useMemo(() => activeRoot?.children ?? [], [activeRoot]);

  useEffect(() => {
    if (!activeCategory) return;
    setProductLoading(true);
    fetchProducts(activeCategory.id)
      .then(list => setProducts(list.filter(p => p.is_available)))
      .catch(() => setProducts([]))
      .finally(() => setProductLoading(false));
  }, [activeCategory?.id]);

  const ensureOrder = async (): Promise<number> => {
    if (orderId) return orderId;
    const o = await createOrder({ table_id: tableId || undefined, order_type: tableId ? 'dine_in' : 'quick' });
    setOrderId(o.id);
    return o.id;
  };

  const handleProductPress = (p: Product) => {
    const groups = modifierGroups.filter(g => g.product_ids?.includes(p.id));
    if (groups.length === 0) {
      addItemImmediate(p, []);
    } else {
      setPicker({ product: p, groups });
    }
  };

  const addItemImmediate = async (p: Product, modifiers: { modifier_id: number }[]) => {
    try {
      const oid = await ensureOrder();
      await addOrderItem(oid, { product_id: p.id, quantity: 1, modifiers });
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || e?.message || 'No se pudo agregar');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>{tableLabel}</Text>
          <Text style={styles.subtitle}>Menú</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            if (tableId) navigation.navigate('Order', { tableId, tableLabel, floorId: null, orderId: orderId ?? undefined });
            else navigation.navigate('Tables');
          }}
          style={styles.cartBtn}
        >
          <Text style={styles.cartBtnText}>Ver ticket ›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#3B82F6" size="large" /></View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catTabs} contentContainerStyle={{ paddingHorizontal: 10 }}>
            {categories.map(c => (
              <TouchableOpacity
                key={c.id}
                onPress={() => { setActiveRoot(c); setActiveSub(null); }}
                style={[styles.catTab, activeRoot?.id === c.id && styles.catTabActive]}
              >
                <Text style={[styles.catTabText, activeRoot?.id === c.id && styles.catTabTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {subcategories.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabs} contentContainerStyle={{ paddingHorizontal: 10 }}>
              <TouchableOpacity
                onPress={() => setActiveSub(null)}
                style={[styles.subTab, !activeSub && styles.subTabActive]}
              >
                <Text style={[styles.subTabText, !activeSub && styles.subTabTextActive]}>Todos</Text>
              </TouchableOpacity>
              {subcategories.map(sc => (
                <TouchableOpacity
                  key={sc.id}
                  onPress={() => setActiveSub(sc)}
                  style={[styles.subTab, activeSub?.id === sc.id && styles.subTabActive]}
                >
                  <Text style={[styles.subTabText, activeSub?.id === sc.id && styles.subTabTextActive]}>{sc.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <ScrollView contentContainerStyle={styles.productGrid}>
            {productLoading ? (
              <ActivityIndicator color="#3B82F6" style={{ marginTop: 40 }} />
            ) : products.length === 0 ? (
              <Text style={styles.emptyText}>Sin productos en esta categoría</Text>
            ) : products.map(p => (
              <TouchableOpacity key={p.id} style={styles.productCard} onPress={() => handleProductPress(p)}>
                <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
                <Text style={styles.productPrice}>${Number(p.price).toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      <Modal visible={!!picker} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
        {picker && (
          <ModifierPicker
            product={picker.product}
            groups={picker.groups}
            onCancel={() => setPicker(null)}
            onConfirm={async (selected) => {
              setPicker(null);
              await addItemImmediate(picker.product, selected.map(id => ({ modifier_id: id })));
            }}
          />
        )}
      </Modal>
    </View>
  );
}

function ModifierPicker({
  product, groups, onCancel, onConfirm,
}: {
  product: Product;
  groups: ModifierGroup[];
  onCancel: () => void;
  onConfirm: (modifierIds: number[]) => void;
}) {
  const [selected, setSelected] = useState<Record<number, number[]>>({}); // groupId -> modifierIds[]

  const toggle = (group: ModifierGroup, mod: Modifier) => {
    setSelected(prev => {
      const current = prev[group.id] ?? [];
      const isSelected = current.includes(mod.id);
      if (group.max_selections === 1) {
        return { ...prev, [group.id]: isSelected ? [] : [mod.id] };
      }
      if (isSelected) {
        return { ...prev, [group.id]: current.filter(id => id !== mod.id) };
      }
      if (group.max_selections > 0 && current.length >= group.max_selections) {
        return prev;
      }
      return { ...prev, [group.id]: [...current, mod.id] };
    });
  };

  const canConfirm = groups.every(g => {
    const count = (selected[g.id] ?? []).length;
    if (g.is_required && count < Math.max(1, g.min_selections)) return false;
    if (count < g.min_selections) return false;
    return true;
  });

  const flatIds = Object.values(selected).flat();
  const extra = groups.flatMap(g => (selected[g.id] ?? []).map(id => {
    const mod = g.modifiers.find(m => m.id === id);
    return mod ? Number(mod.price_extra) : 0;
  })).reduce((a, b) => a + b, 0);
  const totalPrice = Number(product.price) + extra;

  return (
    <View style={mpStyles.overlay}>
      <View style={mpStyles.sheet}>
        <View style={mpStyles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={mpStyles.title}>{product.name}</Text>
            <Text style={mpStyles.price}>${totalPrice.toFixed(2)}</Text>
          </View>
          <TouchableOpacity onPress={onCancel}>
            <Text style={mpStyles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: 420 }}>
          {groups.map(g => {
            const selectedCount = (selected[g.id] ?? []).length;
            const rangeText = g.max_selections === 1
              ? (g.is_required ? 'Elige 1' : 'Elige hasta 1')
              : `Elige ${g.min_selections}${g.max_selections > 0 ? `-${g.max_selections}` : '+'}`;
            return (
              <View key={g.id} style={mpStyles.group}>
                <View style={mpStyles.groupHeader}>
                  <Text style={mpStyles.groupName}>{g.name}</Text>
                  <Text style={[mpStyles.groupHint, g.is_required && { color: '#EF4444' }]}>
                    {rangeText}{g.is_required ? ' · requerido' : ''}
                  </Text>
                </View>
                {g.modifiers.map(m => {
                  const isSelected = (selected[g.id] ?? []).includes(m.id);
                  const extraNum = Number(m.price_extra);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[mpStyles.modRow, isSelected && mpStyles.modRowActive]}
                      onPress={() => toggle(g, m)}
                    >
                      <View style={[mpStyles.check, isSelected && mpStyles.checkOn]}>
                        {isSelected && <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text>}
                      </View>
                      <Text style={[mpStyles.modName, isSelected && { color: '#fff' }]}>{m.name}</Text>
                      {extraNum !== 0 && (
                        <Text style={mpStyles.modExtra}>
                          {extraNum > 0 ? '+' : ''}${Math.abs(extraNum).toFixed(2)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
                {g.is_required && selectedCount < Math.max(1, g.min_selections) && (
                  <Text style={mpStyles.requiredHint}>Falta seleccionar</Text>
                )}
              </View>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[mpStyles.confirmBtn, !canConfirm && { opacity: 0.4 }]}
          disabled={!canConfirm}
          onPress={() => onConfirm(flatIds)}
        >
          <Text style={mpStyles.confirmText}>Agregar · ${totalPrice.toFixed(2)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backBtn: { width: 40 },
  backText: { color: '#93C5FD', fontSize: 32 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  cartBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  cartBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  catTabs: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  catTab: { paddingHorizontal: 16, paddingVertical: 12, marginRight: 4 },
  catTabActive: { borderBottomWidth: 2, borderBottomColor: '#3B82F6' },
  catTabText: { color: '#94A3B8', fontSize: 14, fontWeight: '500' },
  catTabTextActive: { color: '#fff', fontWeight: '700' },
  subTabs: { maxHeight: 44, paddingVertical: 6 },
  subTab: { paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, backgroundColor: '#1E293B', borderRadius: 8 },
  subTabActive: { backgroundColor: '#3B82F6' },
  subTabText: { color: '#94A3B8', fontSize: 12 },
  subTabTextActive: { color: '#fff' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, paddingBottom: 30 },
  productCard: { width: '48%', backgroundColor: '#1E293B', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#334155', minHeight: 80, justifyContent: 'space-between' },
  productName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  productPrice: { color: '#93C5FD', fontSize: 16, fontWeight: '700', marginTop: 6 },
  emptyText: { color: '#64748B', flex: 1, textAlign: 'center', marginTop: 40 },
});

const mpStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1E293B', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 30, maxHeight: '85%' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  price: { color: '#93C5FD', fontSize: 16, marginTop: 4 },
  closeText: { color: '#94A3B8', fontSize: 22, padding: 6 },
  group: { marginBottom: 16 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  groupName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  groupHint: { color: '#64748B', fontSize: 11 },
  modRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#1E293B' },
  modRowActive: { borderColor: '#3B82F6', backgroundColor: '#1E3A8A' },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#475569', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  checkOn: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  modName: { color: '#CBD5E1', fontSize: 14, flex: 1 },
  modExtra: { color: '#93C5FD', fontSize: 13, marginLeft: 8 },
  requiredHint: { color: '#EF4444', fontSize: 11, marginTop: 4, marginLeft: 4 },
  confirmBtn: { backgroundColor: '#3B82F6', paddingVertical: 16, borderRadius: 14, marginTop: 12 },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
