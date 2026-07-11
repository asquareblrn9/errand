import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../src/components/ui/Button';
import { colors, theme } from '../../src/theme';
import { authService } from '../../src/services/authService';
import { useAuthStore } from '../../src/store/authStore';

export default function VerifyPhoneScreen() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [message, setMessage] = useState('');
  const loadUser = useAuthStore((s) => s.loadUser);
  const user = useAuthStore((s) => s.user);
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((p) => (p <= 1 ? 0 : p - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleChange = (text: string, index: number) => {
    const newCode = [...code]; newCode[index] = text; setCode(newCode);
    if (text && index < 5) refs.current[index + 1]?.focus();
    if (newCode.every((c) => c)) handleVerify(newCode.join(''));
  };

  const handleVerify = async (fullCode: string) => {
    setLoading(true); setError('');
    try {
      await authService.verifyPhone(fullCode);
      await loadUser();
      router.replace('/(tabs)');
    } catch { setError('Invalid or expired code.'); }
    finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResendLoading(true); setError(''); setMessage('');
    try {
      await authService.sendPhoneVerification();
      setResendCooldown(60);
      setMessage('A new code has been sent to your phone.');
    } catch { setError('Failed to resend code.'); }
    finally { setResendLoading(false); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Phone</Text>
      <Text style={styles.desc}>
        Enter the 6-digit code sent to{' '}
        <Text style={styles.phone}>{user?.phone || 'your phone'}</Text>
      </Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {message ? <Text style={styles.successText}>{message}</Text> : null}
      <View style={styles.otpRow}>
        {code.map((digit, i) => (
          <TextInput key={i} ref={(r) => { refs.current[i] = r; }} style={[styles.otpBox, error ? styles.otpError : null]}
            value={digit} onChangeText={(t) => handleChange(t, i)} keyboardType="number-pad" maxLength={1} editable={!loading} />
        ))}
      </View>
      <Button
        title={loading ? 'Verifying...' : 'Verify'}
        onPress={() => handleVerify(code.join(''))}
        loading={loading}
        fullWidth
        size="lg"
        disabled={code.some((c) => !c)}
      />
      <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0 || resendLoading}>
        <Text style={[styles.resendLink, (resendCooldown > 0 || resendLoading) && styles.resendDisabled]}>
          {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : resendLoading ? 'Sending...' : 'Resend code'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], textAlign: 'center', marginBottom: 8 },
  desc: { fontSize: 16, color: colors.neutral[400], textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  phone: { fontWeight: '600', color: colors.neutral[600] },
  errorText: { color: colors.error, textAlign: 'center', marginBottom: 16, backgroundColor: '#FEE2E2', padding: 10, borderRadius: theme.radius.md, fontSize: 14 },
  successText: { color: colors.primary[500], textAlign: 'center', marginBottom: 16, backgroundColor: '#E0F2FE', padding: 10, borderRadius: theme.radius.md, fontSize: 14 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  otpBox: { width: 48, height: 56, borderWidth: 2, borderColor: colors.neutral[200], borderRadius: theme.radius.md, textAlign: 'center', fontSize: 24, fontWeight: 'bold', color: colors.neutral[600] },
  otpError: { borderColor: colors.error },
  resendLink: { textAlign: 'center', color: colors.primary[500], fontSize: 14, marginTop: 16, fontWeight: '500' },
  resendDisabled: { color: colors.neutral[300] },
});
