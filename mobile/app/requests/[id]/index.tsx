import { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, ActivityIndicator, Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, theme } from "../../../src/theme";
import { requestService } from "../../../src/services/requestService";
import { bidService } from "../../../src/services/bidService";
import api from "../../../src/services/api";
import { useAuthStore } from "../../../src/store/authStore";
import type { RequestDetail, BidItem } from "../../../src/types/request";

const SORTS = [
  { key: 'best', label: 'Best rated' },
  { key: 'price', label: 'Lowest price' },
  { key: 'fast', label: 'Fastest' },
] as const;

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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

  const fetch = async () => {
    try { const { data } = await requestService.getById(id!); setRequest(data.data); }
    catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [id]);

  const isOwner = user?.id === request?.requester?.id;
  const isErrander = user?.role === "errander";

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
        // Open payment in device browser — verify on app resume via AppState listener
        const { Linking, AppState } = require("react-native");
        const ref = data.data.provider_ref;

        setShowPaySheet(false);
        await Linking.openURL(data.data.payment_url);

        // When user returns to the app, auto-verify the payment
        const onAppActive = async (state: string) => {
          if (state !== "active") return;
          AppState.removeEventListener("change", onAppActive);
          // Small delay to let the webhook process
          await new Promise(r => setTimeout(r, 2000));
          try {
            const check = await api.get(`/payments/verify/${ref}`);
            if (check.data?.data?.status === "successful") {
              Alert.alert("Payment Confirmed", "The errander can now start.");
              setPayBid(null); fetch();
            } else if (check.data?.data?.status === "failed") {
              Alert.alert("Payment Failed", "The payment was not successful. Please try again.");
            }
          } catch { /* webhook may not have fired yet */ }
        };
        AppState.addEventListener("change", onAppActive);
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
                      ★★★★★ <Text style={styles.bidStarsMuted}>{rating != null ? `${Number(rating).toFixed(1)} · ${orders} errands` : `${orders} errands`}</Text>
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
                    ★★★★★ <Text style={styles.bidStarsMuted}>
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
                <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Service fee</Text><Text style={styles.breakdownValue}>₦{payBid.platform_fee.toLocaleString()}</Text></View>
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

            {payMethod === "card" && (
              <View style={styles.payToggle}>
                <TouchableOpacity style={[styles.payToggleBtn, cardProvider === "flutterwave" && styles.payToggleActive]} onPress={() => setCardProvider("flutterwave")}>
                  <Text style={[styles.payToggleText, cardProvider === "flutterwave" && styles.payToggleActiveText]}>Flutterwave</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.payToggleBtn, cardProvider === "paystack" && styles.payToggleActive]} onPress={() => setCardProvider("paystack")}>
                  <Text style={[styles.payToggleText, cardProvider === "paystack" && styles.payToggleActiveText]}>Paystack</Text>
                </TouchableOpacity>
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
});
