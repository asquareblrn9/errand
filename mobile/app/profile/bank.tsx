import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../src/components/ui/Button';
import { colors, theme } from '../../src/theme';
import { walletService } from '../../src/services/walletService';
import { kycService } from '../../src/services/kycService';
import type { WalletBankAccountStatus } from '../../src/types/wallet';

interface Bank { name: string; code: string; }

export default function BankScreen() {
  const [status, setStatus] = useState<WalletBankAccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Add/Change form ──────────────────────────────────────
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const resolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = async () => {
    try {
      const { data } = await walletService.getBankAccount();
      setStatus(data.data);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  const loadBanks = async () => {
    try {
      const { data } = await walletService.banks('flutterwave');
      setBanks(data.data ?? []);
    } catch { setBanks([]); }
  };

  useEffect(() => { fetchStatus(); loadBanks(); }, []);

  // Debounced account-name resolution
  useEffect(() => {
    if (!(accountNumber.length === 10 && selectedBank)) { setAccountName(''); return; }
    resolveTimer.current = setTimeout(async () => {
      setResolving(true);
      try {
        const { data } = await walletService.resolveAccount(accountNumber, selectedBank.code);
        setAccountName(data.data.account_name ?? '');
      } catch {
        setAccountName('');
        Alert.alert('Could not verify account', 'Check the account number and bank.');
      } finally { setResolving(false); }
    }, 600);
    return () => { if (resolveTimer.current) clearTimeout(resolveTimer.current); };
  }, [accountNumber, selectedBank]);

  const handleSave = async () => {
    if (!selectedBank || accountNumber.length !== 10 || !accountName) {
      Alert.alert('Incomplete', 'Select a bank, enter a 10-digit account number, and verify the account name.');
      return;
    }
    setSaving(true);
    try {
      await kycService.saveBankAccount({
        bank_name: selectedBank.name,
        bank_code: selectedBank.code,
        account_number: accountNumber,
        account_name: accountName,
      });
      setAccountNumber(''); setAccountName(''); setSelectedBank(null); setBankDropdownOpen(false);
      await fetchStatus();
      Alert.alert('Saved', 'Your payout bank account has been updated.');
    } catch (err: any) {
      const message = err.response?.data?.message ?? 'Could not save bank account.';
      Alert.alert(err.response?.data?.code === 'bank_change_locked' ? 'Bank change locked' : 'Error', message);
    } finally { setSaving(false); }
  };

  const bank = status?.bank_account;
  const locked = !!status?.change_locked;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStatus(); }} tintColor={colors.primary[500]} />}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backIcon}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Bank Account</Text>

      {/* Current account */}
      {loading ? (
        <ActivityIndicator color={colors.primary[500]} style={{ marginVertical: 24 }} />
      ) : bank ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{bank.bank_name} · {bank.account_number}</Text>
          <Text style={styles.cardMeta}>{bank.account_name} — payouts go to this account</Text>
          {locked && (
            <Text style={styles.lockNote}>You can change your bank again on {status?.next_change_at}</Text>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardMeta}>No verified bank account yet. Add one to receive payouts.</Text>
        </View>
      )}

      {/* Add / change form */}
      {!locked && (
        <>
          <Text style={styles.sectionTitle}>{bank ? 'Change Bank' : 'Add Bank'}</Text>

          {/* Bank dropdown */}
          <Text style={styles.label}>Bank</Text>
          <TouchableOpacity style={styles.input} onPress={() => setBankDropdownOpen(!bankDropdownOpen)} activeOpacity={0.8}>
            <Text style={selectedBank ? styles.inputText : styles.placeholder}>
              {selectedBank ? `${selectedBank.name} (${selectedBank.code})` : 'Select a bank'}
            </Text>
          </TouchableOpacity>
          {bankDropdownOpen && (
            <View style={styles.dropdown}>
              {banks.length === 0 ? (
                <Text style={styles.dropdownEmpty}>No banks available</Text>
              ) : (
                banks.map((b) => (
                  <TouchableOpacity key={b.code} style={styles.dropdownItem}
                    onPress={() => { setSelectedBank(b); setBankDropdownOpen(false); }}>
                    <Text style={styles.dropdownName}>{b.name}</Text>
                    <Text style={styles.dropdownCode}>{b.code}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          <Text style={styles.label}>Account Number</Text>
          <TextInput
            style={styles.input}
            value={accountNumber}
            onChangeText={(t) => setAccountNumber(t.replace(/\D/g, '').slice(0, 10))}
            keyboardType="numeric"
            maxLength={10}
            placeholder="0123456789"
            placeholderTextColor={colors.neutral[300]}
          />

          <Text style={styles.label}>Account Name</Text>
          <TextInput
            style={styles.input}
            value={accountName}
            editable={false}
            placeholder={resolving ? 'Verifying account...' : 'Auto-verified from account number'}
            placeholderTextColor={colors.neutral[300]}
          />

          <Button
            title={saving ? 'Saving...' : bank ? 'Change Bank Account' : 'Add Bank Account'}
            onPress={handleSave}
            loading={saving || resolving}
            fullWidth
            size="lg"
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 56 },
  backBtn: { marginBottom: 8 },
  backIcon: { fontSize: 28, color: colors.secondary[500] },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.secondary[500], marginBottom: 20 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[100], borderRadius: theme.radius.lg, padding: 16, marginBottom: 20 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.secondary[500] },
  cardMeta: { fontSize: 13, color: colors.neutral[500], marginTop: 4 },
  lockNote: { fontSize: 13, fontWeight: '600', color: '#B24E00', marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.secondary[500], marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '500', color: colors.neutral[600], marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, padding: 14, fontSize: 16, color: colors.secondary[500], justifyContent: 'center' },
  inputText: { fontSize: 16, color: colors.secondary[500] },
  placeholder: { fontSize: 16, color: colors.neutral[300] },
  dropdown: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, maxHeight: 240, marginTop: 4 },
  dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.neutral[100] },
  dropdownName: { fontSize: 15, color: colors.secondary[500] },
  dropdownCode: { fontSize: 13, color: colors.neutral[300] },
  dropdownEmpty: { padding: 14, fontSize: 14, color: colors.neutral[300] },
});
