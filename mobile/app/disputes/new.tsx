import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../src/components/ui/Button';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Card } from '../../src/components/ui/Card';
import { colors, theme } from '../../src/theme';
import { disputeService, type DisputeEvidenceFile } from '../../src/services/disputeService';

const SUGGESTIONS = [
  'Errander marked complete but I never received my item',
  'Item arrived damaged or incomplete',
  'Errander was unreachable / went missing',
  'I was charged incorrectly',
];

export default function NewDisputeScreen() {
  const params = useLocalSearchParams<{ delivery_id: string; bid_id?: string; request_id?: string }>();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<DisputeEvidenceFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const hasParams = !!params.delivery_id;

  const pickEvidence = async () => {
    if (evidence.length >= 5) {
      Alert.alert('Limit reached', 'You can attach up to 5 files.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is required to attach evidence.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5 - evidence.length,
    });
    if (res.canceled) return;
    const files = res.assets.slice(0, 5 - evidence.length).map((a) => {
      const ext = (a.fileName ?? a.uri).split('.').pop()?.toLowerCase() ?? 'jpg';
      return { uri: a.uri, name: `evidence.${ext}`, type: a.mimeType ?? 'image/jpeg' };
    });
    setEvidence((prev) => [...prev, ...files]);
  };

  const submit = async () => {
    if (!reason.trim()) {
      Alert.alert('Reason required', 'Tell us briefly what went wrong.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await disputeService.create({
        delivery_id: params.delivery_id!,
        bid_id: params.bid_id,
        request_id: params.request_id,
        reason: reason.trim(),
        description: description.trim(),
        evidence,
      });
      Alert.alert('Dispute raised', 'The errander has been notified and funds stay in escrow while we review.', [
        { text: 'View dispute', onPress: () => router.replace(`/disputes/${data.data.id}`) },
      ]);
    } catch (err: any) {
      Alert.alert('Could not raise dispute', err.response?.data?.message ?? 'Please try again.');
    } finally { setSubmitting(false); }
  };

  if (!hasParams) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader title="Raise a Dispute" />
          <Card>
            <Text style={styles.emptyText}>No errand selected. Open the dispute form from an active errand.</Text>
          </Card>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Raise a Dispute" />
        <Card>
          <Text style={styles.cardHint}>Funds stay protected in escrow while your dispute is reviewed.</Text>

          <Text style={styles.label}>Reason *</Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={(t) => setReason(t.slice(0, 200))}
            maxLength={200}
            placeholder="What went wrong?"
            placeholderTextColor={colors.neutral[300]}
          />
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <TouchableOpacity key={s} style={styles.suggestionPill} onPress={() => setReason(s)} activeOpacity={0.8}>
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={(t) => setDescription(t.slice(0, 2000))}
            multiline
            placeholder="Give as much detail as possible…"
            placeholderTextColor={colors.neutral[300]}
          />
          <Text style={styles.counter}>{description.length}/2000</Text>

          <Text style={styles.label}>Evidence (up to 5 files)</Text>
          <TouchableOpacity style={styles.picker} onPress={pickEvidence} activeOpacity={0.8}>
            <Text style={styles.pickerText}>+ Add photos or videos</Text>
          </TouchableOpacity>
          <View style={styles.thumbs}>
            {evidence.map((f, i) => (
              <View key={i} style={styles.thumbWrap}>
                <Image source={{ uri: f.uri }} style={styles.thumb} />
                <TouchableOpacity style={styles.remove} onPress={() => setEvidence((prev) => prev.filter((_, j) => j !== i))}>
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </Card>

        <Button title={submitting ? 'Submitting…' : 'Submit Dispute'} onPress={submit} loading={submitting} fullWidth size="lg" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 56, paddingBottom: 40 },
  emptyText: { textAlign: 'center', color: colors.neutral[400], fontSize: 14, paddingVertical: 12 },
  cardHint: { fontSize: 13, color: colors.neutral[500], marginBottom: 4 },
  label: { fontSize: 14, fontWeight: '500', color: colors.neutral[600], marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, padding: 14, fontSize: 15, color: colors.secondary[500] },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  counter: { fontSize: 11, color: colors.neutral[400], textAlign: 'right', marginTop: 4 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  suggestionPill: { backgroundColor: '#FFF1E6', borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 8 },
  suggestionText: { fontSize: 12, color: '#B24E00', fontWeight: '600' },
  picker: {
    height: 96, borderRadius: theme.radius.lg, borderWidth: 1, borderStyle: 'dashed',
    borderColor: colors.neutral[300], backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  pickerText: { color: colors.primary[500], fontSize: 14, fontWeight: '600' },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#E9ECEF' },
  remove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FF1744', alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
});
