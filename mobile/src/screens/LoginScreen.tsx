import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TextInput, Pressable,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { ChevronLeft, RefreshCw, ArrowLeftRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth, User } from '../context/AuthContext';
import { fetchActiveUsers, pinLogin } from '../api/client';
import Button from '../components/ui/Button';
import { showError } from '../lib/toast';

export default function LoginScreen() {
  const { tenant, clearTenant, saveSession } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await fetchActiveUsers());
    } catch (e: any) {
      showError('Error', e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!picked || pin.length < 4) return;
    setSubmitting(true);
    try {
      const res = await pinLogin(picked.id, pin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await saveSession(res.token, res.user);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError('PIN incorrecto', e?.response?.data?.error || e.message);
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-bg-base items-center justify-center">
        <ActivityIndicator color="#60A5FA" size="large" />
      </View>
    );
  }

  if (picked) {
    return <PinPad user={picked} pin={pin} setPin={setPin} onBack={() => { setPicked(null); setPin(''); }} onSubmit={submit} submitting={submitting} />;
  }

  return (
    <View className="flex-1 bg-bg-base">
      {/* Header */}
      <View className="px-5 pt-14 pb-4 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-ink-primary text-2xl font-bold" numberOfLines={1}>{tenant?.name}</Text>
          <Text className="text-ink-muted text-sm mt-1">Selecciona tu usuario</Text>
        </View>
        <Pressable
          onPress={() => clearTenant()}
          className="px-3 py-2 flex-row items-center gap-1"
        >
          <ArrowLeftRight size={14} color="#60A5FA" />
          <Text className="text-brand-400 text-sm">Cambiar</Text>
        </Pressable>
      </View>

      {/* Grid */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {users.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-ink-muted text-center mb-4">No hay usuarios activos en este restaurante.</Text>
            <Button variant="secondary" size="md" onPress={load} leftIcon={<RefreshCw size={16} color="#F8FAFC" />}>
              Reintentar
            </Button>
          </View>
        ) : (
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {users.map(u => (
              <Pressable
                key={u.id}
                onPress={() => { setPicked(u); Haptics.selectionAsync(); }}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, width: '31%' })}
                className="bg-bg-card border-2 border-bg-border rounded-2xl p-4 items-center"
              >
                <View
                  style={{ backgroundColor: u.avatar_color || '#3B82F6' }}
                  className="w-14 h-14 rounded-full items-center justify-center mb-2"
                >
                  <Text className="text-white text-2xl font-bold">{u.display_name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text className="text-ink-primary font-semibold text-sm text-center" numberOfLines={1}>{u.display_name}</Text>
                <Text className="text-ink-muted text-[10px] mt-0.5 capitalize">{u.role}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function PinPad({
  user, pin, setPin, onBack, onSubmit, submitting,
}: {
  user: User; pin: string; setPin: (s: string) => void;
  onBack: () => void; onSubmit: () => void; submitting: boolean;
}) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-bg-base">
      <View className="px-5 pt-12">
        <Pressable onPress={onBack} className="flex-row items-center self-start py-2">
          <ChevronLeft size={20} color="#60A5FA" />
          <Text className="text-brand-400 text-base ml-1">Volver</Text>
        </Pressable>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <View
          style={{ backgroundColor: user.avatar_color || '#3B82F6' }}
          className="w-24 h-24 rounded-full items-center justify-center mb-4"
        >
          <Text className="text-white text-4xl font-bold">{user.display_name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text className="text-ink-primary text-2xl font-bold">{user.display_name}</Text>
        <Text className="text-ink-muted text-sm capitalize mt-0.5 mb-8">{user.role}</Text>

        <TextInput
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 8))}
          placeholder="• • • •"
          placeholderTextColor="#475569"
          keyboardType="number-pad"
          secureTextEntry
          autoFocus
          onSubmitEditing={onSubmit}
          className="bg-bg-card border border-bg-border rounded-2xl text-ink-primary text-3xl text-center mb-6"
          style={{ paddingVertical: 18, width: '70%', letterSpacing: 14 }}
        />

        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={pin.length < 4}
          onPress={onSubmit}
        >
          Entrar
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
