import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, RefreshControl } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { colors } from '../../src/theme';
import { deliveryService, type DeliveryData, type TimelineData, type TimelineUpdate } from '../../src/services/deliveryService';
import { chatService } from '../../src/services/chatService';
import { RequesterRatingCard } from '../../src/components/RequesterRatingCard';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

const ERRANDER_STOPS = ['Accepted', 'In progress', 'Submitted', 'Confirmed', 'Paid'];
const REQUESTER_STOPS = ['Posted', 'Paid', 'In progress', 'Confirm', 'Done'];

/** Map delivery/bid state to route progress (stop index + fill %). */
function routeState(delivery: DeliveryData | null, bidStatus: string, isErrander: boolean): { idx: number; fill: number } {
  if (isErrander) {
    if (!delivery) {
      return bidStatus === 'accepted' ? { idx: 0, fill: 10 } : { idx: 1, fill: 25 };
    }
    if (delivery.request.status === 'completed' || delivery.request.status === 'funds_released') return { idx: 4, fill: 100 };
    if (delivery.confirmed || delivery.completed_at) return { idx: 3, fill: 80 };
    if (delivery.request.status === 'delivered' || delivery.request.status === 'confirmed') return { idx: 2, fill: 60 };
    return { idx: 1, fill: 35 };
  }
  // Requester flow: Posted → Paid → In progress → Confirm → Done
  const s = delivery?.request.status ?? '';
  if (s === 'completed' || s === 'funds_released') return { idx: 4, fill: 100 };
  if (s === 'delivered' || s === 'confirmed' || s === 'escrow_hold' || s === 'dispute_window') return { idx: 3, fill: 85 };
  if (s === 'in_progress') return { idx: 2, fill: 60 };
  if (s === 'assigned' || s === 'escrow_hold') return { idx: 1, fill: 30 };
  return { idx: 0, fill: 12 };
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return 'your phone';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return phone;
  return `${digits.slice(0, 4)}•••${digits.slice(-3)}`;
}

