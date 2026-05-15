import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import * as Updates from 'expo-updates';
import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import {
  Wrench, ChevronLeft, RefreshCw, Trash2, Wifi, LogOut, Send,
  Server, Database, Activity, AlertTriangle, Bug, Download,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { getSocket, disconnectSocket } from '../socket';
import { getDiagnostics, reportProblem, Diagnostics } from '../api/client';
import { showError, showSuccess, showInfo } from '../lib/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminPanel'>;

function StatusDot({ ok }: { ok: boolean }) {
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ok ? '#22C55E' : '#EF4444' }} />;
}

export default function AdminPanelScreen({ navigation }: Props) {
  const { user, token, tenant, logout } = useAuth();
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [socketOk, setSocketOk] = useState<boolean>(false);

  const loadDiag = async () => {
    try {
      const d = await getDiagnostics();
      setDiag(d);
    } catch (e: any) {
      showError('No se pudo cargar', e?.response?.data?.error || e.message);
    } finally {
      setLoadingDiag(false);
    }
  };

  useEffect(() => {
    loadDiag();
    const t = setInterval(loadDiag, 15000);
    // Check socket
    if (token) setSocketOk(!!getSocket(token).connected);
    return () => clearInterval(t);
  }, [token]);

  const run = async (label: string, fn: () => Promise<any>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(label);
    try {
      await fn();
      showSuccess(label, 'OK');
    } catch (e: any) {
      showError(label, e?.message || 'falló');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="flex-1 bg-bg-base">
      {/* Header */}
      <View className="px-4 pt-12 pb-3 flex-row items-center gap-3 border-b border-bg-border">
        <Pressable onPress={() => navigation.goBack()} className="p-2 -ml-2">
          <ChevronLeft size={22} color="#94A3B8" />
        </Pressable>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Wrench size={18} color="#60A5FA" />
            <Text className="text-ink-primary text-base font-bold">Modo Admin</Text>
          </View>
          <Text className="text-ink-muted text-xs">Diagnóstico y herramientas de soporte</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Estado del sistema */}
        <Section title="Estado del sistema" icon={<Activity size={16} color="#60A5FA" />}>
          {loadingDiag && !diag ? (
            <ActivityIndicator color="#60A5FA" />
          ) : (
            <>
              <StatusRow ok={!!diag} label="Server" detail={diag ? `uptime ${Math.floor(diag.server.uptime_sec / 60)}m · ${diag.server.memory_mb.heap_used} MB` : 'sin conexión'} />
              <StatusRow ok={!!diag?.db.ok} label="Base de datos" detail={diag ? `${diag.db.latency_ms} ms` : '—'} />
              <StatusRow ok={socketOk} label="Socket.io" detail={socketOk ? 'conectado' : 'desconectado'} />
              {diag && (
                <>
                  <StatusRow ok={diag.integrations.openai} label="OpenAI (scanner)" detail={diag.integrations.openai ? 'API key configurada' : 'Falta OPENAI_API_KEY'} />
                  <StatusRow ok={diag.integrations.openclaw} label="OpenClaw" detail={diag.integrations.openclaw ? 'Conectado' : 'Sin token'} />
                </>
              )}
            </>
          )}
        </Section>

        {/* Info del cliente */}
        <Section title="Esta app" icon={<Server size={16} color="#60A5FA" />}>
          <InfoRow label="Versión nativa" value={Application.nativeApplicationVersion || '?'} />
          <InfoRow label="Build" value={Application.nativeBuildVersion || '?'} />
          <InfoRow label="OTA bundle" value={Updates.updateId?.slice(0, 12) || '(embebido)'} />
          <InfoRow label="Canal" value={Updates.channel || '?'} />
          <InfoRow label="Runtime" value={Updates.runtimeVersion || '?'} />
          <InfoRow label="Tenant" value={tenant?.slug || '?'} />
          <InfoRow label="Usuario" value={`${user?.display_name} (${user?.role})`} />
        </Section>

        {/* Acciones rápidas */}
        <Section title="Acciones rápidas" icon={<RefreshCw size={16} color="#60A5FA" />}>
          <Action
            label="Buscar actualización OTA"
            icon={<Download size={16} color="#60A5FA" />}
            busy={busy === 'ota'}
            onPress={() => run('ota', async () => {
              if (__DEV__) throw new Error('No disponible en dev');
              const r = await Updates.checkForUpdateAsync();
              if (r.isAvailable) { showInfo('Descargando…'); await Updates.fetchUpdateAsync(); await Updates.reloadAsync(); }
              else showInfo('Ya en la última versión');
            })}
          />
          <Action
            label="Re-conectar socket"
            icon={<Wifi size={16} color="#60A5FA" />}
            busy={busy === 'reconnect'}
            onPress={() => run('reconnect', async () => {
              if (!token) throw new Error('Sin token');
              disconnectSocket();
              const s = getSocket(token);
              s.connect();
              setSocketOk(s.connected);
            })}
          />
          <Action
            label="Refrescar diagnóstico"
            icon={<RefreshCw size={16} color="#60A5FA" />}
            busy={busy === 'refetch'}
            onPress={() => run('refetch', loadDiag)}
          />
          <Action
            label="Logout + limpiar todo"
            icon={<LogOut size={16} color="#FCA5A5" />}
            busy={busy === 'logout'}
            danger
            onPress={() => Alert.alert(
              'Cerrar sesión',
              'Esto borra el token y te regresa al login. ¿Continuar?',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Sí, cerrar', style: 'destructive', onPress: () => run('logout', async () => { disconnectSocket(); await logout(); }) },
              ]
            )}
          />
        </Section>

        {/* Inspector */}
        <Section title="Inspector" icon={<Bug size={16} color="#60A5FA" />}>
          <Pressable
            onPress={() => Alert.alert('JWT preview', token ? token.slice(0, 60) + '…' : 'sin token')}
            className="bg-bg-elevated rounded-lg p-3 mb-2"
          >
            <Text className="text-ink-primary text-sm">Ver JWT (preview)</Text>
          </Pressable>
          <Pressable
            onPress={() => Alert.alert('Último error reportado', diag?.last_client_error ? JSON.stringify(diag.last_client_error, null, 2).slice(0, 500) : 'Sin reportes recientes')}
            className="bg-bg-elevated rounded-lg p-3"
          >
            <Text className="text-ink-primary text-sm">Último error global del sistema</Text>
          </Pressable>
        </Section>

        {/* Pánico */}
        <Section title="Botón del pánico" icon={<AlertTriangle size={16} color="#F59E0B" />}>
          <Text className="text-ink-muted text-xs mb-3">
            Si algo falla y quieres mandar contexto al admin, esto manda al server: tu estado actual, último diag, y un mensaje.
          </Text>
          <Pressable
            onPress={() => run('report', async () => {
              await reportProblem({
                from: 'mobile',
                screen: 'AdminPanel',
                message: 'Reporte manual desde modo admin',
                payload: { diag, user: { id: user?.id, role: user?.role, name: user?.display_name }, tenant: tenant?.slug, ota: Updates.updateId },
              });
            })}
            disabled={busy !== null}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            className="bg-red-600 py-3 rounded-xl flex-row items-center justify-center gap-2"
          >
            <Send size={18} color="#fff" />
            <Text className="text-white font-bold">Reportar problema ahora</Text>
          </Pressable>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View className="bg-bg-card rounded-2xl border border-bg-border p-4 mb-3">
      <View className="flex-row items-center gap-2 mb-3">
        {icon}
        <Text className="text-ink-primary font-bold">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <View className="flex-row items-center gap-2 py-1.5">
      <StatusDot ok={ok} />
      <Text className="text-ink-primary text-sm flex-1">{label}</Text>
      <Text className="text-ink-muted text-xs" numberOfLines={1}>{detail}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row py-1">
      <Text className="text-ink-muted text-xs flex-1">{label}</Text>
      <Text className="text-ink-secondary text-xs">{value}</Text>
    </View>
  );
}

function Action({ label, onPress, busy, icon, danger }: { label: string; onPress: () => void; busy: boolean; icon: React.ReactNode; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => ({ opacity: busy ? 0.5 : pressed ? 0.7 : 1 })}
      className={`flex-row items-center gap-3 px-3 py-3 rounded-lg mb-2 ${danger ? 'bg-red-500/10 border border-red-500/30' : 'bg-bg-elevated'}`}
    >
      {busy ? <ActivityIndicator size="small" color="#60A5FA" /> : icon}
      <Text className={`flex-1 text-sm ${danger ? 'text-red-300' : 'text-ink-primary'}`}>{label}</Text>
    </Pressable>
  );
}
