import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Pressable, useWindowDimensions } from 'react-native';
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

// Canvas del desktop = 950x630. Para el mobile escalamos todo proporcional al
// ancho de la pantalla. Multiplicamos pos_x/pos_y/width/height por `scale` —
// nada de transform, todo dimensión real para que React Native respete el
// layout absoluto sin sorpresas.
const CANVAS_W = 950;
const CANVAS_H = 630;

const STATUS_LABEL: Record<string, string> = {
  free: 'Libre',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  blocked: 'Bloqueada',
};

function tableStyle(status: string) {
  switch (status) {
    case 'free':     return { borderColor: '#22C55E', backgroundColor: '#DCFCE7' };
    case 'occupied': return { borderColor: '#EF4444', backgroundColor: '#FECACA' };
    case 'reserved': return { borderColor: '#F59E0B', backgroundColor: '#FEF3C7' };
    case 'blocked':  return { borderColor: '#9CA3AF', backgroundColor: '#E5E7EB', opacity: 0.5 };
    default:         return { borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' };
  }
}
function statusDot(status: string) {
  switch (status) {
    case 'free': return '#22C55E';
    case 'occupied': return '#EF4444';
    case 'reserved': return '#F59E0B';
    case 'blocked': return '#9CA3AF';
    default: return '#94A3B8';
  }
}

function FloorPlanBackground({ scale }: { scale: number }) {
  // Helper para escalar valores
  const s = (v: number) => v * scale;
  return (
    <>
      {/* Bordes */}
      <View style={{ position: 'absolute', left: 0, top: 0, width: s(CANVAS_W), height: s(4), backgroundColor: '#E5E7EB' }} />
      <View style={{ position: 'absolute', left: 0, top: s(CANVAS_H - 4), width: s(CANVAS_W), height: s(4), backgroundColor: '#E5E7EB' }} />
      <View style={{ position: 'absolute', left: 0, top: 0, width: s(4), height: s(CANVAS_H), backgroundColor: '#E5E7EB' }} />
      <View style={{ position: 'absolute', left: s(CANVAS_W - 4), top: 0, width: s(4), height: s(CANVAS_H), backgroundColor: '#E5E7EB' }} />

      {/* INGRESO */}
      <View style={{ position: 'absolute', left: 0, top: s(280), width: s(30), height: s(100), alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3C7', borderColor: '#FCD34D', borderWidth: 1, borderTopRightRadius: s(8), borderBottomRightRadius: s(8) }}>
        <DoorOpen size={Math.max(10, s(14))} color="#B45309" />
      </View>

      {/* COFFEE BAR */}
      <View style={{ position: 'absolute', left: s(180), top: s(230), width: s(440), height: s(200), backgroundColor: '#E0E7FF', borderColor: '#A5B4FC', borderWidth: 2, borderRadius: s(8), alignItems: 'center', justifyContent: 'center' }}>
        <Coffee size={Math.max(12, s(22))} color="#6366F1" />
        <Text style={{ fontSize: Math.max(7, s(11)), fontWeight: 'bold', color: '#4338CA', letterSpacing: 1.5, marginTop: s(2) }}>COFFEE BAR</Text>
      </View>

      {/* BAÑO */}
      <View style={{ position: 'absolute', left: s(640), top: s(230), width: s(140), height: s(200), backgroundColor: '#E0F2FE', borderColor: '#7DD3FC', borderWidth: 2, borderRadius: s(8), alignItems: 'center', justifyContent: 'center' }}>
        <Bath size={Math.max(10, s(20))} color="#0EA5E9" />
        <Text style={{ fontSize: Math.max(6, s(10)), fontWeight: 'bold', color: '#0369A1', marginTop: s(2) }}>BAÑO</Text>
      </View>

      {/* COCINA CALIENTE */}
      <View style={{ position: 'absolute', left: s(800), top: s(10), width: s(140), height: s(290), backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 2, borderRadius: s(8), alignItems: 'center', justifyContent: 'center' }}>
        <Flame size={Math.max(10, s(18))} color="#EF4444" />
        <Text style={{ fontSize: Math.max(6, s(9)), fontWeight: 'bold', color: '#B91C1C', marginTop: s(2) }}>COCINA</Text>
        <Text style={{ fontSize: Math.max(6, s(9)), fontWeight: 'bold', color: '#B91C1C' }}>CALIENTE</Text>
      </View>

      {/* COCINA FRÍA */}
      <View style={{ position: 'absolute', left: s(800), top: s(320), width: s(140), height: s(160), backgroundColor: '#FCE7F3', borderColor: '#F9A8D4', borderWidth: 2, borderRadius: s(8), alignItems: 'center', justifyContent: 'center' }}>
        <Snowflake size={Math.max(10, s(18))} color="#EC4899" />
        <Text style={{ fontSize: Math.max(6, s(9)), fontWeight: 'bold', color: '#9D174D', marginTop: s(2) }}>FRÍA</Text>
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
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const { width: screenW } = useWindowDimensions();

  // Padding lateral del contenedor + un poco extra para que respire
  const HORIZONTAL_PADDING = 16;
  const scale = (screenW - HORIZONTAL_PADDING) / CANVAS_W;
  const canvasW = CANVAS_W * scale;
  const canvasH = CANVAS_H * scale;
  const s = (v: number) => v * scale;

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
            {checkingUpdate ? <ActivityIndicator size="small" color="#60A5FA" /> : <RefreshCw size={16} color="#60A5FA" />}
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
        {floors.length > 1 ? (
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
        ) : <View className="flex-1" />}
        <View className="flex-row items-center gap-2.5">
          {(['free','occupied','reserved'] as const).map(st => (
            <View key={st} className="flex-row items-center gap-1">
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusDot(st) }} />
              <Text className="text-ink-muted text-[10px]">{STATUS_LABEL[st]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Canvas escalado al ancho de la pantalla — todo visible sin scroll horizontal */}
      <ScrollView
        contentContainerStyle={{ alignItems: 'center', paddingVertical: 8, paddingHorizontal: HORIZONTAL_PADDING / 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60A5FA" />}
      >
        <View style={{
          width: canvasW,
          height: canvasH,
          backgroundColor: '#FFFFFF',
          borderRadius: 8,
          overflow: 'hidden',
          position: 'relative',
        }}>
          <FloorPlanBackground scale={scale} />
          {tables.map(t => {
            const stl = tableStyle(t.status);
            const isBar = t.label.startsWith('B');
            const tw = (Number(t.width) || 80) * scale;
            const th = (Number(t.height) || 80) * scale;
            const px = (Number(t.pos_x) || 0) * scale;
            const py = (Number(t.pos_y) || 0) * scale;
            const fontSize = Math.max(8, Math.min(tw, th) * 0.35);
            return (
              <Pressable
                key={t.id}
                onPress={() => handleTablePress(t)}
                style={{
                  position: 'absolute',
                  left: px,
                  top: py,
                  width: tw,
                  height: th,
                  borderRadius: t.shape === 'round' ? tw / 2 : Math.max(4, s(8)),
                  borderWidth: Math.max(1.5, s(2)),
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: stl.backgroundColor,
                  borderColor: stl.borderColor,
                  opacity: (stl as any).opacity ?? 1,
                }}
              >
                <Text style={{ fontWeight: 'bold', fontSize, color: '#111827', textAlign: 'center', includeFontPadding: false }}>
                  {t.label}
                </Text>
                {t.status === 'occupied' && !!t.daily_number && (
                  <Text style={{ fontSize: Math.max(6, fontSize * 0.55), color: '#374151', marginTop: 1, includeFontPadding: false }}>
                    #{t.daily_number}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
        {tables.length === 0 && (
          <Text className="text-ink-muted text-center py-12">Sin mesas en este piso</Text>
        )}
        <Text className="text-ink-muted text-[10px] text-center mt-3 px-4">
          Toca una mesa para tomar el pedido. Color del borde = estado.
        </Text>
      </ScrollView>
    </View>
  );
}
