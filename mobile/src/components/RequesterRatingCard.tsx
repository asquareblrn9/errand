import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { colors } from '../theme';
import { ratingService } from '../services/ratingService';

const TIP_OPTIONS = [200, 500, 1000, 0];

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'window closed';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface Props {
  bidId: string;
  erranderName: string;
  closesAt: string;
  tipped: boolean;
  onChanged: () => void;
}

export function RequesterRatingCard({ bidId, erranderName, closesAt, tipped, onChanged }: Props) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [tip, setTip] = useState<number | 'custom' | null>(null);
  const [customTip, setCustomTip] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasTipped, setHasTipped] = useState(tipped);
  const [remainingMs, setRemainingMs] = useState(() => new Date(closesAt).getTime() - Date.now());

  // Countdown display — the parent hides the whole screen when the window closes
  useEffect(() => {
    const t = setInterval(() => {
      setRemainingMs(new Date(closesAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [closesAt]);

  const firstName = erranderName.split(' ')[0];
  const tipValue = tip === 'custom' ? parseFloat(customTip) : (tip ?? 0);

  const handleSubmitRating = async () => {
    if (rating === 0) {
      Alert.alert('Required', 'Please select a rating.');
      return;
    }
    setSubmitting(true);
    try {
      await ratingService.submit({ bid_id: bidId, rating, review: review.trim() || undefined });
      Alert.alert('Thanks!', `Your rating was sent to ${firstName}.`);
      onChanged();
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (code === 'rating_window_closed') {
        Alert.alert('Window closed', 'Ratings are only available during the dispute window.');
        onChanged();
      } else if (code === 'already_rated') {
        onChanged();
      } else {
        Alert.alert('Error', err.response?.data?.message ?? 'Failed to submit rating');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendTip = async () => {
    if (tipValue <= 0 || Number.isNaN(tipValue)) {
      Alert.alert('Tip', 'Select a tip amount or enter a custom amount.');
      return;
    }
    setSubmitting(true);
    try {
      await ratingService.sendTip(bidId, tipValue);
      Alert.alert('Tip sent', `₦${tipValue.toLocaleString()} sent to ${firstName}.`);
      setHasTipped(true);
      onChanged();
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (code === 'already_tipped') {
        Alert.alert('Already tipped', 'You have already tipped this errand.');
        setHasTipped(true);
      } else if (code === 'tip_window_closed') {
        Alert.alert('Window closed', 'Tips are only available during the dispute window.');
        onChanged();
      } else {
        Alert.alert('Error', err.response?.data?.message ?? 'Could not send tip');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Rate {firstName}</Text>
        <Text style={styles.countdown}>Rate within {formatRemaining(remainingMs)}</Text>
      </View>

      {/* Stars */}
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
        maxLength={500}
      />

      <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmitRating} disabled={submitting}>
        <Text style={styles.primaryBtnText}>{submitting ? 'Submitting…' : 'Submit rating'}</Text>
      </TouchableOpacity>

      {!hasTipped ? (
        <View style={styles.tipSection}>
          <Text style={styles.tipLabel}>Want to add a tip?</Text>
          <View style={styles.chipRow}>
            {TIP_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, tip === t && styles.chipActive]}
                onPress={() => setTip(tip === t ? null : t)}
              >
                <Text style={[styles.chipText, tip === t && styles.chipActiveText]}>
                  {t === 0 ? 'No tip' : `₦${t.toLocaleString()}`}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.chip, tip === 'custom' && styles.chipActive]}
              onPress={() => setTip(tip === 'custom' ? null : 'custom')}
            >
              <Text style={[styles.chipText, tip === 'custom' && styles.chipActiveText]}>Custom</Text>
            </TouchableOpacity>
          </View>
          {tip === 'custom' && (
            <TextInput
              style={styles.input}
              value={customTip}
              onChangeText={setCustomTip}
              placeholder="Tip amount (₦)"
              placeholderTextColor={colors.neutral[300]}
              keyboardType="numeric"
            />
          )}
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleSendTip} disabled={submitting}>
            <Text style={styles.secondaryBtnText}>Send tip</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.tippedText}>✓ Tip sent — thank you!</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14.5, fontWeight: '700', color: colors.secondary[500] },
  countdown: { fontSize: 11, color: colors.neutral[500], fontWeight: '600' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 4 },
  star: { fontSize: 34 },
  starActive: { color: colors.accent[500] },
  starInactive: { color: colors.neutral[100] },
  input: {
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: 13,
    padding: 13,
    fontSize: 13.5,
    color: colors.secondary[500],
    minHeight: 56,
    textAlignVertical: 'top',
  },
  primaryBtn: { backgroundColor: colors.primary[500], borderRadius: 15, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  secondaryBtn: { borderRadius: 13, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.primary[500] },
  secondaryBtnText: { color: colors.primary[500], fontSize: 13, fontWeight: '600' },
  tipSection: { marginTop: 4, gap: 8 },
  tipLabel: { fontSize: 11.5, color: colors.neutral[500], fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 100,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  chipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.secondary[500] },
  chipActiveText: { color: colors.white },
  tippedText: { fontSize: 12, fontWeight: '700', color: colors.primary[500], textAlign: 'center' },
});
