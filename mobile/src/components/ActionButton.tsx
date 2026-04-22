import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';

interface Props {
  label: string;
  icon: string; // single char or short text
  color: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function ActionButton({ label, icon, color, onPress, disabled, loading }: Props) {
  return (
    <TouchableOpacity
      disabled={disabled || loading}
      onPress={onPress}
      style={[styles.btn, { backgroundColor: color }, (disabled || loading) && { opacity: 0.5 }]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '23.5%',
    aspectRatio: 1.3,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  icon: { fontSize: 20, marginBottom: 2 },
  label: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
