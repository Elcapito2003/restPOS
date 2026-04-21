import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getSocket, disconnectSocket } from '../socket';
import { fetchFloors, fetchTables, Floor, Table } from '../api/client';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Tables'>;

const STATUS_COLORS: Record<string, string> = {
  free: '#22C55E',
  occupied: '#EF4444',
  reserved: '#F59E0B',
  blocked: '#64748B',
};

const STATUS_LABEL: Record<string, string> = {
  free: 'Libre',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  blocked: 'Bloqueada',
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
      Alert.alert('Error', e?.message || 'No se pudieron cargar los pisos');
    }
  };

  const loadTables = useCallback(async (floorId: number) => {
    try {
      const list = await fetchTables(floorId);
      setTables(list);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudieron cargar las mesas');
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadFloors();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (activeFloor) loadTables(activeFloor.id);
  }, [activeFloor, loadTables]);

  // Socket updates
  useEffect(() => {
    if (!token || !activeFloor) return;
    const socket = getSocket(token);
    socket.emit('join:floor', activeFloor.id);

    const onTableChange = (table: Table) => {
      setTables(prev => prev.map(t => t.id === table.id ? { ...t, ...table } : t));
      loadTables(activeFloor.id); // re-fetch to get fresh waiter + daily_number joins
    };
    const onOrderChange = () => { if (activeFloor) loadTables(activeFloor.id); };
    const onDeactivated = () => {
      Alert.alert('Sesión cerrada', 'Tu cuenta fue desactivada.', [{ text: 'OK', onPress: () => logout() }]);
    };

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
    if (t.status === 'blocked') {
      Alert.alert('Mesa bloqueada');
      return;
    }
    navigation.navigate('Order', { tableId: t.id, tableLabel: t.label, floorId: t.floor_id });
  };

  const handleLogout = async () => {
    disconnectSocket();
    await logout();
  };

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
        <View>
          <Text style={styles.title}>{tenant?.name}</Text>
          <Text style={styles.subtitle}>{user?.display_name}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('Menu', { orderId: null, tableId: null, tableLabel: 'Rápida' })} style={styles.quickBtn}>
            <Text style={styles.quickBtnText}>+ Rápida</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {floors.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.floorTabs} contentContainerStyle={{ paddingHorizontal: 4 }}>
          {floors.map(f => (
            <TouchableOpacity
              key={f.id}
              onPress={() => setActiveFloor(f)}
              style={[styles.floorTab, activeFloor?.id === f.id && styles.floorTabActive]}
            >
              <Text style={[styles.floorTabText, activeFloor?.id === f.id && styles.floorTabTextActive]}>{f.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView
        contentContainerStyle={styles.grid}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#93C5FD" />}
      >
        {tables.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tableCard, { borderColor: STATUS_COLORS[t.status] || '#334155' }]}
            onPress={() => handleTablePress(t)}
          >
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[t.status] || '#334155' }]} />
            <Text style={styles.tableLabel}>{t.label}</Text>
            <Text style={styles.tableCapacity}>{t.capacity} pax</Text>
            <Text style={[styles.tableStatus, { color: STATUS_COLORS[t.status] }]}>{STATUS_LABEL[t.status]}</Text>
            {t.status === 'occupied' && t.daily_number && (
              <Text style={styles.tableExtra}>#{t.daily_number}</Text>
            )}
            {t.status === 'occupied' && t.waiter_name && (
              <Text style={styles.tableExtra} numberOfLines={1}>{t.waiter_name}</Text>
            )}
          </TouchableOpacity>
        ))}
        {tables.length === 0 && <Text style={styles.emptyText}>Sin mesas en este piso</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', paddingHorizontal: 14, paddingTop: 14 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 10 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  quickBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  quickBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  logoutBtn: { backgroundColor: '#1E293B', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  logoutText: { color: '#FCA5A5', fontSize: 13 },
  floorTabs: { maxHeight: 42, marginBottom: 12 },
  floorTab: { paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#1E293B', borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: '#334155' },
  floorTabActive: { backgroundColor: '#1E40AF', borderColor: '#3B82F6' },
  floorTabText: { color: '#94A3B8', fontSize: 13, fontWeight: '500' },
  floorTabTextActive: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 30 },
  tableCard: {
    width: '31%',
    minWidth: 110,
    aspectRatio: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  statusDot: { position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: 5 },
  tableLabel: { color: '#fff', fontSize: 22, fontWeight: '700' },
  tableCapacity: { color: '#64748B', fontSize: 11, marginTop: 2 },
  tableStatus: { fontSize: 11, fontWeight: '600', marginTop: 4, textTransform: 'uppercase' },
  tableExtra: { color: '#94A3B8', fontSize: 10, marginTop: 2 },
  emptyText: { color: '#64748B', flex: 1, textAlign: 'center', marginTop: 60 },
});
