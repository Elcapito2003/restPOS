import { useState } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, Pressable, Alert, TextInput } from 'react-native';
import { Camera, Image as ImageIcon, ChevronLeft, AlertCircle, ReceiptText } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { scanSupplierTicket, ScannedTicket } from '../api/client';
import { showError, showSuccess } from '../lib/toast';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanTicket'>;

// Solo extrae y muestra. Guardar como recepción en el módulo purchasing se
// hace después si el flujo se valida (TODO en CLAUDE.md).
export default function ScanTicketScreen({ navigation }: Props) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScannedTicket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickAndScan = async (source: 'camera' | 'library') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Permisos
      const perm = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso denegado', `Necesito permiso para ${source === 'camera' ? 'usar la cámara' : 'leer la galería'}`);
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7, // jpeg 70% — balance entre legibilidad y tamaño
        base64: true,
        allowsEditing: false,
      };
      const res = source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setImageUri(asset.uri);
      setResult(null);
      setError(null);

      if (!asset.base64) { setError('No se pudo leer la imagen como base64'); return; }
      setLoading(true);
      const scanned = await scanSupplierTicket(asset.base64);
      setResult(scanned);
      showSuccess('Ticket procesado', 'Verifica los datos antes de guardar');
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Error desconocido';
      setError(msg);
      showError('Error al escanear', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-bg-base">
      {/* Header */}
      <View className="px-4 pt-12 pb-3 flex-row items-center gap-3 border-b border-bg-border">
        <Pressable onPress={() => navigation.goBack()} className="p-2 -ml-2">
          <ChevronLeft size={22} color="#94A3B8" />
        </Pressable>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <ReceiptText size={18} color="#60A5FA" />
            <Text className="text-ink-primary text-base font-bold">Escanear ticket de proveedor</Text>
          </View>
          <Text className="text-ink-muted text-xs">Toma foto del ticket y la IA extrae los datos</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Botones de captura */}
        <View className="flex-row gap-3 mb-4">
          <Pressable
            onPress={() => pickAndScan('camera')}
            disabled={loading}
            style={({ pressed }) => ({ opacity: loading ? 0.5 : pressed ? 0.85 : 1 })}
            className="flex-1 bg-brand-500 py-4 rounded-2xl flex-row items-center justify-center gap-2"
          >
            <Camera size={20} color="#fff" />
            <Text className="text-white font-bold">Tomar foto</Text>
          </Pressable>
          <Pressable
            onPress={() => pickAndScan('library')}
            disabled={loading}
            style={({ pressed }) => ({ opacity: loading ? 0.5 : pressed ? 0.85 : 1 })}
            className="flex-1 bg-bg-card border border-bg-border py-4 rounded-2xl flex-row items-center justify-center gap-2"
          >
            <ImageIcon size={20} color="#60A5FA" />
            <Text className="text-ink-primary font-bold">De galería</Text>
          </Pressable>
        </View>

        {/* Imagen capturada */}
        {imageUri && (
          <View className="bg-bg-card rounded-2xl p-2 mb-4 border border-bg-border">
            <Image source={{ uri: imageUri }} style={{ width: '100%', height: 320, borderRadius: 12 }} resizeMode="contain" />
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View className="bg-bg-card rounded-2xl p-6 mb-4 items-center">
            <ActivityIndicator size="large" color="#60A5FA" />
            <Text className="text-ink-secondary mt-3">Analizando ticket con IA…</Text>
            <Text className="text-ink-muted text-xs mt-1">Puede tomar 5-15 segundos</Text>
          </View>
        )}

        {/* Error */}
        {error && !loading && (
          <View className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4 flex-row items-start gap-2">
            <AlertCircle size={18} color="#F87171" />
            <Text className="text-red-300 flex-1">{error}</Text>
          </View>
        )}

        {/* Resultado */}
        {result && !loading && <ResultEditor result={result} onChange={setResult} />}
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View className="mb-3">
      <Text className="text-ink-muted text-xs mb-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || ''}
        placeholderTextColor="#475569"
        className="bg-bg-elevated border border-bg-border rounded-lg px-3 py-2 text-ink-primary"
      />
    </View>
  );
}

