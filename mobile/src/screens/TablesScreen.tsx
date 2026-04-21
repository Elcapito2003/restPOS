import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getSocket, disconnectSocket } from '../socket';

export default function TablesScreen() {
  const { user, token, tenant, logout } = useAuth();

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    socket.on('user:deactivated', () => {
      Alert.alert('Sesión cerrada', 'Tu cuenta fue desactivada por un administrador.', [
        { text: 'OK', onPress: () => logout() },
      ]);
    });

    return () => {
      socket.off('user:deactivated');
    };
  }, [token]);

  const handleLogout = async () => {
    disconnectSocket();
    await logout();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{tenant?.name}</Text>
          <Text style={styles.subtitle}>Bienvenido, {user?.display_name}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.center}>
        <Text style={styles.placeholder}>Mesas (pendiente)</Text>
        <Text style={styles.placeholderSmall}>La lista de mesas y el menú vienen en el siguiente paso.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 28 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
  logoutBtn: { backgroundColor: '#1E293B', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  logoutText: { color: '#FCA5A5', fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { color: '#fff', fontSize: 22, fontWeight: '600' },
  placeholderSmall: { color: '#94A3B8', fontSize: 14, marginTop: 8, textAlign: 'center' },
});
