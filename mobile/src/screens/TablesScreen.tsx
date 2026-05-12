import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { Zap, LogOut, DoorOpen, Coffee, Bath, Flame, Snowflake, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Updates from 'expo-updates';
import { useAuth } from '../context/AuthContext';
import { getSocket, disconnectSocket } from '../socket';
import { fetchFloors, fetchTables, Floor, Table } from '../api/client';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { showError, showInfo } from '../lib/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Tables'>;

// Mismas dimensiones del canvas que el desktop (TableMapPage.tsx) para que las
// posiciones x/y guardadas en BD se rendericen igual.
const CANVAS_W = 950;
const CANVAS_H = 630;

const STATUS_LABEL: Record<string, string> = {
  free: 'Libre',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  blocked: 'Bloqueada',
};

// Estilo por estado para el botón de mesa — replicando los colores del desktop:
// free=emerald, occupied=red con ring, reserved=amber, blocked=gray.
function tableStyle(status: string) {
  switch (status) {
    case 'free':
      return { borderColor: '#34D399', backgroundColor: '#ECFDF5' };
    case 'occupied':
      return { borderColor: '#F87171', backgroundColor: '#FEF2F2' };
    case 'reserved':
      return { borderColor: '#FBBF24', backgroundColor: '#FFFBEB' };
    case 'blocked':
      return { borderColor: '#9CA3AF', backgroundColor: '#E5E7EB', opacity: 0.6 };
    default:
      return { borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' };
  }
}

function statusLabelColor(status: string) {
  switch (status) {
    case 'free': return '#10B981';
    case 'occupied': return '#EF4444';
    case 'reserved': return '#F59E0B';
    case 'blocked': return '#6B7280';
    default: return '#9CA3AF';
  }
}

// Fondo del mapa — mismas zonas y posiciones que el desktop.
function FloorPlanBackground() {
  return (
    <>
      {/* Paredes externas (4 lineas) */}
      <View style={{ position: 'absolute', left: 0, top: 0, width: CANVAS_W, height: 4, backgroundColor: '#E5E7EB' }} />
      <View style={{ position: 'absolute', left: 0, top: CANVAS_H - 4, width: CANVAS_W, height: 4, backgroundColor: '#E5E7EB' }} />
      <View style={{ position: 'absolute', left: 0, top: 0, width: 4, height: CANVAS_H, backgroundColor: '#E5E7EB' }} />
      <View style={{ position: 'absolute', left: CANVAS_W - 4, top: 0, width: 4, height: CANVAS_H, backgroundColor: '#E5E7EB' }} />

      {/* INGRESO (lado izquierdo) */}
      <View style={{ position: 'absolute', left: -1, top: 280, width: 30, height: 100, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          backgroundColor: '#FEF3C7', borderColor: '#FCD34D', borderWidth: 1,
          borderTopRightRadius: 8, borderBottomRightRadius: 8,
          paddingHorizontal: 4, paddingVertical: 24,
          alignItems: 'center', gap: 4,
        }}>
          <DoorOpen size={16} color="#B45309" />
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#92400E', transform: [{ rotate: '90deg' }] }}>INGRESO</Text>
        </View>
      </View>

      {/* COFFEE BAR (centro) */}
      <View style={{
        position: 'absolute', left: 180, top: 230, width: 440, height: 200,
        backgroundColor: 'rgba(199, 210, 254, 0.6)',
        borderColor: '#A5B4FC', borderWidth: 2, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Coffee size={28} color="#6366F1" />
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#4338CA', letterSpacing: 2, marginTop: 4 }}>COFFEE BAR</Text>
        <Text style={{ fontSize: 10, color: '#6366F1', marginTop: 4 }}>Caja · Cafetería · Frigobar</Text>
      </View>

      {/* BAÑO (derecha del coffee bar) */}
      <View style={{
        position: 'absolute', left: 640, top: 230, width: 140, height: 200,
        backgroundColor: 'rgba(186, 230, 253, 0.6)',
        borderColor: '#7DD3FC', borderWidth: 2, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Bath size={24} color="#0EA5E9" />
        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#0369A1', marginTop: 4 }}>BAÑO</Text>
      </View>

      {/* COCINA CALIENTE (extremo derecho arriba) */}
      <View style={{
        position: 'absolute', left: 800, top: 10, width: 140, height: 290,
        backgroundColor: 'rgba(254, 202, 202, 0.5)',
        borderColor: '#FCA5A5', borderWidth: 2, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Flame size={22} color="#EF4444" />
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#B91C1C', marginTop: 4 }}>COCINA</Text>
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#B91C1C' }}>CALIENTE</Text>
      </View>

      {/* COCINA FRÍA (extremo derecho abajo) */}
      <View style={{
        position: 'absolute', left: 800, top: 320, width: 140, height: 160,
        backgroundColor: 'rgba(252, 231, 243, 0.5)',
        borderColor: '#F9A8D4', borderWidth: 2, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Snowflake size={22} color="#EC4899" />
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#9D174D', marginTop: 4 }}>COCINA</Text>
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#9D174D' }}>FRÍA</Text>
      </View>
    </>
  );
}

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

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const handleCheckUpdate = async () => {
    if (checkingUpdate) return;
    if (__DEV__) { showInfo('Modo dev', 'Las actualizaciones OTA solo funcionan en builds de producción'); return; }
    setCheckingUpdate(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        showInfo('Descargando actualización…');
        await Updates.fetchUpdateAsync();
        // reloadAsync reinicia con el bundle nuevo
        await Updates.reloadAsync();
      } else {
        showInfo('Estás en la última versión');
      }
    } catch (e: any) {
      showError('No se pudo verificar', e?.message || 'Sin conexión');
    } finally {
      setCheckingUpdate(false);
    }
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
            onPress={handleCheckUpdate}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            className="bg-bg-card border border-bg-border px-3 py-2 rounded-xl"
          >
            {checkingUpdate ? (
              <ActivityIndicator size="small" color="#60A5FA" />
            ) : (
              <RefreshCw size={16} color="#60A5FA" />
            )}
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

      {/* Floor tabs + leyenda */}
      <View className="flex-row items-center px-3 mb-2 gap-2">
        {floors.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} className="flex-1">
            {floors.map(f => {
              const active = activeFloor?.id === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => { setActiveFloor(f); Haptics.selectionAsync(); }}
                  className={`px-3 py-1.5 rounded-lg border ${active ? 'bg-brand-700 border-brand-500' : 'bg-bg-card border-bg-border'}`}
                >
                  <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-ink-secondary'}`}>{f.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        <View className="flex-row items-center gap-3">
          {(['free','occupied','reserved'] as const).map(s => (
            <View key={s} className="flex-row items-center gap-1">
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusLabelColor(s) }} />
              <Text className="text-ink-muted text-[10px]">{STATUS_LABEL[s]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Mapa de mesas — mismo layout que desktop. ScrollView vertical externo
          contiene ScrollView horizontal con el canvas a tamaño real (950x630).
          El user hace pan natural con el dedo. NO escalamos con transform
          porque transformOrigin no existe en React Native. */}
      <ScrollView
        contentContainerStyle={{ paddingVertical: 4 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60A5FA" />}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={{ padding: 8 }}
        >
          <View style={{
            width: CANVAS_W,
            height: CANVAS_H,
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#E5E7EB',
          }}>
            <FloorPlanBackground />
            {tables.map(t => {
              const style = tableStyle(t.status);
              const labelColor = statusLabelColor(t.status);
              const isBar = t.label.startsWith('B');
              const tw = t.width || 80;
              const th = t.height || 80;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => handleTablePress(t)}
                  style={({ pressed }) => ({
                    position: 'absolute',
                    left: t.pos_x,
                    top: t.pos_y,
                    width: tw,
                    height: th,
                    borderRadius: t.shape === 'round' ? tw / 2 : 12,
                    borderWidth: 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: (style as any).opacity ?? (pressed ? 0.7 : 1),
                    backgroundColor: style.backgroundColor,
                    borderColor: style.borderColor,
                  })}
                >
                  <Text style={{ fontWeight: 'bold', fontSize: isBar ? 14 : 18, color: '#1F2937' }}>{t.label}</Text>
                  <View style={{
                    backgroundColor: labelColor,
                    paddingHorizontal: 6, paddingVertical: 2,
                    borderRadius: 999, marginTop: 2,
                  }}>
                    <Text style={{ color: 'white', fontSize: 9, fontWeight: '600' }}>{STATUS_LABEL[t.status]}</Text>
                  </View>
                  {t.status === 'occupied' && !!t.daily_number && (
                    <Text style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>#{t.daily_number}</Text>
                  )}
                  {t.status === 'occupied' && !!t.waiter_name && (
                    <Text style={{ fontSize: 9, color: '#374151' }} numberOfLines={1}>{t.waiter_name}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        {tables.length === 0 && (
          <Text className="text-ink-muted text-center py-12">Sin mesas en este piso</Text>
        )}
        <Text className="text-ink-muted text-[10px] text-center mt-2 px-4">
          Desliza horizontal y vertical para ver todo el mapa.
        </Text>
      </ScrollView>
    </View>
  );
}