function ResultEditor({ result, onChange }: { result: ScannedTicket; onChange: (r: ScannedTicket) => void }) {
  const update = (patch: Partial<ScannedTicket>) => onChange({ ...result, ...patch });
  const updateItem = (idx: number, patch: Partial<ScannedTicket['items'][number]>) => {
    const items = [...result.items];
    items[idx] = { ...items[idx], ...patch };
    onChange({ ...result, items });
  };

  return (
    <View className="bg-bg-card rounded-2xl p-4 border border-bg-border">
      <Text className="text-ink-primary text-base font-bold mb-3">Datos extraídos (editables)</Text>

      <Field label="Proveedor" value={result.supplier_name || ''} onChange={(v) => update({ supplier_name: v || null })} placeholder="Nombre del proveedor" />
      <Field label="RFC" value={result.supplier_rfc || ''} onChange={(v) => update({ supplier_rfc: v || null })} placeholder="Opcional" />
      <Field label="Folio / Ticket #" value={result.ticket_number || ''} onChange={(v) => update({ ticket_number: v || null })} />
      <Field label="Fecha" value={result.date || ''} onChange={(v) => update({ date: v || null })} placeholder="YYYY-MM-DD" />

      <Text className="text-ink-primary font-semibold mt-2 mb-2">Productos ({result.items.length})</Text>
      {result.items.map((it, i) => (
        <View key={i} className="bg-bg-elevated rounded-lg p-3 mb-2">
          <TextInput
            value={it.description}
            onChangeText={(v) => updateItem(i, { description: v })}
            className="text-ink-primary font-medium mb-2"
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text className="text-ink-muted text-[10px] mb-0.5">Cantidad</Text>
              <TextInput
                value={String(it.quantity)}
                onChangeText={(v) => updateItem(i, { quantity: Number(v) || 0 })}
                keyboardType="decimal-pad"
                className="bg-bg-card rounded px-2 py-1 text-ink-primary"
              />
            </View>
            <View className="flex-1">
              <Text className="text-ink-muted text-[10px] mb-0.5">Unidad</Text>
              <TextInput
                value={it.unit || ''}
                onChangeText={(v) => updateItem(i, { unit: v || null })}
                className="bg-bg-card rounded px-2 py-1 text-ink-primary"
              />
            </View>
            <View className="flex-1">
              <Text className="text-ink-muted text-[10px] mb-0.5">P. unit.</Text>
              <TextInput
                value={String(it.unit_price)}
                onChangeText={(v) => updateItem(i, { unit_price: Number(v) || 0 })}
                keyboardType="decimal-pad"
                className="bg-bg-card rounded px-2 py-1 text-ink-primary"
              />
            </View>
            <View className="flex-1">
              <Text className="text-ink-muted text-[10px] mb-0.5">Total</Text>
              <TextInput
                value={String(it.total)}
                onChangeText={(v) => updateItem(i, { total: Number(v) || 0 })}
                keyboardType="decimal-pad"
                className="bg-bg-card rounded px-2 py-1 text-ink-primary"
              />
            </View>
          </View>
        </View>
      ))}

      <View className="flex-row gap-2 mt-2">
        <View className="flex-1">
          <Field label="Subtotal" value={String(result.subtotal ?? '')} onChange={(v) => update({ subtotal: Number(v) || null })} />
        </View>
        <View className="flex-1">
          <Field label="IVA" value={String(result.tax ?? '')} onChange={(v) => update({ tax: Number(v) || null })} />
        </View>
        <View className="flex-1">
          <Field label="Total" value={String(result.total ?? '')} onChange={(v) => update({ total: Number(v) || 0 })} />
        </View>
      </View>

      <Text className="text-ink-muted text-[11px] mt-2">
        Por ahora solo se muestra el resultado. Guardar como recepción de compra se agrega en próxima versión.
      </Text>
    </View>
  );
}
