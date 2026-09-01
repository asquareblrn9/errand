import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { colors, theme } from '../../src/theme';
import { disputeService } from '../../src/services/disputeService';

interface Dispute { id: string; reason: string; status: string; raised_by?: { name: string }; errander?: { name: string }; opened_at: string; }

export default function DisputesScreen() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = async () => {
    try { const { data } = await disputeService.myDisputes(); setDisputes(data.data as unknown as Dispute[]); } catch {} finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { fetch(); }, []);

  const statusVariant = (s: string) => {
    if (['full_refund', 'partial_refund', 'funds_released', 'completed'].includes(s)) return colors.success;
    if (['dispute_opened', 'under_review', 'admin_decision', 'request_evidence'].includes(s)) return colors.error;
    return colors.neutral[400];
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Disputes</Text>
      <FlatList data={disputes} keyExtractor={(d) => d.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No disputes.</Text> : null}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/disputes/${item.id}`)}>
            <View style={styles.cardHeader}>
              <Text style={styles.reason} numberOfLines={1}>{item.reason}</Text>
              <View style={[styles.badge, { backgroundColor: statusVariant(item.status) + '20' }]}>
                <Text style={[styles.badgeText, { color: statusVariant(item.status) }]}>{item.status.replace(/_/g, ' ')}</Text>
              </View>
            </View>
            <Text style={styles.meta}>Opened {new Date(item.opened_at).toLocaleDateString()}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], padding: theme.spacing.lg, paddingBottom: 12 },
  list: { padding: theme.spacing.lg, gap: 12 },
  card: { backgroundColor: colors.white, borderRadius: theme.radius.lg, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  reason: { fontSize: 16, fontWeight: '600', color: colors.neutral[600], flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  meta: { fontSize: 12, color: colors.neutral[300] },
  empty: { textAlign: 'center', color: colors.neutral[400], marginTop: 60 },
});
