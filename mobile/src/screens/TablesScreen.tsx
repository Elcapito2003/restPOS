import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { Zap, LogOut, Users } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { getSocket, disconnectSocket } from '../socket';
import { fetchFloors, fetchTables, Floor, Table } from '../api/client';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import StatusBadge from '../components/ui/StatusBadge';
import { showError, showInfo } from '../lib/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Tables'>;

const STATUS_TONE: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
  free: 'success',
  occupied: 'danger',
  reserved: 'warning',
  blocked: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  free: 'Libre',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  blocked: 'Bloqueada',
};

const STATUS_BORDER: Record<string, string> = {
  free: '#22C55E',
  occupied: '#EF4444',
  reserved: '#F59E0B',
  blocked: '#64748B',
};

export default function TablesScreen({ navigation }: Props) {
  const { user, token, tenant, logout } = useAuth();
  const [floors, setFloors] = useState<Floor[]>([]);
  const [activeFloor, setActiveFloor] = useState<Floor | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFloors = async () => {
    try {
      const list = await fetchFloors();
      setFloors(list);
      if (list.length && !activeFloor) setActiveFloor(list[0]);
    } catch (e: any) {
      showError('Error', e?.message || 'No se pudieron cargar los pisos');
    }
  };

  const loadTables = useCallback(async (floorId: number) => {
    try {
      setTables(await fetchTables(floorId));
    } catch (e: any) {
      showError('Error', e?.message || 'No se pudieron cargar las mesas');
    }
  }, []);

  useEffect(() => { (async () => { await loadFloors(); setLoading(false); })(); }, []);
  useEffect(() => { if (activeFloor) loadTables(activeFloor.id); }, [activeFloor, loadTables]);

  // Socket
  useEffect(() => {
    if (!token || !activeFloor) return;
    const socket = getSocket(token);
    socket.emit('join:floor', activeFloor.id);

    const onTableChange = () => loadTables(activeFloor.id);
    const onOrderChange = () => loadTables(activeFloor.id);
    const onDeactivated = () => { showInfo('Sesión cerrada', 'Tu cuenta fue desactivada.'); logout(); };

    socket.on('table:status_changed', onTableChange);
    socket.on('order:updated', onOrderChange);
    socket.on('order:created', onOrderChange);
    socket.on('user:deactivated', onDeactivated);

    return () => {
      socket.off('table:status_changed', onTableChange);
      socket.off('order:updated', onOrderChange);
      socket.off('order:created', onOrderChange);
      socket.off('user:deactivated', onDeactivated);
    };
  }, [token, activeFloor?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeFloor) await loadTables(activeFloor.id);
    setRefreshing(false);
  };

  const handleTablePress = (t: Table) => {
    if (t.status === 'blocked') { showInfo('Mesa bloqueada'); return; }
    Haptics.selectionAsync();
    navigation.navigate('Order', { tableId: t.id, tableLabel: t.label, floorId: t.floor_id });
  };

  const handleLogout = async () => { disconnectSocket(); await logout(); };

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
      <View className="px-4 pt-12 pb-3 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-ink-primary text-lg font-bold" numberOfLines={1}>{tenant?.name}</Text>
          <Text className="text-ink-muted text-xs">{user?.display_name}</Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Menu', { orderId: null, tableId: null, tableLabel: 'Rápida' }); }}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            className="bg-brand-500 px-3 py-2 rounded-xl flex-row items-center gap-1"
          >
            <Zap size={14} color="#fff" />
            <Text className="text-white text-xs font-bold">Rápida</Text>
          </Pressable>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            className="bg-bg-card border border-bg-border px-3 py-2 rounded-xl"
          >
            <LogOut size={16} color="#FCA5A5" />
          </Pressable>
        </View>
      </View>

      {/* Floor tabs */}
      {floors.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-12 mb-2" contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
          {floors.map(f => {
            const active = activeFloor?.id === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => { setActiveFloor(f); Haptics.selectionAsync(); }}
                className={`px-4 py-2 rounded-xl border ${active ? 'bg-brand-700 border-brand-500' : 'bg-bg-card border-bg-border'}`}
              >
                <Text className={`text-sm font-medium ${active ? 'text-white' : 'text-ink-secondary'}`}>{f.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Grid */}
      <ScrollView
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60A5FA" />}
      >
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          {tables.map(t => (
            <Pressable
              key={t.id}
              onPress={() => handleTablePress(t)}
              style={({ pressed }) => ({
                opacity: pressed ? 0.85 : 1,
                width: '31%',
                aspectRatio: 1,
                borderColor: STATUS_BORDER[t.status] || '#1E293B',
                borderWidth: 2,
              })}
              className="bg-bg-card rounded-2xl p-2 items-center justify-center relative"
            >
              <View
                style={{ backgroundColor: STATUS_BORDER[t.status] || '#1E293B' }}
                className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full"
              />
              <Text className="text-ink-primary text-2xl font-bold">{t.label}</Text>
              <View className="flex-row items-center gap-1 mt-1">
                <Users size={10} color="#64748B" />
                <Text className="text-ink-muted text-[10px]">{t.capacity} pax</Text>
              </View>
              <View className="mt-2">
                <StatusBadge label={STATUS_LABEL[t.status]} tone={STATUS_TONE[t.status]} />
              </View>
              {t.status === 'occupied' && !!t.daily_number && (
                <Text className="text-ink-muted text-[10px] mt-1">#{t.daily_number}</Text>
              )}
              {t.status === 'occupied' && !!t.waiter_name && (
                <Text className="text-ink-secondary text-[10px]" numberOfLines={1}>{t.waiter_name}</Text>
              )}
            </Pressable>
          ))}
          {tables.length === 0 && (
            <Text className="text-ink-muted w-full text-center py-12">Sin mesas en este piso</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
