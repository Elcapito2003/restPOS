import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useAuth, User } from '../context/AuthContext';
import { fetchActiveUsers, pinLogin } from '../api/client';

export default function LoginScreen() {
  const { tenant, clearTenant, saveSession } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchActiveUsers();
      setUsers(list);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!picked || pin.length < 4) return;
    setSubmitting(true);
    try {
      const res = await pinLogin(picked.id, pin);
      await saveSession(res.token, res.user);
    } catch (e: any) {
      Alert.alert('PIN incorrecto', e?.response?.data?.error || e.message);
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const changeRestaurant = () => {
    Alert.alert(
      '¿Cambiar restaurante?',
      'Vas a perder la configuración de este dispositivo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, cambiar', style: 'destructive', onPress: () => clearTenant() },
      ]
    );
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
          <Text style={styles.tenantName}>{tenant?.name}</Text>
          <Text style={styles.tenantSlug}>Selecciona tu usuario</Text>
        </View>
        <TouchableOpacity onPress={changeRestaurant}>
          <Text style={styles.changeText}>Cambiar</Text>
        </TouchableOpacity>
      </View>

      {!picked ? (
        <ScrollView contentContainerStyle={styles.grid}>
          {users.map(u => (
            <TouchableOpacity
              key={u.id}
              style={[styles.userCard, { borderColor: u.avatar_color || '#3B82F6' }]}
              onPress={() => { setPicked(u); setPin(''); }}
            >
              <View style={[styles.avatar, { backgroundColor: u.avatar_color || '#3B82F6' }]}>
                <Text style={styles.avatarText}>{u.display_name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.userName} numberOfLines={1}>{u.display_name}</Text>
              <Text style={styles.userRole}>{u.role}</Text>
            </TouchableOpacity>
          ))}
          {users.length === 0 && (
            <Text style={styles.emptyText}>No hay usuarios activos. Crea uno desde el desktop.</Text>
          )}
        </ScrollView>
      ) : (
        <View style={styles.pinBox}>
          <TouchableOpacity onPress={() => setPicked(null)} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Volver</Text>
          </TouchableOpacity>
          <View style={[styles.avatarLg, { backgroundColor: picked.avatar_color || '#3B82F6' }]}>
            <Text style={styles.avatarTextLg}>{picked.display_name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.pickedName}>{picked.display_name}</Text>
          <TextInput
            style={styles.pinInput}
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 8))}
            placeholder="PIN"
            placeholderTextColor="#64748B"
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
            onSubmitEditing={submit}
          />
          <TouchableOpacity
            style={[styles.button, (submitting || pin.length < 4) && { opacity: 0.5 }]}
            onPress={submit}
            disabled={submitting || pin.length < 4}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 20 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 20 },
  tenantName: { color: '#fff', fontSize: 22, fontWeight: '700' },
  tenantSlug: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
  changeText: { color: '#93C5FD', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 40 },
  userCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: '30%',
    minWidth: 110,
    borderWidth: 2,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  userName: { color: '#fff', fontWeight: '600', fontSize: 14, textAlign: 'center' },
  userRole: { color: '#94A3B8', fontSize: 11, textTransform: 'capitalize', marginTop: 2 },
  emptyText: { color: '#94A3B8', textAlign: 'center', flex: 1, marginTop: 40 },
  pinBox: { alignItems: 'center', marginTop: 40 },
  backBtn: { alignSelf: 'flex-start', padding: 8 },
  backText: { color: '#93C5FD', fontSize: 16 },
  avatarLg: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 16, marginTop: 20 },
  avatarTextLg: { color: '#fff', fontSize: 40, fontWeight: '700' },
  pickedName: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 28 },
  pinInput: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 28,
    textAlign: 'center',
    letterSpacing: 14,
    width: '70%',
    marginBottom: 20,
  },
  button: { backgroundColor: '#3B82F6', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
