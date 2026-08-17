import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, theme } from '../src/theme';
import api from '../src/services/api';

const TIP_OPTIONS = [200, 500, 1000, 0];

export default function RateUserScreen() {
  const { bid_id, errander_name, amount } = useLocalSearchParams<{ bid_id: string; errander_name?: string; amount?: string }>();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [tip, setTip] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const name = errander_name ?? 'your errander';
  const firstName = name.split(' ')[0];

  const handleSubmit = async () => {
    if (rating === 0) { Alert.alert('Required', 'Please select a rating.'); return; }
    setSubmitting(true);
    try {
      await api.post('/ratings', { bid_id, rating, review, tip: tip > 0 ? tip : 0 });
      Alert.alert('Thanks!', `Your rating${tip > 0 ? ` and ₦${tip.toLocaleString()} tip` : ''} was sent to ${firstName}.`, [
        { text: 'Done', onPress: () => router.replace('/(tabs)/home') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Failed to submit rating');
    } finally { setSubmitting(false); }
  };

  const handleSkip = () => router.replace('/(tabs)/home');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Success header */}
        <View style={styles.successBadge}><Text style={styles.successCheck}>✓</Text></View>
        <Text style={styles.successTitle}>Errand completed</Text>
        {amount ? <Text style={styles.successDesc}>₦{Number(amount).toLocaleString()} released to {name}.</Text> : null}

        {/* Rating card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Rate {firstName}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Text style={[styles.star, star <= rating ? styles.starActive : styles.starInactive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            value={review}
            onChangeText={setReview}
            placeholder="Add a comment (optional)"
            placeholderTextColor={colors.neutral[300]}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.cardLabel}>Add a tip?</Text>
          <View style={styles.chipRow}>
            {TIP_OPTIONS.map((t) => (
              <TouchableOpacity key={t} style={[styles.chip, tip === t && styles.chipActive]} onPress={() => setTip(t)}>
                <Text style={[styles.chipText, tip === t && styles.chipActiveText]}>{t === 0 ? 'No tip' : `₦${t.toLocaleString()}`}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.stickyCta}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.primaryBtnText}>{submitting ? 'Submitting…' : 'Done'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleSkip}>
          <Text style={styles.secondaryBtnText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { paddingHorizontal: 20, paddingTop: 56, alignItems: 'center', paddingBottom: 24 },
  successBadge: { width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(0,168,107,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successCheck: { color: colors.primary[500], fontSize: 26, fontWeight: '800' },
  successTitle: { fontSize: 19, fontWeight: '700', color: colors.secondary[500], marginBottom: 6 },
  successDesc: { fontSize: 12.5, color: colors.neutral[500], marginBottom: 20 },
  card: { width: '100%', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[100], borderRadius: 18, padding: 16 },
  cardLabel: { fontSize: 11.5, color: colors.neutral[500], fontWeight: '600', marginBottom: 8, marginTop: 6 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 12 },
  star: { fontSize: 32 },
  starActive: { color: colors.accent[500] },
  starInactive: { color: colors.neutral[100] },
  input: { backgroundColor: colors.neutral[100], borderWidth: 1, borderColor: colors.neutral[100], borderRadius: 13, padding: 13, fontSize: 13.5, color: colors.secondary[500], minHeight: 60, textAlignVertical: 'top', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 100, backgroundColor: colors.neutral[100], borderWidth: 1, borderColor: colors.neutral[100] },
  chipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.secondary[500] },
  chipActiveText: { color: colors.white },
  stickyCta: { padding: 20, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.neutral[100], gap: 8 },
  primaryBtn: { backgroundColor: colors.primary[500], borderRadius: 15, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  secondaryBtn: { borderRadius: 13, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.neutral[200] },
  secondaryBtnText: { color: colors.secondary[500], fontSize: 13, fontWeight: '600' },
});
