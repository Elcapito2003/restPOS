import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  initialValue?: string;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  multiline?: boolean;
  submitLabel?: string;
  suffix?: string;
  prefix?: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void> | void;
}

export default function ValueModal({
  visible, title, subtitle, initialValue = '', placeholder, keyboardType = 'default',
  multiline = false, submitLabel = 'Guardar', suffix, prefix, onClose, onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (visible) { setValue(initialValue); setLoading(false); } }, [visible, initialValue]);

  const submit = async () => {
    setLoading(true);
    try {
      await onSubmit(value);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.inputRow}>
            {prefix ? <Text style={styles.fix}>{prefix}</Text> : null}
            <TextInput
              style={[styles.input, multiline && styles.inputMulti]}
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor="#64748B"
              keyboardType={keyboardType}
              multiline={multiline}
              numberOfLines={multiline ? 3 : 1}
              autoFocus
            />
            {suffix ? <Text style={styles.fix}>{suffix}</Text> : null}
          </View>
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onClose} disabled={loading}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnOk, loading && { opacity: 0.5 }]} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnOkText}>{submitLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#1E293B', borderRadius: 18, padding: 22, borderWidth: 1, borderColor: '#334155' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#94A3B8', fontSize: 12, marginTop: 4, marginBottom: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', borderRadius: 12, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, marginTop: 8, marginBottom: 16 },
  fix: { color: '#93C5FD', fontSize: 18, fontWeight: '600', paddingHorizontal: 6 },
  input: { flex: 1, color: '#fff', fontSize: 18, paddingVertical: 14 },
  inputMulti: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  btnRow: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnCancel: { backgroundColor: '#334155' },
  btnCancelText: { color: '#CBD5E1', fontWeight: '600' },
  btnOk: { backgroundColor: '#3B82F6' },
  btnOkText: { color: '#fff', fontWeight: '700' },
});
