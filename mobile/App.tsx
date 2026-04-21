import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LicenseEntryScreen from './src/screens/LicenseEntryScreen';
import LoginScreen from './src/screens/LoginScreen';
import TablesScreen from './src/screens/TablesScreen';

function AppContent() {
  const { ready, tenant, user } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#3B82F6" size="large" />
      </View>
    );
  }

  if (!tenant) return <LicenseEntryScreen />;
  if (!user) return <LoginScreen />;
  return <TablesScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
