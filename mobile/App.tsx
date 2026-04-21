import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LicenseEntryScreen from './src/screens/LicenseEntryScreen';
import LoginScreen from './src/screens/LoginScreen';
import TablesScreen from './src/screens/TablesScreen';
import OrderScreen from './src/screens/OrderScreen';
import MenuScreen from './src/screens/MenuScreen';
import type { RootStackParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

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

  return (
    <NavigationContainer theme={DarkTheme}>
      <Stack.Navigator
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0F172A' } }}
      >
        <Stack.Screen name="Tables" component={TablesScreen} />
        <Stack.Screen name="Order" component={OrderScreen} />
        <Stack.Screen name="Menu" component={MenuScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
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
