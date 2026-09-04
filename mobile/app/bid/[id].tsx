import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { colors } from '../../src/theme';
import { requestService } from '../../src/services/requestService';
import { bidService } from '../../src/services/bidService';
import { stripHtml } from '../../src/utils/format';
import type { RequestDetail } from '../../src/types/request';

/** Parse free-text durations like "45 minutes", "2 hours", "1hr" into minutes. */
function parseMinutes(text: string): number | null {
  const t = text.trim().toLowerCase();
  const minutes = t.match(/(\d+)\s*(min|mins|minutes?)/);
  if (minutes) return parseInt(minutes[1], 10);
  const hours = t.match(/(\d+)\s*(h|hr|hrs|hours?)/);
  if (hours) return parseInt(hours[1], 10) * 60;
  return null;
}

export default function PlaceBidScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [goodsAmount, setGoodsAmount] = useState('');
  const [serviceFee, setServiceFee] = useState('');
  const [timeText, setTimeText] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    requestService.getById(id!).then(({ data }) => setRequest(data.data)).catch(() => {});
  }, [id]);

  const goods = parseFloat(goodsAmount) || 0;
  const service = parseFloat(serviceFee) || 0;
  const total = goods + service;

  const handleSubmit = async () => {
    // Backend rule: service_fee must be at least ₦500 (goods is separate)
    if (service < 500) {
      Alert.alert('Service fee', 'Your service fee must be at least ₦500.');
      return;
    }
    setSubmitting(true);
    try {
      const minutes = parseMinutes(timeText);
      const deliveryAt = minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : undefined;
      await bidService.submit(id!, {
        goods_amount: goods,
        service_fee: service,
        delivery_at: deliveryAt,
        note: message.trim() || undefined,
      });
      Alert.alert('Bid submitted', 'The requester has been notified. Track it under My errands.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/bids') },
      ]);
    } catch (err: any) {
      Alert.alert('Could not place bid', err.response?.data?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Topbar */}
          <View style={styles.topbar}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Place your bid</Text>
          </View>

          {/* Request summary */}
          {request && (
            <View style={styles.card}>
              <Text style={styles.requestTitle}>{request.title}</Text>
              <Text style={styles.requestDesc}>
                {stripHtml(request.description)}
                {request.budget_hint ? ` Budget ₦${request.budget_hint.toLocaleString()}.` : ''}
              </Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>Goods amount (₦)</Text>
          <TextInput
            style={styles.field}
            value={goodsAmount}
            onChangeText={setGoodsAmount}
            keyboardType="numeric"
            placeholder="₦ 3,000 — cost of items, if any"
            placeholderTextColor={colors.neutral[300]}
          />

          <Text style={styles.fieldLabel}>Service fee (₦)</Text>
          <TextInput
            style={styles.field}
            value={serviceFee}
            onChangeText={setServiceFee}
            keyboardType="numeric"
            placeholder="₦ 2,000 — your charge for the errand"
            placeholderTextColor={colors.neutral[300]}
          />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total bid</Text>
            <Text style={styles.totalValue}>₦{total.toLocaleString()}</Text>
          </View>

          <Text style={styles.fieldLabel}>Estimated time to complete</Text>
          <TextInput
            style={styles.field}
            value={timeText}
            onChangeText={setTimeText}
            placeholder="45 minutes"
            placeholderTextColor={colors.neutral[300]}
          />

          <Text style={styles.fieldLabel}>Message to requester</Text>
          <TextInput
            style={[styles.field, styles.textarea]}
            value={message}
            onChangeText={(t) => setMessage(t.slice(0, 500))}
            maxLength={500}
            multiline
            placeholder="I'm 12 mins from Shoprite, can start now."
            placeholderTextColor={colors.neutral[300]}
          />
        </ScrollView>

        {/* Sticky CTA */}
        <View style={styles.stickyCta}>
          <TouchableOpacity style={styles.submitBtn} activeOpacity={0.85} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.submitBtnText}>{submitting ? 'Submitting…' : 'Submit bid'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.neutral[50] },
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 26 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  backBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.neutral[100], alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.secondary[500], marginTop: -2 },
  title: { fontSize: 17, fontWeight: '700', color: colors.secondary[500], letterSpacing: -0.1 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[100], borderRadius: 18, padding: 16, marginBottom: 14 },
  requestTitle: { fontSize: 14, fontWeight: '700', color: colors.secondary[500] },
  requestDesc: { fontSize: 12, color: colors.neutral[500], marginTop: 6, lineHeight: 17 },
  fieldLabel: { fontSize: 11.5, color: colors.neutral[500], fontWeight: '600', marginBottom: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#E6F9F0', borderRadius: 13, padding: 13, marginBottom: 13 },
  totalLabel: { fontSize: 13, fontWeight: '600', color: '#00633F' },
  totalValue: { fontSize: 13, fontWeight: '700', color: '#00633F' },
  field: { backgroundColor: colors.neutral[100], borderWidth: 1, borderColor: colors.neutral[100], borderRadius: 13, padding: 13, fontSize: 13.5, color: colors.secondary[500], marginBottom: 13 },
  textarea: { minHeight: 60, textAlignVertical: 'top' },
  stickyCta: { padding: 20, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.neutral[100] },
  submitBtn: { backgroundColor: colors.primary[500], borderRadius: 15, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
});
