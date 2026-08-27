import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TextInput, Alert, RefreshControl } from 'react-native';
import { Button } from '../../src/components/ui/Button';
import { colors, theme } from '../../src/theme';
import { walletService, type WalletFundingGateway } from '../../src/services/walletService';
import { useAuthStore } from '../../src/store/authStore';
import type { WalletData, Transaction } from '../../src/types/wallet';

export default function WalletScreen() {
  const user = useAuthStore((s) => s.user);
  const isErrander = user?.role === 'errander';
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFund, setShowFund] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState('');
  const [gateway, setGateway] = useState<WalletFundingGateway>('paystack');
  const [withdrawForm, setWithdrawForm] = useState({ bank_code: '044', account_number: '', account_name: '' });
  const [refreshing, setRefreshing] = useState(false);
  const [funding, setFunding] = useState(false);

  // Active funding verification state (survives app background/foreground)
  const fundRef = useRef<{ reference: string; provider: WalletFundingGateway } | null>(null);
  const fundSubRef = useRef<{ remove: () => void } | null>(null);
  const fundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifyingFundRef = useRef(false);

  const fetch = async () => {
    try {
      const [wRes, tRes] = await Promise.all([walletService.get(), walletService.transactions()]);
      setWallet(wRes.data.data); setTransactions(tRes.data.data as unknown as Transaction[]);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { fetch(); }, []);

  // Clean up the AppState listener and pending timer on unmount
  useEffect(() => () => {
    fundSubRef.current?.remove();
    if (fundTimerRef.current) clearTimeout(fundTimerRef.current);
  }, []);

  const runFundVerify = async (attemptsLeft: number) => {
    const active = fundRef.current;
    if (!active) return;

    try {
      const { data } = await walletService.verifyPayment(active.reference, active.provider);
      const result = data.data;

      // success / already credited by the webhook
      if (result.already_verified || result.balance_after !== undefined) {
        Alert.alert('Wallet Funded', 'Your wallet has been credited.');
        fundRef.current = null;
        fetch();
      } else if (result.status === 'pending' && attemptsLeft > 1) {
        fundTimerRef.current = setTimeout(() => runFundVerify(attemptsLeft - 1), 4000);
        return;
      } else if (result.status === 'pending') {
        Alert.alert('Still Pending', "We'll credit your wallet automatically once the provider confirms.");
        fundRef.current = null;
      }
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (code === 'payment_cancelled') {
        Alert.alert('Payment Cancelled', 'Your wallet was not charged.');
        fundRef.current = null;
      } else if (code === 'payment_failed') {
        Alert.alert('Payment Failed', err.response?.data?.message ?? 'Could not verify payment.');
        fundRef.current = null;
      } else if (code === 'duplicate_reference') {
        Alert.alert('Wallet Funded', 'Your wallet has been credited.');
        fundRef.current = null;
        fetch();
      } else if (attemptsLeft > 1) {
        fundTimerRef.current = setTimeout(() => runFundVerify(attemptsLeft - 1), 4000);
        return;
      } else {
        Alert.alert('Verification Pending', "We couldn't confirm yet. Pull to refresh shortly.");
        fundRef.current = null;
      }
    } finally {
      verifyingFundRef.current = false;
    }
  };

  const handleFund = async () => {
    setFunding(true);
    try {
      const res = await walletService.fund({ amount: parseFloat(amount), payment_gateway: gateway });
      const result = res.data.data;

      setShowFund(false); setAmount('');
      fundRef.current = { reference: result.reference, provider: result.provider };

      const { Linking, AppState } = require('react-native');
      await Linking.openURL(result.authorization_url);

      // Verify when the user returns to the app
      const onAppActive = (state: string) => {
        if (state !== 'active' || verifyingFundRef.current || !fundRef.current) return;
        verifyingFundRef.current = true;
        fundSubRef.current?.remove();
        fundSubRef.current = null;
        // Small delay to let the webhook process first
        fundTimerRef.current = setTimeout(() => runFundVerify(10), 1500);
      };
      const sub = AppState.addEventListener('change', onAppActive);
      fundSubRef.current = sub;
    } catch (err: any) {
      Alert.alert('Funding failed', err.response?.data?.message ?? 'Could not fund wallet.');
    } finally {
      setFunding(false);
    }
  };
  const handleWithdraw = async () => {
    try {
      await walletService.withdraw({ ...withdrawForm, amount: parseFloat(amount) });
      setShowWithdraw(false); setAmount(''); fetch();
    } catch (err: any) {
      Alert.alert('Withdrawal failed', err.response?.data?.message ?? 'Could not process withdrawal.');
    }
  };

  const typeColor = (t: string) => t === 'deposit' || t === 'payout' ? colors.success : t === 'withdrawal' ? colors.error : colors.neutral[500];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={colors.primary[500]} />}>
      <Text style={styles.title}>{isErrander ? 'Earnings' : 'Wallet'}</Text>

      {/* Balance Cards */}
      <View style={styles.balanceRow}>
        <View style={[styles.balanceCard, { backgroundColor: colors.primary[500] }]}>
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balanceValue}>₦{wallet?.balance.toLocaleString() ?? '0'}</Text>
        </View>
        <View style={[styles.balanceCard, { backgroundColor: colors.secondary[500] }]}>
          <Text style={styles.balanceLabel}>Available</Text>
          <Text style={styles.balanceValue}>₦{wallet?.available_balance.toLocaleString() ?? '0'}</Text>
        </View>
      </View>

      {/* Action Buttons — role-appropriate */}
      <View style={styles.actionRow}>
        {!isErrander && <Button title="Fund Wallet" onPress={() => setShowFund(true)} variant="primary" size="sm" />}
        {isErrander && <Button title="Withdraw" onPress={() => setShowWithdraw(true)} variant="primary" size="sm" />}
      </View>

      {/* Transactions */}
      <Text style={styles.sectionTitle}>Transactions</Text>
      {!loading && transactions.length === 0 && (
        <Text style={styles.emptyText}>No transactions yet.</Text>
      )}
      {transactions.map((tx) => (
        <View key={tx.id} style={styles.txRow}>
          <View>
            <Text style={styles.txType} numberOfLines={1}>{tx.description || tx.type}</Text>
            <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.txAmount, { color: typeColor(tx.type) }]}>
              {tx.type === 'withdrawal' ? '-' : '+'}₦{tx.amount.toLocaleString()}
            </Text>
            <Text style={styles.txBalance}>Bal: ₦{tx.balance_after.toLocaleString()}</Text>
          </View>
        </View>
      ))}

      {/* Fund Modal (requester) */}
      <Modal visible={showFund} animationType="slide" transparent>
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Fund Wallet</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Amount (₦)" placeholderTextColor={colors.neutral[300]} />
          <View style={styles.gatewayToggle}>
            <Button title="Paystack" variant={gateway === 'paystack' ? 'primary' : 'ghost'} onPress={() => setGateway('paystack')} />
            <Button title="Flutterwave" variant={gateway === 'flutterwave' ? 'primary' : 'ghost'} onPress={() => setGateway('flutterwave')} />
          </View>
          <View style={styles.modalButtons}><Button title="Cancel" variant="ghost" onPress={() => setShowFund(false)} /><Button title={funding ? 'Opening…' : 'Fund'} onPress={handleFund} disabled={funding} /></View>
        </View></View>
      </Modal>

      {/* Withdraw Modal (errander) */}
      <Modal visible={showWithdraw} animationType="slide" transparent>
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Withdraw</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Amount (₦)" placeholderTextColor={colors.neutral[300]} />
          <TextInput style={styles.input} value={withdrawForm.account_number} onChangeText={(t) => setWithdrawForm({ ...withdrawForm, account_number: t })} placeholder="Account Number" placeholderTextColor={colors.neutral[300]} />
          <TextInput style={styles.input} value={withdrawForm.account_name} onChangeText={(t) => setWithdrawForm({ ...withdrawForm, account_name: t })} placeholder="Account Name" placeholderTextColor={colors.neutral[300]} />
          <Text style={styles.feeNote}>Fee: 1.5% (capped at ₦200)</Text>
          <View style={styles.modalButtons}><Button title="Cancel" variant="ghost" onPress={() => setShowWithdraw(false)} /><Button title="Withdraw" onPress={handleWithdraw} /></View>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 56 },
  title: { fontSize: 17, fontWeight: 'bold', color: colors.secondary[500], marginBottom: 16, letterSpacing: -0.1 },
  balanceRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  balanceCard: { flex: 1, borderRadius: theme.radius.lg, padding: 20 },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 6 },
  balanceValue: { fontSize: 24, fontWeight: 'bold', color: colors.white },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.secondary[500], marginBottom: 12 },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.neutral[100] },
  txType: { fontSize: 14, color: colors.neutral[500], maxWidth: 200 },
  txDate: { fontSize: 12, color: colors.neutral[300], marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '600' },
  txBalance: { fontSize: 11, color: colors.neutral[300], marginTop: 2 },
  emptyText: { color: colors.neutral[400], fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.secondary[500], marginBottom: 16 },
  input: { backgroundColor: colors.neutral[50], borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, padding: 14, fontSize: 16, color: colors.secondary[500], marginBottom: 12 },
  feeNote: { fontSize: 12, color: colors.neutral[300], marginBottom: 12 },
  gatewayToggle: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modalButtons: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
});
