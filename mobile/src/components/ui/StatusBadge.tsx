import { View, Text } from 'react-native';

type Tone = 'success' | 'danger' | 'warning' | 'neutral' | 'info';

interface StatusBadgeProps {
  label: string;
  tone?: Tone;
}

const TONES: Record<Tone, { container: string; text: string }> = {
  success: { container: 'bg-success/15', text: 'text-success' },
  danger: { container: 'bg-danger/15', text: 'text-danger' },
  warning: { container: 'bg-warning/15', text: 'text-warning' },
  info: { container: 'bg-brand-500/15', text: 'text-brand-400' },
  neutral: { container: 'bg-bg-elevated', text: 'text-ink-secondary' },
};

export default function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  const t = TONES[tone];
  return (
    <View className={`px-2 py-0.5 rounded-full ${t.container}`}>
      <Text className={`text-xs font-semibold uppercase ${t.text}`}>{label}</Text>
    </View>
  );
}
