import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Button } from '../../src/components/ui/Button';
import { colors, theme } from '../../src/theme';
import { deliveryService } from '../../src/services/deliveryService';
import { useAuthStore } from '../../src/store/authStore';

export default function ActiveJobScreen() {
  const { bidId } = useLocalSearchParams<{ bidId: string }>();
  const user = useAuthStore((s) => s.user);
  const [otp, setOtp] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmData, setConfirmData] = useState<any>(null);

  const isErrander = user?.role === 'errander';

  const handleGenerateOtp = async () => {
    setLoading(true);
    try {
      const { data } = await deliveryService.generateOtp(bidId!);
      setOtp(data.data.otp);
    } catch (err: any) { Alert.alert('Error', err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data } = await deliveryService.confirm(bidId!, confirmInput);
      setConfirmed(true); setConfirmData(data.data);
    } catch (err: any) { Alert.alert('Error', err.response?.data?.message || 'Invalid OTP'); }
    finally { setLoading(false); }
  };

  if (confirmed) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.checkIcon}>✅</Text>
        <Text style={styles.confirmedTitle}>Delivery Confirmed!</Text>
        <Text style={styles.confirmedDesc}>Dispute window: {confirmData?.dispute_window_hours} hours</Text>
        <Button title="Back to Home" onPress={() => router.push('/(tabs)/home')} variant="secondary" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Delivery</Text>

      {/* Errander: Generate OTP */}
      {isErrander && !otp && (
        <View style={styles.card}>
          <Text style={styles.cardText}>Generate a delivery code when you arrive at the location.</Text>
          <Button title="Generate OTP" onPress={handleGenerateOtp} loading={loading} fullWidth size="lg" />
        </View>
      )}

      {/* Errander: Show OTP */}
      {isErrander && otp && (
        <View style={styles.otpCard}>
          <Text style={styles.otpLabel}>Share this code with the requester</Text>
          <Text style={styles.otpCode}>{otp}</Text>
          <Text style={styles.otpExpiry}>Expires in 30 minutes</Text>
        </View>
      )}

      {/* Requester: Confirm OTP */}
      {!isErrander && (
        <View style={styles.card}>
          <Text style={styles.cardText}>Enter the 6-digit code from your errander.</Text>
          <View style={styles.otpInputRow}>
            {[...Array(6)].map((_, i) => (
              <View key={i} style={[styles.otpBox, confirmInput[i] ? styles.otpBoxFilled : {}]}>
                <Text style={styles.otpBoxText}>{confirmInput[i] || ''}</Text>
              </View>
            ))}
          </View>
          <View style={styles.numPad}>
            {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((n, i) => (
              <Button key={i}
                title={String(n)}
                variant={n === '' ? 'ghost' : 'secondary'}
                onPress={() => {
                  if (n === '⌫') setConfirmInput((p) => p.slice(0, -1));
                  else if (n !== '' && confirmInput.length < 6) setConfirmInput((p) => p + n);
                }}
              />
            ))}
          </View>
          <Button title="Confirm Delivery" onPress={handleConfirm} loading={loading} disabled={confirmInput.length !== 6} fullWidth size="lg" />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  centerContainer: { flex: 1, backgroundColor: colors.neutral[50], alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 24 },
  card: { backgroundColor: colors.white, borderRadius: theme.radius.lg, padding: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardText: { fontSize: 16, color: colors.neutral[500], marginBottom: 16, textAlign: 'center' },
  otpCard: { backgroundColor: colors.primary[500], borderRadius: theme.radius.xl, padding: 32, alignItems: 'center' },
  otpLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 16 },
  otpCode: { fontSize: 48, fontWeight: 'bold', color: colors.white, letterSpacing: 12, marginBottom: 12 },
  otpExpiry: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  otpInputRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  otpBox: { width: 48, height: 56, borderWidth: 2, borderColor: colors.neutral[200], borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  otpBoxFilled: { borderColor: colors.primary[500], backgroundColor: colors.primary[100] },
  otpBoxText: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600] },
  numPad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 24 },
  checkIcon: { fontSize: 64, marginBottom: 16 },
  confirmedTitle: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 8 },
  confirmedDesc: { fontSize: 16, color: colors.neutral[400], marginBottom: 24 },
});
