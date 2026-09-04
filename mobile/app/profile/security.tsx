import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import { colors, theme } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';
import { authService } from '../../src/services/authService';
import api from '../../src/services/api';

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

  // ── 2FA state ─────────────────────────────────────────────
  // NOTE: /auth/enable-2fa returns {secret, qr_code_url}; recovery_codes
  // only come back from /auth/verify-2fa — keep it optional.
  const [twoFA, setTwoFA] = useState<{ secret: string; qr_code_url: string; recovery_codes?: string[] } | null>(null);
  const [twoFACode, setTwoFACode] = useState('');

  // ── Sessions state ────────────────────────────────────────
  const [sessions, setSessions] = useState<any[] | null>(null);

  const enable2FA = async () => {
    setLoading('2fa');
    try {
      const { data } = await authService.enable2FA();
      setTwoFA(data.data);
      setMessage('Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not enable 2FA.');
    } finally { setLoading(null); }
  };

  const confirm2FA = async () => {
    if (twoFACode.length !== 6) { Alert.alert('Code', 'Enter the 6-digit code from your authenticator app.'); return; }
    setLoading('2fa-verify');
    try {
      await authService.verify2FA(twoFACode);
      setTwoFA(null); setTwoFACode('');
      await loadUser();
      Alert.alert('2FA Enabled', 'Two-factor authentication is now active. Save your recovery codes!');
    } catch (err: any) {
      Alert.alert('Invalid code', err.response?.data?.message ?? 'Could not verify the code.');
    } finally { setLoading(null); }
  };

  const disable2FA = () => {
    Alert.alert('Disable 2FA?', 'Your account will be protected only by your password.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disable',
        style: 'destructive',
        onPress: async () => {
          try { await authService.disable2FA(); await loadUser(); }
          catch (err: any) { Alert.alert('Error', err.response?.data?.message ?? 'Could not disable 2FA.'); }
        },
      },
    ]);
  };

  const loadSessions = async () => {
    try {
      const { data } = await api.get('/auth/sessions');
      setSessions(data.data);
    } catch { setSessions([]); }
  };

  const revokeSession = (id: string) => {
    Alert.alert('Revoke session?', 'This device will be signed out immediately.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: async () => { await api.delete(`/auth/sessions/${id}`); loadSessions(); } },
    ]);
  };

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

        {!user?.two_factor_enabled && !twoFA && (
          <TouchableOpacity onPress={enable2FA} disabled={loading === '2fa'} style={[styles.btn, styles.btnOutline]}>
            {loading === '2fa' ? <ActivityIndicator color={colors.primary[500]} size="small" /> : <Text style={styles.btnOutlineText}>Enable 2FA</Text>}
          </TouchableOpacity>
        )}

        {twoFA && (
          <View style={styles.twoFaSetup}>
            <Image source={{ uri: twoFA.qr_code_url }} style={styles.qr} />
            <Text style={styles.twoFaSecret}>Secret: <Text style={styles.twoFaSecretCode}>{twoFA.secret}</Text></Text>
            {(twoFA.recovery_codes?.length ?? 0) > 0 && (
              <>
                <Text style={styles.twoFaRecovery}>Recovery codes (save these!):</Text>
                {twoFA.recovery_codes!.map((rc) => (
                  <Text key={rc} style={styles.twoFaCodeRow}>{rc}</Text>
                ))}
              </>
            )}
            <TextInput
              style={styles.twoFaInput}
              value={twoFACode}
              onChangeText={(t) => setTwoFACode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="6-digit code"
              placeholderTextColor={colors.neutral[300]}
            />
            <TouchableOpacity onPress={confirm2FA} disabled={loading === '2fa-verify'} style={[styles.btn, styles.btnPrimary]}>
              {loading === '2fa-verify' ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.btnPrimaryText}>Confirm & Enable</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setTwoFA(null); setTwoFACode(''); }}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {user?.two_factor_enabled && (
          <TouchableOpacity onPress={disable2FA} style={[styles.btn, styles.btnDanger]}>
            <Text style={styles.btnDangerText}>Disable 2FA</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Sessions Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Active Sessions</Text>
            <Text style={styles.cardDesc}>Manage your logged-in devices</Text>
          </View>
        </View>

        {sessions === null ? (
          <TouchableOpacity onPress={loadSessions} style={[styles.btn, styles.btnOutline]}>
            <Text style={styles.btnOutlineText}>View Sessions</Text>
          </TouchableOpacity>
        ) : sessions.length === 0 ? (
          <Text style={styles.emptySessions}>No sessions to display.</Text>
        ) : (
          sessions.map((s) => (
            <View key={s.id} style={styles.sessionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionName}>
                  {s.device_name ?? s.name ?? 'Unknown device'}
                  {s.is_current && <Text style={styles.sessionCurrent}> · Current</Text>}
                </Text>
                <Text style={styles.sessionMeta}>
                  {s.ip_address ?? '—'} · Last used {s.last_used_at ? new Date(s.last_used_at).toLocaleString() : '—'}
                </Text>
              </View>
              {!s.is_current && (
                <TouchableOpacity onPress={() => revokeSession(s.id)}>
                  <Text style={styles.sessionRevoke}>Revoke</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
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
  twoFaSetup: { marginTop: 12, alignItems: 'center', gap: 8 },
  qr: { width: 160, height: 160, borderRadius: 12, backgroundColor: colors.white, marginBottom: 4 },
  twoFaSecret: { fontSize: 13, color: colors.neutral[500] },
  twoFaSecretCode: { fontWeight: '700', color: colors.secondary[500] },
  twoFaRecovery: { fontSize: 12.5, fontWeight: '600', color: colors.secondary[500], marginTop: 6 },
  twoFaCodeRow: { fontSize: 12.5, color: colors.neutral[500], fontFamily: theme.fontFamily.mono },
  twoFaInput: { alignSelf: 'stretch', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, padding: 12, fontSize: 16, textAlign: 'center', letterSpacing: 8, color: colors.secondary[500], marginTop: 6 },
  cancelLink: { color: colors.neutral[400], fontSize: 13, marginTop: 4 },
  btnDanger: { backgroundColor: '#FFE3E9', paddingVertical: 12, borderRadius: theme.radius.md, alignItems: 'center' },
  btnDangerText: { color: colors.error, fontWeight: '700', fontSize: 14 },
  emptySessions: { color: colors.neutral[400], fontSize: 13, paddingVertical: 8 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.neutral[100] },
  sessionName: { fontSize: 14, fontWeight: '600', color: colors.secondary[500] },
  sessionCurrent: { color: colors.primary[500], fontWeight: '700' },
  sessionMeta: { fontSize: 12, color: colors.neutral[400], marginTop: 2 },
  sessionRevoke: { color: colors.error, fontSize: 13, fontWeight: '600', padding: 6 },
});
