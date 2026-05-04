import { ReactNode } from 'react';
import { Pressable, Text, ActivityIndicator, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  haptic?: boolean;
  children: ReactNode;
}

const SIZE_STYLES: Record<Size, { container: string; text: string }> = {
  sm: { container: 'px-3 py-2 rounded-lg', text: 'text-sm font-semibold' },
  md: { container: 'px-5 py-3 rounded-xl', text: 'text-base font-semibold' },
  lg: { container: 'px-6 py-4 rounded-2xl', text: 'text-lg font-bold' },
};

const GRADIENTS: Record<Variant, [string, string] | null> = {
  primary: ['#3B82F6', '#2563EB'],
  success: ['#22C55E', '#16A34A'],
  danger: ['#EF4444', '#DC2626'],
  secondary: null,
  ghost: null,
};

const VARIANT_STYLES: Record<Variant, { container: string; text: string }> = {
  primary: { container: '', text: 'text-white' },
  success: { container: '', text: 'text-white' },
  danger: { container: '', text: 'text-white' },
  secondary: { container: 'bg-bg-elevated border border-bg-border', text: 'text-ink-primary' },
  ghost: { container: 'bg-transparent', text: 'text-brand-400' },
};

export default function Button({
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  haptic = true,
  children,
}: ButtonProps) {
  const sizeStyle = SIZE_STYLES[size];
  const variantStyle = VARIANT_STYLES[variant];
  const gradient = GRADIENTS[variant];
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (isDisabled || !onPress) return;
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const Inner = (
    <View className={`flex-row items-center justify-center gap-2 ${sizeStyle.container}`}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? '#F8FAFC' : '#fff'} />
      ) : (
        <>
          {leftIcon}
          <Text className={`${sizeStyle.text} ${variantStyle.text}`}>{children}</Text>
          {rightIcon}
        </>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        { opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        fullWidth && { width: '100%' },
      ]}
    >
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className={sizeStyle.container.split(' ').filter(c => c.startsWith('rounded')).join(' ')}
        >
          {Inner}
        </LinearGradient>
      ) : (
        <View className={variantStyle.container + ' ' + sizeStyle.container.split(' ').filter(c => c.startsWith('rounded')).join(' ')}>
          {Inner}
        </View>
      )}
    </Pressable>
  );
}
