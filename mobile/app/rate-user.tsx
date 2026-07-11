import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../src/components/ui/Button';
import { colors, theme } from '../src/theme';
import api from '../src/services/api';

export default function RateUserScreen() {
  const { bid_id } = useLocalSearchParams<{ bid_id: string }>();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) { Alert.alert('Required', 'Please select a rating.'); return; }
    setSubmitting(true);
    try {
      await api.post('/ratings', { bid_id, rating, review });
      router.back();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rate Your Experience</Text>

      {/* Stars */}
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => setRating(star)}>
            <Text style={[styles.star, star <= rating ? styles.starActive : styles.starInactive]}>
              ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.ratingLabel}>{rating === 0 ? 'Tap to rate' : `${rating} out of 5`}</Text>

      <TextInput style={styles.input} value={review} onChangeText={setReview} placeholder="Write a review (optional)" placeholderTextColor={colors.neutral[300]} multiline numberOfLines={4} />

      <Button title="Submit Rating" onPress={handleSubmit} loading={submitting} fullWidth size="lg" />
      <Button title="Skip" variant="ghost" onPress={() => router.back()} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50], justifyContent: 'center', padding: theme.spacing.lg },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], textAlign: 'center', marginBottom: 24 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  star: { fontSize: 44 },
  starActive: { color: '#FFD700' },
  starInactive: { color: colors.neutral[200] },
  ratingLabel: { textAlign: 'center', fontSize: 14, color: colors.neutral[400], marginBottom: 24 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, padding: 14, fontSize: 15, color: colors.neutral[600], minHeight: 100, textAlignVertical: 'top', marginBottom: 20 },
});
