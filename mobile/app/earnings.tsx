import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { colors, theme } from '../src/theme';
import { erranderService } from '../src/services/erranderService';
import { walletService } from '../src/services/walletService';
import { formatNaira } from '../src/utils/format';
import { Card } from '../src/components/ui/Card';
import { StatTile } from '../src/components/ui/StatTile';
import { StatusPill } from '../src/components/ui/StatusPill';
import type { ErranderEarningsSummary } from '../src/types/errander';
import type { WalletData, Transaction } from '../src/types/wallet';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export default function EarningsScreen() {
  const [summary, setSummary] = useState<ErranderEarningsSummary | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = async () => {
    try {
      const [eRes, wRes, tRes] = await Promise.all([
        erranderService.earnings(),
        walletService.get(),
        walletService.transactions(),
      ]);
      setSummary(eRes.data.data);
      setWallet(wRes.data.data);
      setTransactions(tRes.data.data);
    } catch {} finally { setRefreshing(false); }
  };

  useEffect(() => { fetch(); }, []);

  // Mirror the web earnings page: payout | withdrawal | refund only
  const payoutRows = transactions.filter((tx) => ['payout', 'withdrawal', 'refund'].includes(tx.type));
  const distribution = summary?.rating_breakdown.distribution ?? [];
  const maxCount = Math.max(...distribution.map((d) => d.count), 1);
  const hasRatings = distribution.some((d) => d.count > 0);
  const bank = summary?.bank_account ?? null;

  const rowLabel = (tx: Transaction) =>
    tx.type === 'payout' ? 'Errand payout' : tx.type === 'refund' ? 'Withdrawal reversed' : 'Withdrawal';

  const rowPill = (tx: Transaction) => {
    if (tx.type === 'payout') return <StatusPill status="paid out" label="Paid out" />;
    if (tx.type === 'refund') return <StatusPill status="paid out" label="Reversed" />;
    if (tx.status === 'failed') return <StatusPill status="failed" label="Failed" />;
    return <StatusPill status="completed" label="Completed" />;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={colors.primary[500]} />}>
      <Text style={styles.title}>Earnings</Text>

      {/* Available balance — big green card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>₦{(wallet?.available_balance ?? 0).toLocaleString()}</Text>
      </View>

      {/* Stat tiles */}
      <View style={styles.tileRow}>
        <StatTile
          label="Lifetime earnings"
          value={formatNaira(summary?.lifetime_earnings.total)}
          delta={`${summary?.lifetime_earnings.jobs_count ?? 0} errands completed`}
          icon="▲"
          iconBg="#E8F0FF"
          iconColor="#1D4FB8"
          style={styles.tile}
        />
        <StatTile
          label="Pending escrow"
          value={formatNaira(wallet?.pending_earnings)}
          delta={(wallet?.pending_earnings ?? 0) > 0 ? 'Awaiting confirmation' : 'Nothing pending'}
          icon="⏱"
          iconBg="#FFF1E6"
          iconColor="#B24E00"
          style={styles.tile}
        />
      </View>

      {/* Rating breakdown */}
      <Card
        title="Rating breakdown"
        right={
          <View style={styles.avgRow}>
            <Text style={styles.avgStar}>★</Text>
            <Text style={styles.avgValue}>
              {summary && summary.rating_breakdown.average_rating != null
                ? summary.rating_breakdown.average_rating.toFixed(1)
                : '—'}
            </Text>
          </View>
        }
        style={styles.section}
      >
        {!hasRatings ? (
          <Text style={styles.noRatings}>No ratings yet — complete errands to earn your first.</Text>
        ) : (
          distribution.map((d) => (
            <View key={d.stars} style={styles.barRow}>
              <Text style={styles.barLabel}>{d.stars}★</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(d.count / maxCount) * 100}%`, backgroundColor: d.stars >= 4 ? colors.primary[500] : '#ADB5BD' },
                  ]}
                />
              </View>
              <Text style={styles.barCount}>{d.count}</Text>
            </View>
          ))
        )}
      </Card>

      {/* Payout bank */}
      <Card
        title="Payout method"
        right={
          <TouchableOpacity onPress={() => router.push('/profile/bank' as Href)}>
            <Text style={styles.link}>{bank ? 'Change' : 'Add'}</Text>
          </TouchableOpacity>
        }
        style={styles.section}
      >
        {bank ? (
          <View style={styles.bankRow}>
            <View style={styles.bankIcon}><Text style={styles.bankIconText}>💳</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bankName}>{bank.bank_name} •••• {bank.account_number.slice(-4)}</Text>
              <Text style={styles.bankSub}>{bank.account_name} · Payouts arrive within 24 hours</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.bankEmpty}>
            No verified bank account yet — complete KYC to add one.
          </Text>
        )}
      </Card>

      {/* Payout history */}
      <Card title="Payout history" style={styles.section}>
        {payoutRows.length === 0 ? (
          <Text style={styles.empty}>No payouts yet. Complete errands to start earning.</Text>
        ) : (
          payoutRows.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.txTop}>
                  <Text style={styles.txDate}>{shortDate(tx.created_at)}</Text>
                  <Text style={styles.txType}>{rowLabel(tx)}</Text>
                </View>
                {tx.description ? <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text> : null}
              </View>
              <View style={styles.txRight}>
                <Text style={[styles.txAmount, tx.type !== 'withdrawal' && styles.txAmountGreen]}>
                  {formatNaira(tx.amount, { sign: true })}
                </Text>
                {rowPill(tx)}
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.secondary[500], marginBottom: 20 },
  balanceCard: { backgroundColor: colors.primary[500], borderRadius: theme.radius.xl, padding: 28, alignItems: 'center', marginBottom: 22 },
  balanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  balanceAmount: { fontSize: 40, fontWeight: 'bold', color: colors.white },
  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  tile: { flex: 1, minWidth: 150 },
  section: { marginBottom: 16 },
  // Rating breakdown
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avgStar: { color: '#FF6B00', fontSize: 14 },
  avgValue: { fontFamily: theme.fontFamily.heading, fontWeight: '700', fontSize: 15, color: colors.secondary[500] },
  noRatings: { textAlign: 'center', color: '#ADB5BD', fontSize: 12.5, paddingVertical: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  barLabel: { width: 26, fontSize: 11.5, color: colors.neutral[400], fontWeight: '600' },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.neutral[100], overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barCount: { width: 32, textAlign: 'right', fontFamily: theme.fontFamily.mono, fontSize: 11.5, color: colors.neutral[400] },
  // Bank card
  link: { color: colors.primary[500], fontSize: 12.5, fontWeight: '700' },
  bankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bankIcon: { width: 44, height: 44, borderRadius: theme.radius.md, backgroundColor: colors.secondary[500], alignItems: 'center', justifyContent: 'center' },
  bankIconText: { fontSize: 18 },
  bankName: { fontFamily: theme.fontFamily.heading, fontSize: 13.5, fontWeight: '700', color: colors.secondary[500] },
  bankSub: { fontSize: 12, color: colors.neutral[400], marginTop: 2 },
  bankEmpty: { fontSize: 13, color: colors.neutral[400], lineHeight: 19 },
  // Payout history
  empty: { textAlign: 'center', color: colors.neutral[400], fontSize: 13, paddingVertical: 20 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.neutral[100] },
  txTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txDate: { fontSize: 11, color: colors.neutral[400] },
  txType: { fontSize: 12.5, fontWeight: '600', color: colors.secondary[500] },
  txDesc: { fontSize: 11, color: colors.neutral[400], marginTop: 2 },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: 12.5, fontFamily: theme.fontFamily.mono, fontWeight: '600', color: colors.secondary[500] },
  txAmountGreen: { color: '#008554' },
});
