import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { colors, theme } from '../../src/theme';
import { requestService } from '../../src/services/requestService';
import type { RequestItem } from '../../src/types/request';

export default function FeedScreen() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => { requestService.categories().then(({ data }) => setCategories(data.data)); }, []);

  const fetch = async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (categoryId) params.category_id = categoryId;
    try { const { data } = await requestService.feed(params); setRequests(data.data); } catch {} finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { fetch(); }, [categoryId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nearby Requests</Text>
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={categories}
        style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.chip, categoryId === item.id && styles.chipActive]} onPress={() => setCategoryId(categoryId === item.id ? '' : item.id)}>
            <Text style={[styles.chipText, categoryId === item.id && styles.chipActiveText]}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
      <FlatList data={requests} keyExtractor={(r) => r.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No open requests found nearby.</Text> : null}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/requests/${item.id}`)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              {item.is_urgent && <View style={styles.urgentBadge}><Text style={styles.urgentText}>URGENT</Text></View>}
            </View>
            <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
            <View style={styles.row}>
              <Text style={styles.meta}>📍 {item.location}</Text>
              <Text style={styles.meta}>{item.category?.name}</Text>
              {item.budget_hint && <Text style={styles.meta}>₦{item.budget_hint.toLocaleString()}</Text>}
            </View>
            <View style={styles.row}><Text style={styles.meta}>{item.bids_count} bids</Text><Text style={styles.meta}>by {item.requester?.name}</Text></View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], padding: theme.spacing.lg, paddingBottom: 12 },
  filterRow: { maxHeight: 48, marginBottom: 12 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: colors.neutral[200], backgroundColor: colors.white },
  chipActive: { borderColor: colors.primary[500], backgroundColor: colors.primary[100] },
  chipText: { fontSize: 13, color: colors.neutral[500] },
  chipActiveText: { color: colors.primary[700], fontWeight: '600' },
  list: { padding: theme.spacing.lg, gap: 12 },
  card: { backgroundColor: colors.white, borderRadius: theme.radius.lg, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral[600], flex: 1 },
  urgentBadge: { backgroundColor: colors.accent[500] + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  urgentText: { fontSize: 11, fontWeight: '700', color: colors.accent[500] },
  desc: { fontSize: 14, color: colors.neutral[400], marginBottom: 8, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  meta: { fontSize: 12, color: colors.neutral[300] },
  empty: { textAlign: 'center', color: colors.neutral[400], marginTop: 60, fontSize: 16 },
});
