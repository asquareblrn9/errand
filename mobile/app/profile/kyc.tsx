import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors, theme } from '../../src/theme';
import { kycService, type KycStatusData } from '../../src/services/kycService';
import { StatusPill } from '../../src/components/ui/StatusPill';

function statusConfig(status: string | undefined, complete: boolean): { label: string; tone: string } {
  switch (status) {
    case 'approved': return { label: 'Approved', tone: 'completed' };
    case 'pending_review': return { label: 'Pending Review', tone: 'escrow_hold' };
    case 'under_review': return { label: 'Under Review', tone: 'dispute_window' };
    case 'rejected': return { label: 'Rejected', tone: 'rejected' };
    case 'requires_resubmission': return { label: 'Resubmit', tone: 'escrow_hold' };
    default: return complete ? { label: 'Approved', tone: 'completed' } : { label: 'Pending', tone: 'draft' };
  }
}

const STEPS: { key: string; label: string; description: string; route: string }[] = [
  { key: 'profile', label: 'Profile Information', description: 'Full name, date of birth, address', route: '/profile/kyc-profile' },
  { key: 'phone', label: 'Phone Verification', description: 'Verify with OTP', route: '/profile/security' },
  { key: 'email', label: 'Email Verification', description: 'Verify email address', route: '/profile/security' },
  { key: 'identity', label: 'Identity Verification', description: 'Government ID upload', route: '/profile/kyc-wizard' },
  { key: 'selfie', label: 'Selfie', description: 'Face capture for review', route: '/profile/kyc-wizard' },
  { key: 'bank', label: 'Bank Account', description: 'Verified account for payouts', route: '/profile/bank' },
  { key: 'emergency_contact', label: 'Emergency Contact', description: 'Who we contact on your behalf', route: '/profile/kyc-wizard' },
];

export default function KycScreen() {
  const [data, setData] = useState<KycStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const { data } = await kycService.status();
      setData(data.data);
    } catch { /* keep previous */ } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

  const submit = async () => {
    setSubmitting(true);
    try {
      await kycService.submit();
      Alert.alert('Submitted', 'Your verification documents have been submitted for review.');
      await fetch();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not submit.');
    } finally { setSubmitting(false); }
  };

  if (loading && !data) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary[500]} /></View>;
  }

  const canSubmit = data && !['pending_review', 'under_review', 'approved'].includes(data.kyc_status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={colors.primary[500]} />}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backIcon}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Verification</Text>
      <Text style={styles.subtitle}>Complete verification to unlock all features and build trust.</Text>

      {/* Progress */}
      <View style={styles.progressCard}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Profile Completion</Text>
          <Text style={styles.progressPct}>{data?.progress ?? 0}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${data?.progress ?? 0}%` }]} />
        </View>
      </View>

      {/* Steps */}
      {STEPS.map((step) => {
        const complete = data?.steps[step.key] ?? false;
        const verification = data?.verifications.find((v) => v.type === step.key);
        const cfg = statusConfig(verification?.status, complete);
        return (
          <TouchableOpacity key={step.key} style={styles.stepCard} activeOpacity={0.85}
            onPress={() => router.push(step.route as any)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepLabel}>{step.label}</Text>
              <Text style={styles.stepDesc}>
                {step.description}
                {verification?.rejection_reason ? ` — ${verification.rejection_reason}` : ''}
              </Text>
            </View>
            <StatusPill status={cfg.tone} label={cfg.label} />
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        );
      })}

      {/* Submit */}
      {canSubmit && (
        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting} activeOpacity={0.85}>
          <Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Submit for Review'}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 56 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutral[50] },
  backBtn: { marginBottom: 8 },
  backIcon: { fontSize: 28, color: colors.secondary[500] },
  title: { fontFamily: theme.fontFamily.heading, fontSize: 24, fontWeight: '700', color: colors.secondary[500] },
  subtitle: { fontSize: 14, color: colors.neutral[500], marginTop: 4, marginBottom: 20 },
  progressCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#E9ECEF', borderRadius: theme.radius.lg, padding: 20, marginBottom: 16, ...theme.cardShadow },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 13, fontWeight: '600', color: colors.secondary[500] },
  progressPct: { fontSize: 13, fontWeight: '700', color: colors.primary[500] },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#E9ECEF', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary[500] },
  stepCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E9ECEF', borderRadius: theme.radius.lg, padding: 16, marginBottom: 10, ...theme.cardShadow },
  stepLabel: { fontSize: 15, fontWeight: '600', color: colors.secondary[500] },
  stepDesc: { fontSize: 12, color: colors.neutral[500], marginTop: 2 },
  chevron: { fontSize: 20, color: colors.neutral[300] },
  submitBtn: { backgroundColor: colors.primary[500], borderRadius: theme.radius.md, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  submitText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
