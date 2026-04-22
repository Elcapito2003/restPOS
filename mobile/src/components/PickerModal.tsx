import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';

export interface PickerOption { key: string | number; label: string; sub?: string; disabled?: boolean; color?: string }

interface Props {
  visible: boolean;
  title: string;
  options: PickerOption[];
  loading?: boolean;
  emptyText?: string;
  onClose: () => void;
  onPick: (key: string | number) => Promise<void> | void;
}

export default function PickerModal({ visible, title, options, loading, emptyText = 'Sin opciones', onClose, onPick }: Props) {
  const [submitting, setSubmitting] = useState<string | number | null>(null);

  useEffect(() => { if (!visible) setSubmitting(null); }, [visible]);

  const handlePick = async (key: string | number) => {
    setSubmitting(key);
    try {
      await onPick(key);
      onClose();
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color="#3B82F6" style={{ marginVertical: 30 }} />
          ) : options.length === 0 ? (
            <Text style={styles.empty}>{emptyText}</Text>
          ) : (
            <ScrollView style={{ maxHeight: 460 }}>
              {options.map(o => (
                <TouchableOpacity
                  key={o.key}
                  disabled={o.disabled || submitting === o.key}
                  style={[styles.row, o.disabled && { opacity: 0.4 }]}
                  onPress={() => handlePick(o.key)}
                >
                  {o.color ? <View style={[styles.dot, { backgroundColor: o.color }]} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{o.label}</Text>
                    {o.sub ? <Text style={styles.rowSub}>{o.sub}</Text> : null}
                  </View>
                  {submitting === o.key ? <ActivityIndicator color="#93C5FD" /> : <Text style={styles.arrow}>›</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1E293B', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28, maxHeight: '85%' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  closeText: { color: '#94A3B8', fontSize: 22, padding: 4 },
  empty: { color: '#64748B', textAlign: 'center', marginVertical: 30 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', padding: 14, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: '#334155' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  rowLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rowSub: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  arrow: { color: '#475569', fontSize: 22 },
});
