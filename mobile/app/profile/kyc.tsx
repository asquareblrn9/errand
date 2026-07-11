import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button } from '../../src/components/ui/Button';
import { colors, theme } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';

const tiers = [
  { level: 0, title: 'Basic', desc: 'Email + Phone verified', done: true },
  { level: 1, title: 'BVN Verified', desc: 'Bank Verification Number', done: false },
  { level: 2, title: 'Identity Verified', desc: 'NIN + Selfie check', done: false },
  { level: 3, title: 'Address Verified', desc: 'Proof of address uploaded', done: false },
];

export default function KycScreen() {
  const user = useAuthStore((s) => s.user);
  const currentTier = user?.kyc_tier ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>KYC Verification</Text>
      <Text style={styles.subtitle}>Current Tier: {currentTier}</Text>

      {tiers.map((tier) => {
        const completed = tier.level <= currentTier;
        const isCurrent = tier.level === currentTier + 1;
        return (
          <View key={tier.level} style={[styles.card, completed && styles.cardDone, isCurrent && styles.cardCurrent]}>
            <View style={styles.tierHeader}>
              <View style={[styles.tierBadge, completed && styles.tierBadgeDone]}>
                <Text style={[styles.tierBadgeText, completed && styles.tierBadgeTextDone]}>
                  {completed ? '✓' : tier.level}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tierTitle}>{tier.title}</Text>
                <Text style={styles.tierDesc}>{tier.desc}</Text>
              </View>
              {completed && <Text style={styles.completedText}>Completed</Text>}
            </View>
            {isCurrent && <Button title="Start Verification" size="sm" onPress={() => {}} />}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 60, gap: 12 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 4 },
  subtitle: { fontSize: 16, color: colors.primary[500], fontWeight: '500', marginBottom: 8 },
  card: { backgroundColor: colors.white, borderRadius: theme.radius.lg, padding: 20, borderWidth: 1, borderColor: colors.neutral[100] },
  cardDone: { borderColor: colors.success, backgroundColor: '#F0FFF4' },
  cardCurrent: { borderColor: colors.primary[500], borderWidth: 2 },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tierBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.neutral[100], alignItems: 'center', justifyContent: 'center' },
  tierBadgeDone: { backgroundColor: colors.success },
  tierBadgeText: { fontSize: 16, fontWeight: 'bold', color: colors.neutral[400] },
  tierBadgeTextDone: { color: colors.white },
  tierTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral[600] },
  tierDesc: { fontSize: 13, color: colors.neutral[400], marginTop: 2 },
  completedText: { fontSize: 12, color: colors.success, fontWeight: '600' },
});
