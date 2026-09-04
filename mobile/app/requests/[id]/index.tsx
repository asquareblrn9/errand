import { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, ActivityIndicator, Platform, TextInput,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, theme } from "../../../src/theme";
import { requestService } from "../../../src/services/requestService";
import { bidService } from "../../../src/services/bidService";
import { deliveryService, type DeliveryData } from "../../../src/services/deliveryService";
import { StatusPill } from "../../../src/components/ui/StatusPill";
import api from "../../../src/services/api";
import { useAuthStore } from "../../../src/store/authStore";
import type { RequestDetail, BidItem } from "../../../src/types/request";

const SORTS = [
  { key: 'best', label: 'Best rated' },
  { key: 'price', label: 'Lowest price' },
  { key: 'fast', label: 'Fastest' },
] as const;

const VERIFY_POLL_ATTEMPTS = 10; // ~40s of polling at 4s intervals

export default function RequestDetailScreen() {
  const { id, payment_ref } = useLocalSearchParams<{ id: string; payment_ref?: string }>();
  const user = useAuthStore((s) => s.user);
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'best' | 'price' | 'fast'>('best');
  const [showPaySheet, setShowPaySheet] = useState(false);
  const [payBid, setPayBid] = useState<BidItem | null>(null);
  const [payMethod, setPayMethod] = useState<"wallet" | "card">("wallet");
  const [cardProvider, setCardProvider] = useState("flutterwave");
  const [payLoading, setPayLoading] = useState(false);
  const [startingBid, setStartingBid] = useState<string | null>(null);

  // Delivery state for the active bid (extensions, cancel, dispute)
  const [delivery, setDelivery] = useState<DeliveryData | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [cardProviders, setCardProviders] = useState<{ slug: string; name: string }[]>([]);

  const [showExtension, setShowExtension] = useState(false);
  const [extMinutes, setExtMinutes] = useState('');
  const [extReason, setExtReason] = useState('');
  const [extSaving, setExtSaving] = useState(false);

  const fetch = async () => {
    try { const { data } = await requestService.getById(id!); setRequest(data.data); }
    catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [id]);

  // Fetch delivery + wallet info for the active bid
  useEffect(() => {
    const activeBid = request?.bids?.find(
      (b) => ["accepted", "payment_made", "in_progress", "completed"].includes(b.status),
    );
    if (!activeBid) { setDelivery(null); return; }
    deliveryService.get(activeBid.id)
      .then(({ data }) => setDelivery(data.data))
      .catch(() => setDelivery(null));
    api.get("/wallet").then(({ data }) => setWalletBalance(data.data?.available_balance ?? null)).catch(() => {});
    api.get("/payments/providers").then(({ data }) => {
      // Backend returns an array of provider slug strings, e.g. ["paystack","flutterwave"]
      const raw = data.data?.providers ?? [];
      if (Array.isArray(raw) && raw.length > 0) {
        const normalized = raw.map((slug: string) => ({
          slug,
          name: slug.charAt(0).toUpperCase() + slug.slice(1),
        }));
        setCardProviders(normalized);
        const def = data.data?.default ?? normalized[0].slug;
        setCardProvider(def);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.bids]);

  const isOwner = user?.id === request?.requester?.id;
  const isErrander = user?.role === "errander";

  const disputeWindowOpen =
    !!delivery?.dispute_window_closes_at &&
    new Date(delivery.dispute_window_closes_at).getTime() > Date.now();

  const submitExtension = async () => {
    if (!delivery) return;
    const minutes = parseInt(extMinutes, 10);
    if (!minutes || minutes < 5) { Alert.alert('Time needed', 'Enter at least 5 extra minutes (max 1440).'); return; }
    if (minutes > 1440) { Alert.alert('Too long', 'Extensions are capped at 24 hours (1440 minutes).'); return; }
    if (!extReason.trim()) { Alert.alert('Reason required', 'Tell the requester why you need more time.'); return; }
    setExtSaving(true);
    try {
      await deliveryService.requestExtension(delivery.bid_id, minutes, extReason.trim());
      setShowExtension(false); setExtMinutes(''); setExtReason('');
      Alert.alert('Request sent', 'The requester will approve or reject your time extension.');
      const { data } = await deliveryService.get(delivery.bid_id);
      setDelivery(data.data);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not request more time.');
    } finally { setExtSaving(false); }
  };

  const decideExtension = async (extensionId: string, approved: boolean) => {
    try {
      await deliveryService.decideExtension(extensionId, approved);
      const { data } = await deliveryService.get(delivery!.bid_id);
      setDelivery(data.data);
      Alert.alert(approved ? 'Approved' : 'Rejected', approved ? 'The errander got more time.' : 'The extension was rejected.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not update extension.');
    }
  };

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const cancelErrand = async () => {
    if (!delivery) return;
    setExtSaving(true);
    try {
      await deliveryService.cancelDelivery(delivery.bid_id, cancelReason.trim() || 'Errand delayed beyond acceptable threshold');
      setShowCancel(false); setCancelReason('');
      fetch();
      setDelivery(null);
      Alert.alert('Cancelled', 'The errand was cancelled and a refund was initiated.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not cancel errand.');
    } finally { setExtSaving(false); }
  };

  // ── Accept Bid → Show Payment ──────────────────────────

  const handleAcceptBid = async (bidId: string) => {
    try {
      await bidService.accept(bidId);
      const bid = request?.bids?.find((b) => b.id === bidId);
      if (bid) { setPayBid(bid); setShowPaySheet(true); }
      fetch();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to accept bid");
    }
  };

  // ── Pay ─────────────────────────────────────────────────

  // Payment verification state (shared by AppState resume + deep-link entry)
  const verifyingRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateSubRef = useRef<{ remove: () => void } | null>(null);

  const clearPaymentListeners = () => {
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    if (appStateSubRef.current) { appStateSubRef.current.remove(); appStateSubRef.current = null; }
  };

  // Clean up listeners/timers on unmount
  useEffect(() => () => clearPaymentListeners(), []);

  const runPaymentVerify = async (ref: string, attemptsLeft: number) => {
    try {
      const check = await api.get(`/payments/verify/${ref}`);
      const result = check.data?.data;
      const status = result?.status;

      if (status === "successful") {
        Alert.alert("Payment Confirmed", "The errander can now start.");
        setPayBid(null); fetch();
      } else if (status === "failed") {
        Alert.alert("Payment Failed", result?.failure_reason || "The payment was not successful. Please try again.");
        setShowPaySheet(false);
      } else if (status === "cancelled") {
        Alert.alert("Payment Cancelled", "You can pay again when you're ready.");
        setShowPaySheet(false);
      } else if (attemptsLeft <= 1) {
        // Still pending after the poll window — let the webhook finish it
        Alert.alert("Payment Still Pending", "We're still confirming with the provider. You'll be notified automatically.", [
          { text: "Check again", onPress: () => runPaymentVerify(ref, VERIFY_POLL_ATTEMPTS) },
          { text: "OK" },
        ]);
      } else {
        pollTimerRef.current = setTimeout(() => runPaymentVerify(ref, attemptsLeft - 1), 4000);
        return; // keep verifyingRef true while polling
      }
    } catch {
      // Provider/webhook may not have processed yet — retry within budget
      if (attemptsLeft > 1) {
        pollTimerRef.current = setTimeout(() => runPaymentVerify(ref, attemptsLeft - 1), 4000);
        return;
      }
      Alert.alert("Verification Pending", "We couldn't confirm the payment yet. Pull to refresh shortly.");
    }
    verifyingRef.current = false;
  };

  // Deep-link entry: errandboy://requests/{id}?payment_ref=EB-...
  useEffect(() => {
    if (!payment_ref || verifyingRef.current) return;
    verifyingRef.current = true;
    pollTimerRef.current = setTimeout(() => runPaymentVerify(payment_ref, VERIFY_POLL_ATTEMPTS), 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment_ref]);

  const handlePay = async () => {
    if (!payBid) return;
    setPayLoading(true);
    try {
      const { data } = await api.post("/payments/initiate", {
        bid_id: payBid.id,
        payment_method: payMethod,
        provider: payMethod === "card" ? cardProvider : undefined,
        platform: Platform.OS,
        return_scheme: "errandboy",
      });
      if (data.data?.status === "successful" || data.data?.payment_url === null) {
        Alert.alert("Payment Successful", "The errander can now start your errand.");
        setShowPaySheet(false); setPayBid(null);
        fetch();
      } else if (data.data?.payment_url) {
        // Open payment in device browser — verify on app resume
        const { Linking, AppState } = require("react-native");
        const ref = data.data.provider_ref;

        setShowPaySheet(false);
        await Linking.openURL(data.data.payment_url);

        // When the user returns to the app, poll until a terminal status
        const onAppActive = (state: string) => {
          if (state !== "active" || verifyingRef.current) return;
          verifyingRef.current = true;
          appStateSubRef.current?.remove();
          appStateSubRef.current = null;
          // Small delay to let the webhook process first
          pollTimerRef.current = setTimeout(() => runPaymentVerify(ref, VERIFY_POLL_ATTEMPTS), 1500);
        };
        const sub = AppState.addEventListener("change", onAppActive);
        appStateSubRef.current = sub;
      }
    } catch (err: any) {
      Alert.alert("Payment Failed", err.response?.data?.message || "Could not process payment");
    } finally { setPayLoading(false); }
  };

  // ── Start Errand ────────────────────────────────────────

  const handleStartErrand = async (bidId: string) => {
    setStartingBid(bidId);
    try {
      await api.post(`/deliveries/${bidId}/start`);
      Alert.alert("Started", "SLA timer is now active.");
      fetch();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to start");
    } finally { setStartingBid(null); }
  };

  const totalBid = (b: BidItem) => b.goods_amount + b.service_fee + b.platform_fee;

  // Hooks must run before any early return — compute sorted bids up front
  const sortedBids = useMemo(() => {
    const bids = [...(request?.bids ?? [])];
    switch (sort) {
      case 'price': return bids.sort((a, b) => totalBid(a) - totalBid(b));
      case 'fast': return bids.sort((a, b) => (a.delivery_at ?? '9999').localeCompare(b.delivery_at ?? '9999'));
      default: return bids.sort((a, b) => (b.errander?.rating ?? 0) - (a.errander?.rating ?? 0));
    }
  }, [request?.bids, sort]);

  if (loading || !request) return <View style={styles.container}><ActivityIndicator style={{ marginTop: 100 }} color={colors.primary[500]} /></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Topbar */}
        <View style={styles.topbar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{request.title}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {request.location}{request.budget_hint ? ` · Budget ₦${request.budget_hint.toLocaleString()}` : ''}
            </Text>
          </View>
        </View>

        {/* Sort chips */}
        <View style={styles.chipRow}>
          {SORTS.map((s) => (
            <TouchableOpacity key={s.key} style={[styles.chip, sort === s.key && styles.chipActive]} onPress={() => setSort(s.key)}>
              <Text style={[styles.chipText, sort === s.key && styles.chipActiveText]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bid cards */}
        {sortedBids.length === 0 && request.status === 'open' && (
          <View style={styles.footerCard}><Text style={styles.footerText}>No bids yet. Erranders nearby have been notified.</Text></View>
        )}

        {sortedBids.map((bid, index) => {
          const isPending = bid.status === "pending";
          const isAccepted = bid.status === "accepted";
          const isPaymentMade = bid.status === "payment_made";
          const isInProgress = bid.status === "in_progress";
          const initials = bid.errander?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'EB';
          const rating = bid.errander?.rating;
          const orders = bid.errander?.completed_orders ?? 0;
          const avatarBg = index % 2 === 0 ? 'rgba(255,107,0,0.14)' : 'rgba(0,168,107,0.14)';
          const avatarColor = index % 2 === 0 ? colors.accent[500] : colors.primary[500];

          return (
            <View key={bid.id} style={styles.bidCard}>
              <View style={styles.bidTop}>
                <View style={styles.bidPerson}>
                  <View style={[styles.avatar, { backgroundColor: avatarBg }]}><Text style={[styles.avatarText, { color: avatarColor }]}>{initials}</Text></View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.bidNameRow}>
                      <Text style={styles.bidName}>{bid.errander?.name ?? 'Errander'}</Text>
                      <Text style={styles.bidPrice}>₦{bid.service_fee.toLocaleString()}</Text>
                    </View>
                    <Text style={styles.bidStars}>
                      {'★'.repeat(rating != null ? Math.min(5, Math.round(Number(rating))) : 0)}
                      <Text style={styles.bidStarsMuted}>
                        {'★'.repeat(rating != null ? 5 - Math.min(5, Math.round(Number(rating))) : 5)}{' '}
                        {rating != null ? `${Number(rating).toFixed(1)} · ${orders} errands` : `${orders} errands`}
                      </Text>
                    </Text>
                  </View>
                </View>
                <View style={[styles.badge, { backgroundColor: isAccepted || isPaymentMade || isInProgress ? colors.success + "20" : bid.status === "rejected" ? colors.error + "20" : colors.warning + "20" }]}>
                  <Text style={[styles.badgeText, { color: isAccepted || isPaymentMade || isInProgress ? colors.success : bid.status === "rejected" ? colors.error : colors.warning }]}>{bid.status.replace(/_/g, " ")}</Text>
                </View>
              </View>

              {bid.note && <Text style={styles.bidNote}>"{bid.note}"</Text>}

              {isOwner && isPending && index === 0 && (
                <TouchableOpacity style={styles.primaryBtn} onPress={() => handleAcceptBid(bid.id)}>
                  <Text style={styles.primaryBtnText}>View & accept bid</Text>
                </TouchableOpacity>
              )}
              {isOwner && isPending && index > 0 && (
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => handleAcceptBid(bid.id)}>
                  <Text style={styles.secondaryBtnText}>View bid</Text>
                </TouchableOpacity>
              )}
              {isOwner && isAccepted && (
                <TouchableOpacity style={styles.primaryBtn} onPress={() => { setPayBid(bid); setShowPaySheet(true); }}>
                  <Text style={styles.primaryBtnText}>Pay now</Text>
                </TouchableOpacity>
              )}
              {isErrander && isPaymentMade && (
                <TouchableOpacity style={styles.primaryBtn} onPress={() => handleStartErrand(bid.id)} disabled={startingBid === bid.id}>
                  <Text style={styles.primaryBtnText}>{startingBid === bid.id ? 'Starting…' : 'Start Errand'}</Text>
                </TouchableOpacity>
              )}
              {(isErrander || isOwner) && isInProgress && (
                <TouchableOpacity onPress={() => router.push(`/jobs/${bid.id}`)} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>{isErrander ? 'Delivery →' : 'Track →'}</Text>
                </TouchableOpacity>
              )}
              {isOwner && bid.status === 'completed' && (
                <TouchableOpacity onPress={() => router.push(`/jobs/${bid.id}`)} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Review errand →</Text>
                </TouchableOpacity>
              )}

              {/* ── Delivery-driven actions (active bid, web parity) ── */}
              {delivery && delivery.bid_id === bid.id && (
                <>
                  {isErrander && !delivery.confirmed && request.status === 'in_progress' && (
                    <TouchableOpacity onPress={() => setShowExtension(true)} style={styles.secondaryBtn}>
                      <Text style={styles.secondaryBtnText}>Request more time →</Text>
                    </TouchableOpacity>
                  )}

                  {isOwner && delivery.pending_extension && (
                    <View style={styles.extensionCard}>
                      <Text style={styles.extensionTitle}>
                        Extension request: +{delivery.pending_extension.additional_minutes} min
                      </Text>
                      <Text style={styles.extensionReason}>{delivery.pending_extension.reason}</Text>
                      <View style={styles.extensionActions}>
                        <TouchableOpacity style={styles.approveBtn} onPress={() => decideExtension(delivery.pending_extension!.id, true)}>
                          <Text style={styles.approveText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.rejectBtn} onPress={() => decideExtension(delivery.pending_extension!.id, false)}>
                          <Text style={styles.rejectText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {isOwner && delivery.late_threshold_exceeded && (
                    <TouchableOpacity style={styles.dangerBtn} onPress={() => setShowCancel(true)}>
                      <Text style={styles.dangerBtnText}>Cancel Errand</Text>
                    </TouchableOpacity>
                  )}

                  {isOwner && delivery.confirmed && disputeWindowOpen && (
                    <TouchableOpacity
                      style={styles.dangerBtn}
                      onPress={() => router.push(`/disputes/new?delivery_id=${delivery.id}&bid_id=${delivery.bid_id}&request_id=${request.id}`)}
                    >
                      <Text style={styles.dangerBtnText}>Raise Dispute</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          );
        })}

        {request.status === 'open' && sortedBids.length > 0 && (
          <View style={styles.footerCard}><Text style={styles.footerText}>More bids may come in — we'll notify you</Text></View>
        )}
      </ScrollView>

      {/* FAB — Bid (errander) */}
      {isErrander && request.status === "open" && (
        <TouchableOpacity style={styles.fab} onPress={() => router.push(`/bid/${id}`)}>
          <Text style={styles.fabText}>+ Place Bid</Text>
        </TouchableOpacity>
      )}

      {/* ── Confirm & Pay Sheet ─────────────────────────── */}
      <Modal visible={showPaySheet} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm & pay</Text>

            {payBid?.errander && (
              <View style={styles.payPerson}>
                <View style={[styles.avatar, { backgroundColor: 'rgba(255,107,0,0.14)' }]}>
                  <Text style={[styles.avatarText, { color: colors.accent[500] }]}>
                    {payBid.errander.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'EB'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.payName}>{payBid.errander.name}</Text>
                  <Text style={styles.payStars}>
                    {'★'.repeat(payBid.errander.rating != null ? Math.min(5, Math.round(Number(payBid.errander.rating))) : 0)}
                    <Text style={styles.bidStarsMuted}>
                      {'★'.repeat(payBid.errander.rating != null ? 5 - Math.min(5, Math.round(Number(payBid.errander.rating))) : 5)}{' '}
                      {payBid.errander.rating != null ? `${Number(payBid.errander.rating).toFixed(1)} · ${payBid.errander.completed_orders ?? 0} errands` : `${payBid.errander.completed_orders ?? 0} errands`}
                    </Text>
                  </Text>
                </View>
              </View>
            )}

            {/* Breakdown */}
            {payBid && (
              <View style={styles.breakdown}>
                <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Errand fee</Text><Text style={styles.breakdownValue}>₦{payBid.service_fee.toLocaleString()}</Text></View>
                {payBid.goods_amount > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Goods amount</Text><Text style={styles.breakdownValue}>₦{payBid.goods_amount.toLocaleString()}</Text></View>}
                <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Platform fee</Text><Text style={styles.breakdownValue}>₦{payBid.platform_fee.toLocaleString()}</Text></View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownRow}><Text style={styles.breakdownTotalLabel}>Total</Text><Text style={styles.breakdownTotalValue}>₦{totalBid(payBid).toLocaleString()}</Text></View>
              </View>
            )}

            <View style={styles.escrowNote}>
              <Text style={styles.escrowLock}>🔒</Text>
              <Text style={styles.escrowText}>
                Your {payBid ? `₦${totalBid(payBid).toLocaleString()}` : 'payment'} is held in escrow. {payBid?.errander?.name?.split(' ')[0] ?? 'The errander'} is only paid after you confirm the errand with your code.
              </Text>
            </View>

            <View style={styles.payToggle}>
              <TouchableOpacity style={[styles.payToggleBtn, payMethod === "wallet" && styles.payToggleActive]} onPress={() => setPayMethod("wallet")}>
                <Text style={[styles.payToggleText, payMethod === "wallet" && styles.payToggleActiveText]}>💳 Wallet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.payToggleBtn, payMethod === "card" && styles.payToggleActive]} onPress={() => setPayMethod("card")}>
                <Text style={[styles.payToggleText, payMethod === "card" && styles.payToggleActiveText]}>🏦 Card</Text>
              </TouchableOpacity>
            </View>

            {/* Wallet shortfall (web parity) */}
            {payMethod === "wallet" && walletBalance != null && payBid && walletBalance < totalBid(payBid) && (
              <View style={styles.shortfallNote}>
                <Text style={styles.shortfallText}>
                  Insufficient balance — you have ₦{walletBalance.toLocaleString()}, needed ₦{totalBid(payBid).toLocaleString()}.
                </Text>
                <TouchableOpacity onPress={() => { setShowPaySheet(false); router.push('/(tabs)/wallet'); }}>
                  <Text style={styles.shortfallLink}>Fund wallet →</Text>
                </TouchableOpacity>
              </View>
            )}

            {payMethod === "card" && (
              <View style={styles.payToggle}>
                {(cardProviders.length > 0 ? cardProviders : [{ slug: 'flutterwave', name: 'Flutterwave' }, { slug: 'paystack', name: 'Paystack' }]).map((p) => (
                  <TouchableOpacity key={p.slug} style={[styles.payToggleBtn, cardProvider === p.slug && styles.payToggleActive]} onPress={() => setCardProvider(p.slug)}>
                    <Text style={[styles.payToggleText, cardProvider === p.slug && styles.payToggleActiveText]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.primaryBtn} onPress={handlePay} disabled={payLoading}>
              <Text style={styles.primaryBtnText}>{payLoading ? 'Processing…' : 'Pay & accept bid'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setShowPaySheet(false); setPayBid(null); }}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Extension Modal (errander) ─────────────────────── */}
      <Modal visible={showExtension} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request more time</Text>
            <Text style={styles.extensionHint}>How much extra time do you need?</Text>
            <TextInput
              style={styles.extensionInput}
              value={extMinutes}
              onChangeText={(t) => setExtMinutes(t.replace(/\D/g, '').slice(0, 3))}
              keyboardType="number-pad"
              placeholder="30 (minutes)"
              placeholderTextColor={colors.neutral[300]}
            />
            <TextInput
              style={styles.extensionInput}
              value={extReason}
              onChangeText={setExtReason}
              placeholder="Reason (e.g. traffic at the market)"
              placeholderTextColor={colors.neutral[300]}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={submitExtension} disabled={extSaving}>
              <Text style={styles.primaryBtnText}>{extSaving ? 'Sending…' : 'Send request'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setShowExtension(false); setExtMinutes(''); setExtReason(''); }}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Cancel Modal (owner) ───────────────────────────── */}
      <Modal visible={showCancel} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel errand</Text>
            <Text style={styles.extensionHint}>This errand is significantly delayed. Cancelling will initiate a refund.</Text>
            <TextInput
              style={styles.extensionInput}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.neutral[300]}
            />
            <TouchableOpacity style={styles.dangerBtn} onPress={cancelErrand} disabled={extSaving}>
              <Text style={styles.dangerBtnText}>{extSaving ? 'Cancelling…' : 'Cancel Errand'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setShowCancel(false); setCancelReason(''); }}>
              <Text style={styles.secondaryBtnText}>Keep errand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 120 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  backBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.neutral[100], alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.secondary[500], marginTop: -2 },
  title: { fontSize: 17, fontWeight: '700', color: colors.secondary[500], letterSpacing: -0.1 },
  sub: { color: colors.neutral[500], fontSize: 12, marginTop: 3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 100, backgroundColor: colors.neutral[100], borderWidth: 1, borderColor: colors.neutral[100] },
  chipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.secondary[500] },
  chipActiveText: { color: colors.white },
  bidCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[100], borderRadius: 18, padding: 16, marginBottom: 10, gap: 10 },
  bidTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  bidPerson: { flexDirection: 'row', gap: 11, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700' },
  bidNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bidName: { fontSize: 13.5, fontWeight: '700', color: colors.secondary[500] },
  bidPrice: { fontSize: 14.5, fontWeight: '600', color: colors.secondary[500] },
  bidStars: { color: colors.accent[500], fontSize: 11, letterSpacing: 1, marginTop: 2 },
  bidStarsMuted: { color: colors.neutral[500], letterSpacing: 0 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  bidNote: { fontSize: 12, color: colors.neutral[500], fontStyle: 'italic', lineHeight: 17 },
  primaryBtn: { backgroundColor: colors.primary[500], borderRadius: 15, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '700' },
  secondaryBtn: { borderRadius: 13, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.neutral[200] },
  secondaryBtnText: { color: colors.secondary[500], fontSize: 13, fontWeight: '600' },
  footerCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[100], borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 10 },
  footerText: { color: colors.neutral[500], fontSize: 12 },
  fab: { position: "absolute", bottom: 24, right: 24, backgroundColor: colors.primary[500], paddingHorizontal: 24, paddingVertical: 16, borderRadius: 30, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  fabText: { color: colors.white, fontWeight: "bold", fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%", gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.secondary[500], marginBottom: 4, letterSpacing: -0.1 },
  payPerson: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 4 },
  payName: { fontSize: 14, fontWeight: '700', color: colors.secondary[500] },
  payStars: { color: colors.accent[500], fontSize: 11, letterSpacing: 1, marginTop: 2 },
  breakdown: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[100], borderRadius: 18, padding: 16 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  breakdownLabel: { fontSize: 12.5, color: colors.neutral[500] },
  breakdownValue: { fontSize: 12.5, fontWeight: '600', color: colors.secondary[500] },
  breakdownDivider: { height: 1, backgroundColor: colors.neutral[100], marginVertical: 8 },
  breakdownTotalLabel: { fontSize: 14.5, fontWeight: '700', color: colors.secondary[500] },
  breakdownTotalValue: { fontSize: 14.5, fontWeight: '700', color: colors.secondary[500] },
  escrowNote: { flexDirection: 'row', gap: 9, backgroundColor: 'rgba(0,168,107,0.09)', borderWidth: 1, borderColor: 'rgba(0,168,107,0.28)', borderRadius: 15, padding: 13 },
  escrowLock: { fontSize: 13 },
  escrowText: { flex: 1, fontSize: 11.5, color: colors.secondary[500], lineHeight: 16 },
  payToggle: { flexDirection: "row", backgroundColor: colors.neutral[100], borderRadius: theme.radius.md, padding: 4, marginBottom: 4 },
  payToggleBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: theme.radius.md - 4 },
  payToggleActive: { backgroundColor: colors.white, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  payToggleText: { fontSize: 15, color: colors.neutral[400], fontWeight: "500" },
  payToggleActiveText: { color: colors.primary[500], fontWeight: "600" },
  shortfallNote: { backgroundColor: '#FFF1E6', borderWidth: 1, borderColor: 'rgba(178,78,0,0.3)', borderRadius: 13, padding: 12, marginBottom: 4 },
  shortfallText: { fontSize: 12, color: '#B24E00', lineHeight: 17 },
  shortfallLink: { fontSize: 12.5, fontWeight: '700', color: '#B24E00', marginTop: 6 },
  extensionCard: { backgroundColor: '#E8F0FF', borderWidth: 1, borderColor: 'rgba(29,79,184,0.25)', borderRadius: 13, padding: 12, gap: 4 },
  extensionTitle: { fontSize: 13, fontWeight: '700', color: '#1D4FB8' },
  extensionReason: { fontSize: 12, color: colors.secondary[500] },
  extensionActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  approveBtn: { backgroundColor: colors.primary[500], borderRadius: 11, paddingVertical: 8, paddingHorizontal: 18 },
  approveText: { color: colors.white, fontSize: 12.5, fontWeight: '700' },
  rejectBtn: { borderWidth: 1, borderColor: colors.error, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 18 },
  rejectText: { color: colors.error, fontSize: 12.5, fontWeight: '700' },
  dangerBtn: { backgroundColor: '#FFE3E9', borderWidth: 1, borderColor: 'rgba(255,23,68,0.3)', borderRadius: 13, paddingVertical: 12, alignItems: 'center' },
  dangerBtnText: { color: '#FF1744', fontSize: 13, fontWeight: '700' },
  extensionHint: { fontSize: 12.5, color: colors.neutral[500], marginBottom: 8 },
  extensionInput: { backgroundColor: colors.neutral[100], borderRadius: 13, padding: 13, fontSize: 13.5, color: colors.secondary[500], marginBottom: 10 },
});
