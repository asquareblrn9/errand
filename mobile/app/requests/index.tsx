import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { colors, theme } from '../../src/theme';
import { requestService } from '../../src/services/requestService';
import type { RequestItem } from '../../src/types/request';

export default function MyRequestsScreen() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = async () => {
    try { const { data } = await requestService.myRequests(); setRequests(data.data); }
    catch { /* ignore */ } finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { fetch(); }, []);

  const statusColor = (s: string) => {
    const map: Record<string, string> = { open: colors.success, assigned: colors.info, in_progress: colors.warning, delivered: colors.primary[500], completed: colors.neutral[600], disputed: colors.error, cancelled: colors.neutral[400] };
    return map[s] || colors.neutral[400];
  };

  const renderItem = ({ item }: { item: RequestItem }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/requests/${item.id}`)}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '20' }]}>
          <Text style={[styles.badgeText, { color: statusColor(item.status) }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>{item.category?.name}</Text>
        <Text style={styles.metaText}>📍 {item.location}</Text>
        <Text style={styles.metaText}>{item.bids_count} bids</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Requests</Text>
      <FlatList data={requests} keyExtractor={(r) => r.id} renderItem={renderItem} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No requests yet. Tap + to create one.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], padding: theme.spacing.lg, paddingBottom: 0 },
  list: { padding: theme.spacing.lg, gap: 12 },
  card: { backgroundColor: colors.white, borderRadius: theme.radius.lg, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral[600], flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  cardDesc: { fontSize: 14, color: colors.neutral[400], marginBottom: 8, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', gap: 12 },
  metaText: { fontSize: 12, color: colors.neutral[300] },
  empty: { textAlign: 'center', color: colors.neutral[400], marginTop: 60, fontSize: 16 },
});
