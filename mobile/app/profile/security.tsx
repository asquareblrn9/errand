import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { colors, theme } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';
import { authService } from '../../src/services/authService';

type Section = {
  id: string;
  title: string;
  description: string;
  verified: boolean;
  label: string;
  onSend: () => Promise<unknown>;
  onVerify: (code: string) => Promise<unknown>;
};

export default function SecurityScreen() {
  const user = useAuthStore((s) => s.user);
  const loadUser = useAuthStore((s) => s.loadUser);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(0);
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((p) => (p <= 1 ? 0 : p - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSend = async (sectionId: string, sendFn: () => Promise<unknown>) => {
    setError(''); setMessage('');
    try {
      await sendFn();
      setCooldown(60);
      setActiveSection(sectionId);
      setCode(['', '', '', '', '', '']);
      setMessage('Verification code sent.');
    } catch { setError('Failed to send code.'); }
  };

  const handleVerify = async (verifyFn: (code: string) => Promise<unknown>) => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) return;
    setLoading(activeSection); setError('');
    try {
      await verifyFn(fullCode);
      await loadUser();
      setActiveSection(null);
      setCode(['', '', '', '', '', '']);
      setMessage('Verified successfully!');
    } catch { setError('Invalid or expired code.'); }
    finally { setLoading(null); }
  };

  const sections: Section[] = [
    {
      id: 'email', title: 'Email Verification', description: 'Verify your email address',
      verified: user?.email_verified ?? false, label: user?.email || 'No email',
      onSend: () => authService.sendEmailVerification(),
      onVerify: (code: string) => authService.verifyEmail(code, user?.email),
    },
    {
      id: 'phone', title: 'Phone Verification', description: 'Verify your phone number',
      verified: user?.phone_verified ?? false, label: user?.phone || 'No phone',
      onSend: () => authService.sendPhoneVerification(),
      onVerify: (code: string) => authService.verifyPhone(code),
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Security & Verification</Text>
      <Text style={styles.subtitle}>Manage your account security settings</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {message ? <Text style={styles.successText}>{message}</Text> : null}

      {sections.map((section) => (
        <View key={section.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{section.title}</Text>
              <Text style={styles.cardDesc}>{section.description}</Text>
              <Text style={styles.cardLabel}>{section.label}</Text>
            </View>
            <View style={[styles.badge, section.verified ? styles.badgeOk : styles.badgeWarn]}>
              <Text style={[styles.badgeText, section.verified ? styles.badgeTextOk : styles.badgeTextWarn]}>
                {section.verified ? 'Verified' : 'Pending'}
              </Text>
            </View>
          </View>

          {!section.verified && (
            activeSection === section.id ? (
              <View style={styles.otpSection}>
                <View style={styles.otpRow}>
                  {code.map((digit, i) => (
                    <TextInput key={i} style={styles.otpBox} value={digit}
                      onChangeText={(t) => {
                        const c = [...code]; c[i] = t; setCode(c);
                        if (t && i < 5) refs.current[i + 1]?.focus();
                        if (c.every((v) => v)) handleVerify(section.onVerify);
                      }}
                      keyboardType="number-pad" maxLength={1}
                      ref={(r) => { refs.current[i] = r; }}
                    />
                  ))}
                </View>
                <TouchableOpacity onPress={() => handleVerify(section.onVerify)}
                  disabled={code.some((c) => !c) || loading === section.id}
                  style={[styles.btn, styles.btnPrimary]}>
                  {loading === section.id ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Verify</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleSend(section.id, section.onSend)}
                  disabled={cooldown > 0}>
                  <Text style={[styles.resendLink, cooldown > 0 && styles.resendDisabled]}>
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => handleSend(section.id, section.onSend)}
                style={[styles.btn, styles.btnOutline]}>
                <Text style={styles.btnOutlineText}>Send Verification Code</Text>
              </TouchableOpacity>
            )
          )}
        </View>
      ))}

      {/* 2FA Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Two-Factor Authentication</Text>
            <Text style={styles.cardDesc}>Add an extra layer of security</Text>
          </View>
          <View style={[styles.badge, user?.two_factor_enabled ? styles.badgeOk : styles.badgeWarn]}>
            <Text style={[styles.badgeText, user?.two_factor_enabled ? styles.badgeTextOk : styles.badgeTextWarn]}>
              {user?.two_factor_enabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => Alert.alert('Coming Soon', '2FA management will be available in the next update.')}
          style={[styles.btn, styles.btnOutline]}>
          <Text style={styles.btnOutlineText}>Manage 2FA</Text>
        </TouchableOpacity>
      </View>

      {/* Sessions Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Active Sessions</Text>
            <Text style={styles.cardDesc}>Manage your logged-in devices</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => Alert.alert('Coming Soon', 'Session management will be available in the next update.')}
          style={[styles.btn, styles.btnOutline]}>
          <Text style={styles.btnOutlineText}>View Sessions</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  backBtn: { marginBottom: 16 },
  backText: { fontSize: 18, color: colors.primary[500], fontWeight: '500' },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.neutral[400], marginBottom: 24 },
  errorText: { backgroundColor: '#FEE2E2', color: colors.error, padding: 12, borderRadius: theme.radius.md, marginBottom: 16, fontSize: 14 },
  successText: { backgroundColor: '#E0F2FE', color: colors.primary[500], padding: 12, borderRadius: theme.radius.md, marginBottom: 16, fontSize: 14 },
  card: { backgroundColor: colors.white, borderRadius: theme.radius.lg, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral[600], marginBottom: 2 },
  cardDesc: { fontSize: 13, color: colors.neutral[400], marginBottom: 4 },
  cardLabel: { fontSize: 13, fontWeight: '500', color: colors.neutral[500] },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  badgeOk: { backgroundColor: '#DCFCE7' },
  badgeWarn: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextOk: { color: '#166534' },
  badgeTextWarn: { color: '#92400E' },
  otpSection: { marginTop: 8 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  otpBox: { width: 44, height: 52, borderWidth: 2, borderColor: colors.neutral[200], borderRadius: theme.radius.md, textAlign: 'center', fontSize: 22, fontWeight: 'bold', color: colors.neutral[600] },
  btn: { paddingVertical: 12, borderRadius: theme.radius.md, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.primary[500] },
  btnPrimaryText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  btnOutline: { borderWidth: 1, borderColor: colors.neutral[200] },
  btnOutlineText: { color: colors.neutral[600], fontWeight: '500', fontSize: 14 },
  resendLink: { textAlign: 'center', color: colors.primary[500], fontSize: 13, marginTop: 12, fontWeight: '500' },
  resendDisabled: { color: colors.neutral[300] },
});
