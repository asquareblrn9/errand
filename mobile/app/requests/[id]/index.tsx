import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Button } from '../../../src/components/ui/Button';
import { colors, theme } from '../../../src/theme';
import { requestService } from '../../../src/services/requestService';
import { bidService } from '../../../src/services/bidService';
import { useAuthStore } from '../../../src/store/authStore';
import type { RequestDetail, BidItem } from '../../../src/types/request';

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidForm, setBidForm] = useState({ goods: '', service: '', note: '' });
  const [showBidForm, setShowBidForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetch = async () => {
    try { const { data } = await requestService.getById(id!); setRequest(data.data); }
    catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [id]);

  const isOwner = user?.id === request?.requester?.id;
  const isErrander = user?.role === 'errander';

  const handleAcceptBid = async (bidId: string) => {
    Alert.alert('Accept Bid', 'Are you sure? Other bids will be rejected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: async () => {
        await bidService.accept(bidId);
        fetch();
      }},
    ]);
  };

  const handleBid = async () => {
    setSubmitting(true);
    try {
      await bidService.submit(id!, { goods_amount: parseFloat(bidForm.goods), service_fee: parseFloat(bidForm.service), note: bidForm.note });
      setShowBidForm(false); setBidForm({ goods: '', service: '', note: '' });
      fetch();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  if (loading || !request) return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;

  const totalBid = (b: BidItem) => b.goods_amount + b.service_fee + b.platform_fee;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <Text style={styles.title}>{request.title}</Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{request.category?.name}</Text>
          <View style={[styles.badge, { backgroundColor: colors.primary[100] }]}><Text style={[styles.badgeText, { color: colors.primary[700] }]}>{request.status}</Text></View>
          {request.is_urgent && <View style={[styles.badge, { backgroundColor: colors.accent[500] + '20' }]}><Text style={[styles.badgeText, { color: colors.accent[500] }]}>URGENT</Text></View>}
        </View>

        <Text style={styles.description}>{request.description}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>📍 {request.location}</Text>
          <Text style={styles.infoText}>👤 {request.requester?.name}</Text>
          {request.budget_hint && <Text style={styles.infoText}>₦{request.budget_hint.toLocaleString()}</Text>}
        </View>

        {/* Bids Section */}
        <Text style={styles.sectionTitle}>Bids ({request.bids?.length ?? 0})</Text>
        {request.bids?.map((bid) => (
          <View key={bid.id} style={styles.bidCard}>
            <View style={styles.bidHeader}>
              <View>
                <Text style={styles.bidErrander}>{bid.errander?.name ?? 'Errander'}</Text>
                <Text style={styles.bidOrders}>{bid.errander?.completed_orders ?? 0} orders completed</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: bid.status === 'accepted' ? colors.success + '20' : colors.warning + '20' }]}>
                <Text style={[styles.badgeText, { color: bid.status === 'accepted' ? colors.success : colors.warning }]}>{bid.status}</Text>
              </View>
            </View>
            <View style={styles.bidAmounts}>
              <Text style={styles.bidAmountLabel}>Goods: ₦{bid.goods_amount.toLocaleString()}</Text>
              <Text style={styles.bidAmountLabel}>Service: ₦{bid.service_fee.toLocaleString()}</Text>
              <Text style={styles.bidAmountLabel}>Total: ₦{totalBid(bid).toLocaleString()}</Text>
            </View>
            {bid.note && <Text style={styles.bidNote}>"{bid.note}"</Text>}
            {isOwner && bid.status === 'pending' && (
              <Button title="Accept Bid" onPress={() => handleAcceptBid(bid.id)} size="sm" variant="primary" fullWidth />
            )}
          </View>
        ))}
      </ScrollView>

      {/* FAB — Bid (errander) */}
      {isErrander && request.status === 'open' && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowBidForm(true)}>
          <Text style={styles.fabText}>+ Place Bid</Text>
        </TouchableOpacity>
      )}

      {/* Bid Form Modal */}
      <Modal visible={showBidForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Place a Bid</Text>
            <Text style={styles.label}>Goods Amount (₦)</Text>
            <TextInput style={styles.input} value={bidForm.goods} onChangeText={(t) => setBidForm({ ...bidForm, goods: t })} keyboardType="numeric" placeholder="4500" placeholderTextColor={colors.neutral[300]} />
            <Text style={styles.label}>Service Fee (₦)</Text>
            <TextInput style={styles.input} value={bidForm.service} onChangeText={(t) => setBidForm({ ...bidForm, service: t })} keyboardType="numeric" placeholder="1500" placeholderTextColor={colors.neutral[300]} />
            <Text style={styles.label}>Note (optional)</Text>
            <TextInput style={styles.input} value={bidForm.note} onChangeText={(t) => setBidForm({ ...bidForm, note: t })} placeholder="I can deliver in 3 hours" placeholderTextColor={colors.neutral[300]} />
            <Text style={styles.feeNote}>Platform fee (5%) calculated automatically</Text>
            <View style={styles.modalButtons}>
              <Button title="Cancel" variant="ghost" onPress={() => setShowBidForm(false)} />
              <Button title="Submit Bid" onPress={handleBid} loading={submitting} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  loading: { textAlign: 'center', marginTop: 100, color: colors.neutral[400] },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 8 },
  meta: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  metaText: { fontSize: 14, color: colors.neutral[400] },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  description: { fontSize: 16, color: colors.neutral[500], lineHeight: 24, marginBottom: 12 },
  infoRow: { flexDirection: 'row', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  infoText: { fontSize: 13, color: colors.neutral[400] },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral[600], marginBottom: 12 },
  bidCard: { backgroundColor: colors.white, borderRadius: theme.radius.md, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.neutral[100] },
  bidHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  bidErrander: { fontSize: 16, fontWeight: '600', color: colors.neutral[600] },
  bidOrders: { fontSize: 12, color: colors.neutral[300] },
  bidAmounts: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  bidAmountLabel: { fontSize: 13, color: colors.neutral[500] },
  bidNote: { fontSize: 13, color: colors.neutral[300], fontStyle: 'italic', marginTop: 4 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: colors.primary[500], paddingHorizontal: 24, paddingVertical: 16, borderRadius: 30, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  fabText: { color: colors.white, fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: colors.neutral[600], marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: colors.neutral[50], borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, padding: 12, fontSize: 16, color: colors.neutral[600] },
  feeNote: { fontSize: 12, color: colors.neutral[300], marginTop: 8, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
});
