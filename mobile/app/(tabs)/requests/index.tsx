import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../../src/theme';
import { requestService } from '../../../src/services/requestService';
import { stripHtml } from '../../../src/utils/format';
import type { RequestItem } from '../../../src/types/request';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'open', label: 'Bidding' },
  { key: 'assigned,in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  open: colors.success,
  assigned: colors.info,
  in_progress: colors.accent[500],
  delivered: colors.primary[500],
  confirmed: colors.primary[500],
  escrow_hold: colors.primary[500],
  dispute_window: colors.primary[500],
  funds_released: colors.primary[500],
  completed: colors.neutral[500],
  disputed: colors.error,
  refunded: colors.error,
  cancelled: colors.neutral[400],
  expired: colors.neutral[400],
};

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function MyRequestsScreen() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('');

  const fetch = async () => {
    try {
      const params = filter ? { status: filter } : undefined;
      const { data } = await requestService.myRequests(params);
      setRequests(data.data);
    } catch { /* ignore */ } finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { fetch(); }, [filter]);

  const statusLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const statusColor = (s: string) => STATUS_COLORS[s] ?? colors.neutral[400];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My requests</Text>

      {/* Status filter chips */}
      <View style={styles.chipRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f.key} style={[styles.chip, filter === f.key && styles.chipActive]} onPress={() => setFilter(f.key)}>
            <Text style={[styles.chipText, filter === f.key && styles.chipActiveText]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={requests}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={colors.primary[500]} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No requests yet. Post your first errand to get bids in minutes.</Text> : null}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push(`/requests/${item.id}`)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '20' }]}>
                <Text style={[styles.badgeText, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
              </View>
            </View>
            <Text style={styles.cardDesc} numberOfLines={2}>{stripHtml(item.description)}</Text>
            <View style={styles.cardMeta}>
              <Text style={styles.metaText}>{item.category?.name}</Text>
              <Text style={styles.metaText}>📍 {item.location}</Text>
              <Text style={styles.metaText}>{item.bids_count} {item.bids_count === 1 ? 'bid' : 'bids'}</Text>
              <Text style={styles.metaText}>· {timeAgo(item.created_at)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* FAB — New errand */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => router.push('/requests/create')}>
        <Text style={styles.fabText}>+ New errand</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  title: { fontSize: 17, fontWeight: '700', color: colors.secondary[500], paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, letterSpacing: -0.1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20, marginBottom: 12 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 100, backgroundColor: colors.neutral[100], borderWidth: 1, borderColor: colors.neutral[100] },
  chipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.secondary[500] },
  chipActiveText: { color: colors.white },
  list: { paddingHorizontal: 20, paddingBottom: 110, gap: 10 },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.neutral[100] },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 13.5, fontWeight: '700', color: colors.secondary[500], flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  cardDesc: { fontSize: 12, color: colors.neutral[500], marginBottom: 8, lineHeight: 17 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaText: { fontSize: 11, color: colors.neutral[400] },
  empty: { textAlign: 'center', color: colors.neutral[400], marginTop: 60, fontSize: 13, paddingHorizontal: 30 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: colors.primary[500], paddingHorizontal: 22, paddingVertical: 15, borderRadius: 30, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  fabText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
