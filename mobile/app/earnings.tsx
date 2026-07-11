import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, theme } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import api from '../src/services/api';
import type { ApiResponse } from '../src/types/api';

interface TrustData { trust_score: number; tier: string; completed_orders: number; average_rating: number; completion_rate: number; on_time_percentage: number; total_value_handled?: number; }

export default function EarningsScreen() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<TrustData | null>(null);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (user?.id) {
      api.get<ApiResponse<TrustData>>(`/erranders/${user.id}/trust-score`).then(({ data: d }) => setData(d.data));
      api.get<ApiResponse<{ balance: number }>>('/wallet').then(({ data: d }) => setBalance(d.data.balance));
    }
  }, [user]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Earnings</Text>

      {/* Balance */}
      <View style={styles.earningsCard}>
        <Text style={styles.earningsLabel}>Available Balance</Text>
        <Text style={styles.earningsAmount}>₦{balance.toLocaleString()}</Text>
      </View>

      {data && (
        <>
          {/* Performance */}
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.grid}>
            <View style={styles.metric}><Text style={styles.metricValue}>{data.completed_orders}</Text><Text style={styles.metricLabel}>Total Orders</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{data.average_rating.toFixed(1)}</Text><Text style={styles.metricLabel}>Avg Rating</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{data.completion_rate.toFixed(1)}%</Text><Text style={styles.metricLabel}>Completion</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{data.on_time_percentage.toFixed(0)}%</Text><Text style={styles.metricLabel}>On Time</Text></View>
          </View>

          {/* Trust */}
          <Text style={styles.sectionTitle}>Trust Score</Text>
          <View style={styles.trustRow}>
            <View style={[styles.trustBadge, { backgroundColor: data.trust_score >= 4 ? colors.success + '20' : data.trust_score >= 3 ? colors.warning + '20' : colors.error + '20' }]}>
              <Text style={[styles.trustValue, { color: data.trust_score >= 4 ? colors.success : data.trust_score >= 3 ? colors.warning : colors.error }]}>
                {data.trust_score.toFixed(1)}
              </Text>
            </View>
            <View>
              <Text style={styles.tierText}>{data.tier} Tier</Text>
              <Text style={styles.tierDesc}>Higher scores get priority matching</Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 20 },
  earningsCard: { backgroundColor: colors.primary[500], borderRadius: theme.radius.xl, padding: 28, alignItems: 'center', marginBottom: 28 },
  earningsLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  earningsAmount: { fontSize: 40, fontWeight: 'bold', color: colors.white },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral[600], marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  metric: { width: '47%', backgroundColor: colors.white, borderRadius: theme.radius.lg, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  metricValue: { fontSize: 24, fontWeight: 'bold', color: colors.primary[500], marginBottom: 4 },
  metricLabel: { fontSize: 13, color: colors.neutral[400] },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.white, borderRadius: theme.radius.lg, padding: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  trustBadge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  trustValue: { fontSize: 24, fontWeight: 'bold' },
  tierText: { fontSize: 18, fontWeight: '600', color: colors.neutral[600] },
  tierDesc: { fontSize: 13, color: colors.neutral[400], marginTop: 2 },
});
