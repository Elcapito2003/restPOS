import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, Pressable,
  Modal, Animated, TextInput,
} from 'react-native';
import { ChevronLeft, Check, X, ShoppingCart, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  Category, Product, ModifierGroup, Modifier, Order,
  fetchCategoriesTree, fetchProducts, fetchModifierGroups,
  addOrderItem, createOrder, getOrderByTable,
} from '../api/client';
import Button from '../components/ui/Button';
import { showError } from '../lib/toast';

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
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const [cats, mods] = await Promise.all([fetchCategoriesTree(), fetchModifierGroups()]);
        setCategories(cats);
        setModifierGroups(mods);
        if (cats.length) setActiveRoot(cats[0]);
        if (tableId) {
          const existing = await getOrderByTable(tableId);
          if (existing) setCurrentOrder(existing);
        }
      } catch (e: any) {
        showError('Error', e?.message || 'No se pudo cargar el menú');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const flashAdded = (name: string) => {
    setJustAdded(name);
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 1400, useNativeDriver: true }).start(() => setJustAdded(null));
  };

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Siempre abrimos el picker — permite agregar notas aunque el producto no tenga modificadores
    const groups = modifierGroups.filter(g => g.product_ids?.includes(p.id));
    setPicker({ product: p, groups });
  };

  const addItemImmediate = async (p: Product, modifiers: { modifier_id: number }[], notes?: string) => {
    try {
      const oid = await ensureOrder();
      const updated = await addOrderItem(oid, { product_id: p.id, quantity: 1, modifiers, notes: notes?.trim() || undefined });
      setCurrentOrder(updated);
      flashAdded(p.name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      showError('Error', e?.response?.data?.error || e?.message || 'No se pudo agregar');
    }
  };

  const pendingCount = currentOrder?.items.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.quantity), 0) ?? 0;
  const orderTotal = currentOrder ? Number(currentOrder.total) : 0;

  const goToTicket = () => {
    if (tableId) navigation.navigate('Order', { tableId, tableLabel, floorId: null, orderId: orderId ?? undefined });
    else navigation.navigate('Tables');
  };

  return (
    <View className="flex-1 bg-bg-base">
      {/* Header */}
      <View className="px-4 pt-12 pb-3 flex-row items-center border-b border-bg-border">
        <Pressable onPress={() => navigation.goBack()} className="p-2 -ml-2">
          <ChevronLeft size={28} color="#60A5FA" />
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-ink-primary text-lg font-bold">{tableLabel}</Text>
          <Text className="text-ink-muted text-xs">Menú</Text>
        </View>
        <View className="w-10" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#60A5FA" size="large" />
        </View>
      ) : (
        <>
          {/* Categorías */}
          <View className="border-b border-bg-border">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, alignItems: 'center', minHeight: 52 }}>
              {categories.map(c => {
                const active = activeRoot?.id === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => { setActiveRoot(c); setActiveSub(null); Haptics.selectionAsync(); }}
                    style={{ flexShrink: 0 }}
                    className={`px-4 py-3 mx-1 ${active ? 'border-b-2 border-brand-500' : ''}`}
                  >
                    <Text className={`text-sm ${active ? 'text-ink-primary font-bold' : 'text-ink-muted'}`}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Subcategorías */}
          {subcategories.length > 0 && (
            <View style={{ paddingVertical: 10 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 10, alignItems: 'center' }}>
                <Pressable
                  onPress={() => { setActiveSub(null); Haptics.selectionAsync(); }}
                  style={{ minWidth: 70 }}
                  className={`px-5 py-3 rounded-full items-center ${!activeSub ? 'bg-brand-500' : 'bg-bg-card border border-bg-border'}`}
                >
                  <Text className={`text-sm ${!activeSub ? 'text-white font-bold' : 'text-ink-secondary font-medium'}`}>Todos</Text>
                </Pressable>
                {subcategories.map(sc => {
                  const active = activeSub?.id === sc.id;
                  return (
                    <Pressable
                      key={sc.id}
                      onPress={() => { setActiveSub(sc); Haptics.selectionAsync(); }}
                      style={{ minWidth: 70 }}
                      className={`px-5 py-3 rounded-full items-center ${active ? 'bg-brand-500' : 'bg-bg-card border border-bg-border'}`}
                    >
                      <Text className={`text-sm ${active ? 'text-white font-bold' : 'text-ink-secondary font-medium'}`}>{sc.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Productos */}
          <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 110 }}>
            {productLoading ? (
              <ActivityIndicator color="#60A5FA" style={{ marginTop: 40 }} />
            ) : products.length === 0 ? (
              <Text className="text-ink-muted text-center py-12">Sin productos en esta categoría</Text>
            ) : (
              <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                {products.map(p => (
                  <Pressable
                    key={p.id}
                    onPress={() => handleProductPress(p)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, width: '48.5%' })}
                    className="bg-bg-card border border-bg-border rounded-2xl p-4 min-h-[88]"
                  >
                    <Text className="text-ink-primary font-semibold text-sm flex-1" numberOfLines={2}>{p.name}</Text>
                    <Text className="text-brand-400 text-base font-bold mt-2">${Number(p.price).toFixed(2)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </>
      )}

      {/* Modificadores */}
      <Modal visible={!!picker} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
        {picker && (
          <ModifierPicker
            product={picker.product}
            groups={picker.groups}
            onCancel={() => setPicker(null)}
            onConfirm={async (selected, notes) => {
              setPicker(null);
              await addItemImmediate(picker.product, selected.map(id => ({ modifier_id: id })), notes);
            }}
          />
        )}
      </Modal>

      {/* Toast de "agregado" */}
      {justAdded && (
        <Animated.View
          pointerEvents="none"
          style={{
            opacity: flashAnim,
            transform: [{ translateY: flashAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            position: 'absolute', top: 80, alignSelf: 'center',
          }}
          className="bg-success px-4 py-2.5 rounded-full flex-row items-center gap-2"
        >
          <Check size={16} color="#fff" />
          <Text className="text-white font-bold text-sm">{justAdded} agregado</Text>
        </Animated.View>
      )}

      {/* Cart bar */}
      {currentOrder && pendingCount > 0 && (
        <Pressable
          onPress={goToTicket}
          style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
          className="absolute left-3 right-3 bottom-4 bg-success rounded-2xl px-4 py-4 flex-row items-center"
        >
          <View className="bg-white w-9 h-9 rounded-full items-center justify-center mr-3">
            <Text className="text-success font-bold text-base">{pendingCount}</Text>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <ShoppingCart size={14} color="#fff" />
              <Text className="text-white font-bold text-base">Ver ticket y enviar</Text>
            </View>
            <Text className="text-white/80 text-xs mt-0.5">${orderTotal.toFixed(2)} · {pendingCount} ítem{pendingCount !== 1 ? 's' : ''} por enviar</Text>
          </View>
          <ChevronRight size={26} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

function ModifierPicker({
  product, groups, onCancel, onConfirm,
}: {
  product: Product;
  groups: ModifierGroup[];
  onCancel: () => void;
  onConfirm: (modifierIds: number[], notes?: string) => void;
}) {
  const [selected, setSelected] = useState<Record<number, number[]>>({});
  const [notes, setNotes] = useState('');

  const toggle = (group: ModifierGroup, mod: Modifier) => {
    Haptics.selectionAsync();
    setSelected(prev => {
      const current = prev[group.id] ?? [];
      const isSelected = current.includes(mod.id);
      if (group.max_selections === 1) {
        return { ...prev, [group.id]: isSelected ? [] : [mod.id] };
      }
      if (isSelected) return { ...prev, [group.id]: current.filter(id => id !== mod.id) };
      if (group.max_selections > 0 && current.length >= group.max_selections) return prev;
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
    <View className="flex-1 bg-black/60 justify-end">
      <View className="bg-bg-card rounded-t-3xl p-5 pb-8" style={{ maxHeight: '88%' }}>
        <View className="flex-row items-start mb-4">
          <View className="flex-1">
            <Text className="text-ink-primary text-xl font-bold">{product.name}</Text>
            <Text className="text-brand-400 text-base mt-1 font-semibold">${totalPrice.toFixed(2)}</Text>
          </View>
          <Pressable onPress={onCancel} className="p-1">
            <X size={22} color="#94A3B8" />
          </Pressable>
        </View>

        <ScrollView style={{ maxHeight: 460 }}>
          {groups.map(g => {
            const selectedCount = (selected[g.id] ?? []).length;
            const rangeText = g.max_selections === 1
              ? (g.is_required ? 'Elige 1' : 'Elige hasta 1')
              : `Elige ${g.min_selections}${g.max_selections > 0 ? `-${g.max_selections}` : '+'}`;
            return (
              <View key={g.id} className="mb-4">
                <View className="flex-row justify-between items-baseline mb-2">
                  <Text className="text-ink-primary font-semibold text-base">{g.name}</Text>
                  <Text className={`text-xs ${g.is_required ? 'text-danger' : 'text-ink-muted'}`}>
                    {rangeText}{g.is_required ? ' · requerido' : ''}
                  </Text>
                </View>
                {g.modifiers.map(m => {
                  const isSelected = (selected[g.id] ?? []).includes(m.id);
                  const extraNum = Number(m.price_extra);
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => toggle(g, m)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                      className={`flex-row items-center rounded-xl p-3 mb-1.5 border ${isSelected ? 'bg-brand-700/30 border-brand-500' : 'bg-bg-elevated border-bg-border'}`}
                    >
                      <View className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${isSelected ? 'bg-brand-500 border-brand-500' : 'border-bg-border'}`}>
                        {isSelected && <Check size={14} color="#fff" />}
                      </View>
                      <Text className={`flex-1 ${isSelected ? 'text-ink-primary font-medium' : 'text-ink-secondary'}`}>{m.name}</Text>
                      {extraNum !== 0 && (
                        <Text className="text-brand-400 text-sm ml-2">
                          {extraNum > 0 ? '+' : ''}${Math.abs(extraNum).toFixed(2)}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
                {g.is_required && selectedCount < Math.max(1, g.min_selections) && (
                  <Text className="text-danger text-xs mt-1 ml-1">Falta seleccionar</Text>
                )}
              </View>
            );
          })}

          {/* Nota opcional para el item */}
          <View className="mb-4">
            <Text className="text-ink-primary font-semibold text-base mb-2">Nota (opcional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Ej. sin azúcar, bien cocido, sin cebolla..."
              placeholderTextColor="#475569"
              multiline
              numberOfLines={2}
              className="bg-bg-elevated border border-bg-border rounded-xl px-3 py-2.5 text-ink-primary"
              style={{ minHeight: 56, textAlignVertical: 'top' }}
            />
            <Text className="text-ink-muted text-xs mt-1">Se imprime en cocina y aparece en el ticket</Text>
          </View>
        </ScrollView>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canConfirm}
          onPress={() => onConfirm(flatIds, notes)}
        >
          Agregar · ${totalPrice.toFixed(2)}
        </Button>
      </View>
    </View>
  );
}
