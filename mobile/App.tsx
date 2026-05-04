import './global.css';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LicenseEntryScreen from './src/screens/LicenseEntryScreen';
import LoginScreen from './src/screens/LoginScreen';
import TablesScreen from './src/screens/TablesScreen';
import OrderScreen from './src/screens/OrderScreen';
import MenuScreen from './src/screens/MenuScreen';
import ShiftGate from './src/components/ShiftGate';
import { toastConfig } from './src/components/ui/Toast';
import type { RootStackParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppContent() {
  const { ready, tenant, user } = useAuth();

  if (!ready) {
    return (
      <View className="flex-1 bg-bg-base items-center justify-center">
        <ActivityIndicator color="#60A5FA" size="large" />
      </View>
    );
  }

  if (!tenant) return <LicenseEntryScreen />;
  if (!user) return <LoginScreen />;

  return (
    <ShiftGate>
      <NavigationContainer theme={DarkTheme}>
        <Stack.Navigator
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B1220' } }}
        >
          <Stack.Screen name="Tables" component={TablesScreen} />
          <Stack.Screen name="Order" component={OrderScreen} />
          <Stack.Screen name="Menu" component={MenuScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ShiftGate>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <AppContent />
          <Toast config={toastConfig} />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
