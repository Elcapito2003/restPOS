import { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { KeyRound, Sparkles } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { redeemLicense } from '../api/client';
import Button from '../components/ui/Button';
import { showError } from '../lib/toast';

export default function LicenseEntryScreen() {
  const { saveTenant } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const clean = code.trim().toUpperCase().replace(/\s+/g, '');
    if (clean.length < 8) {
      showError('Código inválido', 'Revisa el código de licencia');
      return;
    }
    setLoading(true);
    try {
      const res = await redeemLicense(clean);
      await saveTenant(res.tenant);
    } catch (e: any) {
      let title = 'No se pudo activar';
      let msg = '';
      if (e?.response?.data?.error) {
        msg = e.response.data.error;
        title = 'Licencia inválida';
      } else if (e?.code === 'ECONNABORTED' || e?.message?.includes('timeout')) {
        msg = 'El servidor no respondió a tiempo. Revisa tu conexión.';
      } else if (e?.message === 'Network Error') {
        msg = 'Sin conexión al servidor.';
      } else {
        msg = e?.message || 'Error desconocido';
      }
      showError(title, msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-bg-base"
    >
      <View className="flex-1 justify-center px-6">
        {/* Branding */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-2xl bg-brand-500/15 items-center justify-center mb-4">
            <Sparkles size={40} color="#60A5FA" />
          </View>
          <Text className="text-ink-primary text-4xl font-bold">restPOS</Text>
          <Text className="text-brand-400 text-base mt-1">Comandero</Text>
        </View>

        {/* Card */}
        <View className="bg-bg-card border border-bg-border rounded-3xl p-6">
          <View className="flex-row items-center mb-4">
            <KeyRound size={18} color="#94A3B8" />
            <Text className="text-ink-secondary ml-2 font-medium">Código de licencia</Text>
          </View>

          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="ABCD1234..."
            placeholderTextColor="#475569"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
            className="bg-bg-elevated rounded-xl px-4 py-4 text-ink-primary text-base mb-4"
            style={{ fontFamily: 'monospace', letterSpacing: 1 }}
          />

          <Button variant="primary" size="lg" fullWidth loading={loading} onPress={submit}>
            Activar dispositivo
          </Button>

          <Text className="text-ink-muted text-xs text-center mt-4">
            El administrador genera este código desde el panel /admin
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
