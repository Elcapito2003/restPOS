import { ReactNode, useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, TextInput, Pressable, Modal } from 'react-native';
import { Clock, DollarSign, LogOut } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { getMyShift, openShift, Shift } from '../api/client';
import { api } from '../api/client';
import { showSuccess, showError } from '../lib/toast';
import Button from './ui/Button';

export default function ShiftGate({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<Shift | null>(null);
  const [forceOpen, setForceOpen] = useState(false);

  const refreshShift = useCallback(async () => {
    if (!user || isAdmin) {
      setLoading(false);
      return;
    }
    try {
      const s = await getMyShift();
      setShift(s);
    } catch {
      // ignore — server may be temporarily unreachable
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    refreshShift();
  }, [refreshShift]);

  // Interceptor: detect 403 SHIFT_REQUIRED and force open
  useEffect(() => {
    if (!user || isAdmin) return;
    const id = api.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err?.response?.status === 403 && err?.response?.data?.code === 'SHIFT_REQUIRED') {
          setForceOpen(true);
        }
        return Promise.reject(err);
      }
    );
    return () => {
      api.interceptors.response.eject(id);
    };
  }, [user, isAdmin]);

  if (!user || isAdmin) return <>{children}</>;
  if (loading) {
    return (
      <View className="flex-1 bg-bg-base items-center justify-center">
        <Clock size={48} color="#64748B" />
        <Text className="text-ink-muted mt-3">Verificando turno...</Text>
      </View>
    );
  }

  if (shift && !forceOpen) {
    return <>{children}</>;
  }

  return (
    <ForcedShiftView
      onSuccess={(s) => {
        setShift(s);
        setForceOpen(false);
      }}
      onLogout={() => {
        logout();
      }}
    />
  );
}

function ForcedShiftView({ onSuccess, onLogout }: { onSuccess: (s: Shift) => void; onLogout: () => void }) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const num = parseFloat(amount);
  const valid = !isNaN(num) && num > 0;

  const handleOpen = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const s = await openShift(num, notes || undefined);
      showSuccess('Turno abierto', `Fondo: $${num.toFixed(2)}`);
      onSuccess(s);
    } catch (e: any) {
      showError('Error al abrir turno', e?.response?.data?.error || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-bg-base px-6 pt-16 pb-8">
      <View className="flex-1 justify-center">
        <View className="items-center mb-6">
          <View className="w-20 h-20 rounded-full bg-brand-500/15 items-center justify-center mb-3">
            <Clock size={40} color="#60A5FA" />
          </View>
          <Text className="text-ink-primary text-2xl font-bold">Abre tu turno</Text>
          <Text className="text-ink-secondary text-center mt-2">
            Hola <Text className="font-semibold text-ink-primary">{user?.display_name}</Text>, antes de tomar órdenes captura el efectivo en caja.
          </Text>
        </View>

        <View className="bg-bg-card border border-bg-border rounded-2xl p-5 mb-4">
          <View className="flex-row items-center mb-2">
            <DollarSign size={16} color="#94A3B8" />
            <Text className="text-ink-secondary ml-1.5 font-medium">
              Fondo inicial <Text className="text-danger">*</Text>
            </Text>
          </View>
          <View className="flex-row items-center bg-bg-elevated rounded-xl px-4 py-3">
            <Text className="text-ink-muted text-2xl font-bold mr-2">$</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#475569"
              autoFocus
              className="flex-1 text-ink-primary text-2xl font-bold"
            />
          </View>
          <Text className="text-ink-muted text-xs mt-2">Cuenta el efectivo en la caja. Debe ser mayor a 0.</Text>
        </View>

        <View className="bg-bg-card border border-bg-border rounded-2xl p-5 mb-4">
          <Text className="text-ink-secondary font-medium mb-2">Notas (opcional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Ej: Turno matutino"
            placeholderTextColor="#475569"
            className="bg-bg-elevated rounded-xl px-4 py-3 text-ink-primary"
          />
        </View>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!valid}
          onPress={handleOpen}
          leftIcon={<Clock size={20} color="#fff" />}
        >
          Abrir turno
        </Button>

        <Pressable onPress={onLogout} className="items-center mt-5 py-2">
          <View className="flex-row items-center gap-1.5">
            <LogOut size={14} color="#94A3B8" />
            <Text className="text-ink-secondary text-sm">Cerrar sesión y entrar como otro</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
