import { View, Text } from 'react-native';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react-native';
import { BaseToastProps } from 'react-native-toast-message';

interface CustomToastProps extends BaseToastProps {
  text1?: string;
  text2?: string;
}

function ToastBase({ text1, text2, icon, accent }: CustomToastProps & { icon: React.ReactNode; accent: string }) {
  return (
    <View className={`mx-4 mt-2 px-4 py-3 rounded-2xl bg-bg-elevated border-l-4 ${accent} flex-row items-center gap-3 shadow-lg`}>
      <View>{icon}</View>
      <View className="flex-1">
        {text1 && <Text className="text-ink-primary font-semibold">{text1}</Text>}
        {text2 && <Text className="text-ink-secondary text-sm mt-0.5">{text2}</Text>}
      </View>
    </View>
  );
}

export const toastConfig = {
  success: (props: CustomToastProps) => (
    <ToastBase {...props} icon={<CheckCircle2 size={22} color="#22C55E" />} accent="border-success" />
  ),
  error: (props: CustomToastProps) => (
    <ToastBase {...props} icon={<XCircle size={22} color="#EF4444" />} accent="border-danger" />
  ),
  warning: (props: CustomToastProps) => (
    <ToastBase {...props} icon={<AlertTriangle size={22} color="#F59E0B" />} accent="border-warning" />
  ),
  info: (props: CustomToastProps) => (
    <ToastBase {...props} icon={<Info size={22} color="#60A5FA" />} accent="border-brand-500" />
  ),
};
