import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { redeemLicense } from '../api/client';

export default function LicenseEntryScreen() {
  const { saveTenant } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const clean = code.trim().toUpperCase().replace(/\s+/g, '');
    if (clean.length < 8) {
      Alert.alert('Código inválido', 'Revisa el código de licencia');
      return;
    }
    setLoading(true);
    try {
      const res = await redeemLicense(clean);
      await saveTenant(res.tenant);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e.message || 'No se pudo validar';
      Alert.alert('Licencia inválida', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>restPOS</Text>
        <Text style={styles.subtitle}>Comandero</Text>
        <Text style={styles.label}>Código de licencia</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="ABCD1234..."
          placeholderTextColor="#64748B"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!loading}
        />
        <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Activar</Text>}
        </TouchableOpacity>
        <Text style={styles.hint}>El administrador genera este código desde el panel /admin</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#1E293B', borderRadius: 20, padding: 28, borderWidth: 1, borderColor: '#334155' },
  title: { color: '#fff', fontSize: 32, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: '#93C5FD', fontSize: 16, textAlign: 'center', marginBottom: 28 },
  label: { color: '#94A3B8', fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  button: { backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  hint: { color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 16 },
});
