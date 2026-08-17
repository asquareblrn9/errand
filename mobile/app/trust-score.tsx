import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, theme } from '../src/theme';
import { erranderService } from '../src/services/erranderService';
import api from '../src/services/api';
import type { ApiResponse } from '../src/types/api';

interface TrustData {
  trust_score: number; tier: string; completed_orders: number; average_rating: number;
  completion_rate: number; on_time_percentage: number; accept_rate: number; total_value_handled: number;
}

export default function TrustScoreScreen() {
  const [data, setData] = useState<TrustData | null>(null);

  useEffect(() => {
    api.get<ApiResponse<TrustData>>('/errander/trust-score').then(({ data: d }) => setData(d.data)).catch(() => {});
  }, []);

  const tierColor = (t: string) => {
    const map: Record<string, string> = { Platinum: '#E5E4E2', Gold: '#FFD700', Silver: '#C0C0C0', Bronze: '#CD7F32', 'At Risk': colors.error };
    return map[t] ?? colors.neutral[300];
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Trust Score</Text>

      {data ? (
        <>
          {/* Gauge */}
          <View style={styles.gaugeContainer}>
            <View style={[styles.gaugeRing, { borderColor: tierColor(data.tier) }]}>
              <Text style={styles.scoreValue}>{data.trust_score.toFixed(1)}</Text>
              <Text style={styles.scoreMax}>/ 5.0</Text>
            </View>
            <View style={[styles.tierBadge, { backgroundColor: tierColor(data.tier) + '30' }]}>
              <Text style={[styles.tierText, { color: tierColor(data.tier) }]}>{data.tier}</Text>
            </View>
          </View>

          {/* Breakdown */}
          <View style={styles.grid}>
            <View style={styles.metricCard}><Text style={styles.metricValue}>{data.completion_rate.toFixed(1)}%</Text><Text style={styles.metricLabel}>Completion Rate</Text></View>
            <View style={styles.metricCard}><Text style={styles.metricValue}>{data.average_rating.toFixed(1)}</Text><Text style={styles.metricLabel}>Avg Rating</Text></View>
            <View style={styles.metricCard}><Text style={styles.metricValue}>{data.on_time_percentage.toFixed(0)}%</Text><Text style={styles.metricLabel}>On Time</Text></View>
            <View style={styles.metricCard}><Text style={styles.metricValue}>{data.completed_orders}</Text><Text style={styles.metricLabel}>Completed</Text></View>
            <View style={styles.metricCard}><Text style={styles.metricValue}>{data.accept_rate.toFixed(0)}%</Text><Text style={styles.metricLabel}>Accept Rate</Text></View>
            <View style={styles.metricCard}><Text style={styles.metricValue}>₦{Math.round(data.total_value_handled).toLocaleString()}</Text><Text style={styles.metricLabel}>Total Handled</Text></View>
          </View>
        </>
      ) : (
        <Text style={styles.empty}>Trust score available after completing deliveries.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 60, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.secondary[500], marginBottom: 24 },
  gaugeContainer: { alignItems: 'center', marginBottom: 32 },
  gaugeRing: { width: 160, height: 160, borderRadius: 80, borderWidth: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  scoreValue: { fontSize: 42, fontWeight: 'bold', color: colors.white },
  scoreMax: { fontSize: 16, color: colors.neutral[300] },
  tierBadge: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  tierText: { fontSize: 18, fontWeight: 'bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  metricCard: { width: '45%', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[100], borderRadius: theme.radius.lg, padding: 20, alignItems: 'center' },
  metricValue: { fontSize: 24, fontWeight: 'bold', color: colors.primary[500], marginBottom: 4 },
  metricLabel: { fontSize: 13, color: colors.neutral[500], textAlign: 'center' },
  empty: { textAlign: 'center', color: colors.neutral[500], fontSize: 16, marginTop: 40 },
});