export default function ActiveJobScreen() {
  const { bidId } = useLocalSearchParams<{ bidId: string }>();
  const user = useAuthStore((s) => s.user);
  const isErrander = user?.role === 'errander';

  const [delivery, setDelivery] = useState<DeliveryData | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [bid, setBid] = useState<{ id: string; status: string; request_title: string; total_amount: number } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [showOtpEntry, setShowOtpEntry] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [confirmClosesAt, setConfirmClosesAt] = useState<string | null>(null);
  const [windowOpen, setWindowOpen] = useState(false);
  const paidRef = useRef(false);

  const fetchAll = useCallback(async () => {
    try {
      const [dRes, tRes] = await Promise.all([
        deliveryService.get(bidId!),
        deliveryService.timeline(bidId!),
      ]);
      setDelivery(dRes.data.data);
      setTimeline(tRes.data.data);
      if (dRes.data.data.request.status === 'completed' || dRes.data.data.request.status === 'funds_released') {
        paidRef.current = true;
      }
      try {
        const { data } = await chatService.conversations();
        const convo = (data.data as any[]).find((c) => c.request_id === dRes.data.data.request.id);
        if (convo) setConversationId(convo.id);
      } catch { /* chat optional */ }
    } catch {
      try {
        const { data } = await api.get<{ data: any[] }>('/my/bids');
        const found = (data.data as any[]).find((b) => b.id === bidId);
        if (found) {
          setBid({
            id: found.id,
            status: found.status,
            request_title: found.request_title,
            total_amount: found.total_amount,
          });
        }
      } catch { /* ignore */ }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bidId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Track whether the rating window is open (ticking so the card
  // disappears as soon as the dispute window passes)
  const ratingClosesAt = delivery?.dispute_window_closes_at ?? confirmClosesAt;
  const ratingWindowOpen = windowOpen && !delivery?.requester_has_rated;

  useEffect(() => {
    if (!ratingClosesAt) return;
    const tick = () => {
      const open = new Date(ratingClosesAt).getTime() > Date.now();
      setWindowOpen(open);
      return open;
    };
    if (!tick()) return;
    const t = setInterval(() => {
      if (!tick()) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [ratingClosesAt]);

  // Poll for status changes while waiting, and while the rating window
  // is open so the card retires as soon as the requester rates
  useEffect(() => {
    if (!submitted && !justConfirmed && !ratingWindowOpen) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await deliveryService.get(bidId!);
        setDelivery(data.data);
        if (data.data.request.status === 'completed' || data.data.request.status === 'funds_released') {
          paidRef.current = true;
        }
      } catch { /* ignore */ }
    }, 15_000);
    return () => clearInterval(interval);
  }, [submitted, justConfirmed, bidId, ratingWindowOpen]);

  // Resend cooldown ticker
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn > 0]);

  const handleSubmitForCompletion = () => {
    if (!delivery) return;
    const requester = delivery.request.requester.name ?? 'the requester';
    Alert.alert(
      'Mark this errand done?',
      `A confirmation code will be sent to ${requester}. They enter it to release your ₦${delivery.bid.total_amount.toLocaleString()} — this protects both of you.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Send for confirmation',
          onPress: async () => {
            setBusy(true);
            try {
              await deliveryService.generateOtp(bidId!);
              setSubmitted(true);
              fetchAll();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message ?? 'Could not submit');
            } finally { setBusy(false); }
          },
        },
      ]
    );
  };

  const handleResendOtp = async () => {
    if (resendIn > 0 || !delivery) return;
    try {
      await api.post(`/deliveries/${bidId}/generate-otp`);
      setResendIn(42);
      Alert.alert('Code resent', `We sent a new code to ${maskPhone(user?.phone)}.`);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not resend code.');
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const { data } = await deliveryService.confirm(bidId!, confirmInput);
      setJustConfirmed(true);
      setConfirmClosesAt(data.data.dispute_window_closes_at);
      Alert.alert('Errand confirmed', `₦${delivery?.bid.total_amount.toLocaleString() ?? ''} will be released to ${erranderName}.`);
      fetchAll();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Invalid OTP');
    } finally { setBusy(false); }
  };

  if (loading) {
    return <View style={styles.container}><Text style={styles.loading}>Loading errand…</Text></View>;
  }

  const requesterName = delivery?.request.requester.name ?? 'Requester';
  const requesterFirst = requesterName.split(' ')[0];
  const requesterInitials = requesterName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'R';
  const erranderName = delivery?.errander?.name ?? 'Errander';
  const erranderInitials = erranderName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'EB';
  const escrowAmount = delivery ? delivery.bid.total_amount : (bid?.total_amount ?? 0);
  const route = routeState(delivery, delivery?.bid.status ?? bid?.status ?? 'accepted', isErrander);
  const stops = isErrander ? ERRANDER_STOPS : REQUESTER_STOPS;
  const latestUpdate = timeline?.updates?.[timeline.updates.length - 1]?.message ?? (isErrander ? 'In progress' : 'On the way');

  // ── Requester: rate & tip (persistent while the dispute window is open) ──
  const ratingStatuses = ['confirmed', 'escrow_hold', 'dispute_window'];
  const inRatingStatus = delivery ? ratingStatuses.includes(delivery.request.status) : justConfirmed;
  if (!isErrander && inRatingStatus && delivery?.confirmed !== false && ratingWindowOpen && ratingClosesAt) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.rateContent}>
          <View style={styles.successBadge}><Text style={styles.successCheck}>✓</Text></View>
          <Text style={styles.successTitle}>Errand completed</Text>
          <Text style={styles.successDesc}>₦{escrowAmount.toLocaleString()} released to {erranderName}.</Text>
          <RequesterRatingCard
            bidId={bidId!}
            erranderName={erranderName}
            closesAt={ratingClosesAt}
            tipped={delivery?.requester_tipped ?? false}
            onChanged={fetchAll}
          />
        </ScrollView>
      </View>
    );
  }

  // ── Errander: payout released ──
  if (isErrander && delivery && (delivery.request.status === 'completed' || delivery.request.status === 'funds_released')) {
    return (
      <View style={styles.container}>
        <View style={styles.centerBox}>
          <View style={styles.successBadge}><Text style={styles.successCheck}>✓</Text></View>
          <Text style={styles.successTitle}>Payment released</Text>
          <Text style={styles.successAmount}>+ ₦{escrowAmount.toLocaleString()}</Text>
          <Text style={styles.successDesc}>Funds have been credited to your wallet.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(tabs)/wallet')}>
            <Text style={styles.primaryBtnText}>View earnings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Errander: waiting for confirmation ──
  if (isErrander && submitted && delivery?.request.status === 'delivered' && !delivery.confirmed) {
    return (
      <View style={styles.container}>
        <View style={styles.centerBox}>
          <View style={styles.pulse} />
          <Text style={styles.waitTitle}>Waiting for {requesterFirst} to confirm</Text>
          <Text style={styles.waitDesc}>
            We've sent a confirmation code to {requesterName}. Your ₦{escrowAmount.toLocaleString()} releases automatically once they confirm.
          </Text>
          <View style={styles.pendingCard}>
            <View style={styles.pendingRow}>
              <Text style={styles.pendingLabel}>Pending payout</Text>
              <Text style={styles.pendingAmount}>₦{escrowAmount.toLocaleString()}</Text>
            </View>
          </View>
        </View>
        <View style={styles.stickyCta}>
          {conversationId ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push(`/chat/${conversationId}`)}>
              <Text style={styles.secondaryBtnText}>Message {requesterFirst}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.waitHint}>Check back shortly — payment releases automatically.</Text>
          )}
        </View>
      </View>
    );
  }

  // ── Requester: OTP entry (req-otp) ──
  if (!isErrander && showOtpEntry && delivery) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.otpContent}>
          <View style={styles.otpTopbar}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setShowOtpEntry(false)}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.otpTitle}>Confirm completion</Text>
          </View>
          <Text style={styles.otpDesc}>
            We sent a 6-digit code to <Text style={styles.otpDescStrong}>{maskPhone(user?.phone)}</Text>. Enter it once you're happy with the errand.
          </Text>
          <View style={styles.otpBoxes}>
            {[...Array(6)].map((_, i) => (
              <View key={i} style={[styles.otpBox, confirmInput[i] ? styles.otpBoxFilled : {}]}>
                <Text style={styles.otpBoxText}>{confirmInput[i] || '–'}</Text>
              </View>
            ))}
          </View>
          <View style={styles.numPad}>
            {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((n, i) => (
              <TouchableOpacity key={i} style={styles.numKey} onPress={() => {
                if (n === '⌫') setConfirmInput((p) => p.slice(0, -1));
                else if (n !== '' && confirmInput.length < 6) setConfirmInput((p) => p + n);
              }}>
                <Text style={styles.numKeyText}>{n === '' ? ' ' : n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {resendIn > 0 ? (
            <Text style={styles.otpResend}>Resend code in 0:{String(resendIn).padStart(2, '0')}</Text>
          ) : (
            <TouchableOpacity onPress={handleResendOtp}><Text style={styles.otpResendLink}>Resend code</Text></TouchableOpacity>
          )}
        </ScrollView>
        <View style={styles.stickyCta}>
          <TouchableOpacity style={[styles.primaryBtn, confirmInput.length !== 6 && { opacity: 0.5 }]} disabled={confirmInput.length !== 6} onPress={handleConfirm}>
            <Text style={styles.primaryBtnText}>{busy ? 'Confirming…' : `Confirm & release ₦${escrowAmount.toLocaleString()}`}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/disputes')}>
            <Text style={styles.secondaryBtnText}>Something's wrong — report an issue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor={colors.primary[500]} />}
      >
        {/* Route tracker */}
        <View style={styles.route}>
          <Text style={styles.routeTitle}>{delivery ? delivery.request.title : (bid?.request_title ?? 'Active errand')}</Text>
          <View style={styles.routeTrack}>
            <View style={[styles.routeFill, { width: `${route.fill}%` }]} />
            {stops.map((label, i) => (
              <View key={label} style={styles.rstop}>
                <View style={[styles.node, i < route.idx && styles.nodeDone, i === route.idx && styles.nodeNow]} />
                <Text style={[styles.nodeLabel, (i < route.idx || i === route.idx) && styles.nodeLabelActive]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Person card */}
        <View style={styles.cardRow}>
          <View style={styles.cardRowLeft}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{isErrander ? requesterInitials : erranderInitials}</Text></View>
            <View>
              <Text style={styles.personName}>{isErrander ? requesterName : erranderName}</Text>
              <Text style={styles.personSub}>{isErrander ? `Requester · ₦${escrowAmount.toLocaleString()} escrowed` : latestUpdate}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {conversationId && (
              <TouchableOpacity style={styles.roundBtn} onPress={() => router.push(`/chat/${conversationId}`)}>
                <Text style={styles.roundBtnIcon}>💬</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Map stub (progress view) */}
        {!isErrander && delivery?.request.status === 'in_progress' && (
          <View style={styles.mapStub}>
            <View style={styles.mapDash} />
            <View style={[styles.mapDot, { left: '10%', backgroundColor: colors.primary[500] }]} />
            <View style={[styles.mapDot, { right: '12%', backgroundColor: colors.accent[500] }]} />
          </View>
        )}

        {/* Progress checklist */}
        <Text style={styles.checklistLabel}>Progress checklist</Text>
        <View style={styles.checklistCard}>
          {timeline && timeline.updates.length > 0 ? (
            timeline.updates.map((u: TimelineUpdate, i: number) => {
              const isLast = i === timeline.updates.length - 1;
              return (
                <View key={u.id} style={styles.checkItem}>
                  <View style={styles.checkDone}><Text style={styles.checkMark}>✓</Text></View>
                  <Text style={styles.checkText}>{u.message}</Text>
                  {isLast && !delivery?.confirmed && <View style={styles.pulse} />}
                </View>
              );
            })
          ) : (
            <Text style={styles.checkText}>No updates yet. {isErrander ? 'Start the errand to begin.' : 'Updates will appear here.'}</Text>
          )}
        </View>

        {/* Requester: banner when errander marked complete */}
        {!isErrander && delivery && delivery.request.status === 'delivered' && (
          <View style={styles.banner}>
            <Text style={styles.bannerCheck}>✓</Text>
            <Text style={styles.bannerText}>{erranderName} marked this errand as complete. Enter the code you received to confirm and release payment.</Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      {delivery ? (
        isErrander ? (
          !delivery.confirmed && (
            <View style={styles.stickyCta}>
              {!submitted ? (
                <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmitForCompletion} disabled={busy}>
                  <Text style={styles.primaryBtnText}>{busy ? 'Submitting…' : 'Submit for completion'}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleSubmitForCompletion} disabled={busy}>
                  <Text style={styles.secondaryBtnText}>Resend confirmation</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        ) : (
          delivery.request.status === 'delivered' && !delivery.confirmed && (
            <View style={styles.stickyCta}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowOtpEntry(true)}>
                <Text style={styles.primaryBtnText}>Enter confirmation code</Text>
              </TouchableOpacity>
            </View>
          )
        )
      ) : (
        bid && (
          <View style={styles.stickyCta}>
            {isErrander && bid.status === 'payment_made' ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={() => api.post(`/deliveries/${bidId}/start`).then(fetchAll).catch(() => {})}>
                <Text style={styles.primaryBtnText}>Start Errand</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.waitHint}>Waiting for the requester to complete payment.</Text>
            )}
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { paddingBottom: 26 },
  loading: { color: colors.neutral[400], fontSize: 16, textAlign: 'center', marginTop: 60 },
  // Route tracker
  route: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.neutral[100], backgroundColor: colors.white },
  routeTitle: { fontSize: 15, fontWeight: '700', color: colors.secondary[500], marginBottom: 14 },
  routeTrack: { position: 'relative', flexDirection: 'row', justifyContent: 'space-between' },
  routeFill: { position: 'absolute', top: 5, left: 5, height: 1.5, backgroundColor: colors.primary[500] },
  rstop: { zIndex: 2, flexDirection: 'column', alignItems: 'center', width: 52 },
  node: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.neutral[100], borderWidth: 2, borderColor: colors.neutral[200] },
  nodeDone: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  nodeNow: { backgroundColor: colors.accent[500], borderColor: colors.accent[500] },
  nodeLabel: { fontSize: 9, color: colors.neutral[400], marginTop: 7, textAlign: 'center', fontWeight: '600' },
  nodeLabelActive: { color: colors.secondary[500] },
  // Person card
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[100], borderRadius: 18, padding: 16, marginHorizontal: 20, marginTop: 16 },
  cardRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,107,0,0.14)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.accent[500], fontSize: 14, fontWeight: '700' },
  personName: { fontSize: 13.5, fontWeight: '700', color: colors.secondary[500] },
  personSub: { fontSize: 11.5, color: colors.neutral[500], marginTop: 2 },
  roundBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.neutral[100], alignItems: 'center', justifyContent: 'center' },
  roundBtnIcon: { fontSize: 14 },
  // Map stub
  mapStub: { height: 130, borderRadius: 15, borderWidth: 1, borderColor: colors.neutral[100], marginHorizontal: 20, marginTop: 12, overflow: 'hidden', backgroundColor: 'rgba(255,107,0,0.05)' },
  mapDash: { position: 'absolute', top: '55%', left: 20, right: 20, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.accent[500] },
  mapDot: { position: 'absolute', top: '50%', width: 10, height: 10, borderRadius: 5 },
  // Checklist
  checklistLabel: { fontSize: 11.5, color: colors.neutral[500], fontWeight: '600', marginTop: 20, marginBottom: 6, paddingHorizontal: 20 },
  checklistCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[100], borderRadius: 18, padding: 16, marginHorizontal: 20 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkDone: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary[500], alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: colors.white, fontSize: 10, fontWeight: '800' },
  checkText: { fontSize: 12.5, color: colors.secondary[500], flex: 1 },
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent[500] },
  banner: { flexDirection: 'row', gap: 9, backgroundColor: 'rgba(0,168,107,0.09)', borderWidth: 1, borderColor: 'rgba(0,168,107,0.28)', borderRadius: 15, padding: 13, marginHorizontal: 20, marginTop: 12 },
  bannerCheck: { color: colors.primary[500], fontWeight: '800' },
  bannerText: { flex: 1, fontSize: 12, color: colors.secondary[500], lineHeight: 17 },
  // OTP entry
  otpContent: { paddingHorizontal: 20, paddingTop: 56, alignItems: 'center', paddingBottom: 24 },
  otpTopbar: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start', marginBottom: 24 },
  backBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.neutral[100], alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.secondary[500], marginTop: -2 },
  otpTitle: { fontSize: 17, fontWeight: '700', color: colors.secondary[500], letterSpacing: -0.1 },
  otpDesc: { fontSize: 12.5, color: colors.neutral[500], lineHeight: 20, textAlign: 'center', maxWidth: 300, marginBottom: 20 },
  otpDescStrong: { color: colors.secondary[500], fontWeight: '700' },
  otpBoxes: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: 6 },
  otpBox: { width: 42, height: 52, borderRadius: 12, backgroundColor: colors.neutral[100], borderWidth: 1, borderColor: colors.neutral[100], alignItems: 'center', justifyContent: 'center' },
  otpBoxFilled: { borderColor: colors.primary[500] },
  otpBoxText: { fontSize: 19, fontWeight: '600', color: colors.primary[500] },
  numPad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 20, marginBottom: 8 },
  numKey: { width: 44, height: 40, borderRadius: 10, backgroundColor: colors.neutral[100], alignItems: 'center', justifyContent: 'center' },
  numKeyText: { fontSize: 16, fontWeight: '600', color: colors.secondary[500] },
  otpResend: { fontSize: 11.5, color: colors.neutral[400], marginTop: 6 },
  otpResendLink: { fontSize: 11.5, color: colors.primary[500], fontWeight: '600', marginTop: 6 },
  // CTAs
  stickyCta: { padding: 16, paddingTop: 12, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.neutral[100] },
  primaryBtn: { backgroundColor: colors.primary[500], borderRadius: 15, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  secondaryBtn: { borderRadius: 13, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.neutral[200], marginTop: 8 },
  secondaryBtnText: { color: colors.secondary[500], fontSize: 13, fontWeight: '600' },
  // Success / waiting
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successBadge: { width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(0,168,107,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successCheck: { color: colors.primary[500], fontSize: 26, fontWeight: '800' },
  successTitle: { fontSize: 19, fontWeight: '700', color: colors.secondary[500], marginBottom: 6 },
  successAmount: { fontSize: 24, fontWeight: '700', color: colors.primary[500], marginBottom: 12 },
  successDesc: { fontSize: 12.5, color: colors.neutral[500], marginBottom: 20 },
  waitTitle: { fontSize: 17, fontWeight: '700', color: colors.secondary[500], marginBottom: 8, marginTop: 20 },
  waitDesc: { fontSize: 12.5, color: colors.neutral[500], maxWidth: 260, textAlign: 'center', marginBottom: 20 },
  pendingCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[100], borderRadius: 18, padding: 16, width: '100%', maxWidth: 340 },
  pendingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pendingLabel: { fontSize: 12.5, color: colors.neutral[500] },
  pendingAmount: { fontSize: 13, fontWeight: '700', color: colors.accent[500] },
  waitHint: { color: colors.neutral[400], fontSize: 12.5, textAlign: 'center' },
  rateContent: { paddingHorizontal: 20, paddingTop: 56, alignItems: 'center', paddingBottom: 24, gap: 16 },
});
