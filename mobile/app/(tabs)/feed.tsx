import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { colors, theme } from '../../src/theme';
import { requestService } from '../../src/services/requestService';
import { useLocationStore } from '../../src/store/locationStore';
import { useAuthStore } from '../../src/store/authStore';
import { Chip } from '../../src/components/ui/Chip';
import type { RequestItem } from '../../src/types/request';

const RADIUS_KM = 3; // default search radius, shown in the header

const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'budget_high', label: 'Highest pay' },
  { key: 'budget_low', label: 'Lowest pay' },
] as const;

const BUDGETS = [
  { key: '', label: 'Any budget' },
  { key: '5000', label: '≤ ₦5k' },
  { key: '10000', label: '≤ ₦10k' },
  { key: '20000', label: '≤ ₦20k' },
] as const;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function FeedScreen() {
  const user = useAuthStore((s) => s.user);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [hasLocation, setHasLocation] = useState(false);
  const [sort, setSort] = useState<(typeof SORTS)[number]['key']>('newest');
  const [budgetMax, setBudgetMax] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { requestService.categories().then(({ data }) => setCategories(data.data)); }, []);

  const fetch = async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (categoryId) params.category_id = categoryId;
    if (budgetMax) params.budget_max = budgetMax;
    params.sort = sort;
    try {
      const loc = useLocationStore.getState();
      if (loc.permission !== 'denied' && !loc.latitude) {
        await loc.fetchLocation().catch(() => {});
      }
      const { latitude, longitude } = useLocationStore.getState();
      if (latitude && longitude) {
        params.latitude = String(latitude);
        params.longitude = String(longitude);
        params.radius_km = String(RADIUS_KM);
        setHasLocation(true);
      } else {
        setHasLocation(false);
      }
      const { data } = await requestService.feed(params);
      setRequests(data.data);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { fetch(); }, [categoryId, sort, budgetMax]);

  // Client-side search (web parity — the web filters the fetched list too)
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) => r.title.toLowerCase().includes(q) || (r.location ?? '').toLowerCase().includes(q));
  }, [requests, search]);

  const userLocation = user?.residential_address ?? user?.state ?? null;

  return (
    <View style={styles.container}>
      {/* Topbar */}
      <View style={styles.topbar}>
        <Text style={styles.title}>Available errands</Text>
        {userLocation && (
          <View style={styles.subRow}>
            <Text style={styles.subPin}>⌖</Text>
            <Text style={styles.sub}>{userLocation}{hasLocation ? ` · ${RADIUS_KM}km radius` : ''}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={
          <>
            {/* Search */}
            <TextInput
              style={styles.search}
              value={search}
              onChangeText={setSearch}
              placeholder="Search errands…"
              placeholderTextColor={colors.neutral[300]}
            />

            {/* Sort chips */}
            <View style={styles.chipRow}>
              {SORTS.map((s) => (
                <Chip key={s.key} label={s.label} on={sort === s.key} onPress={() => setSort(s.key)} />
              ))}
            </View>

            {/* Budget chips */}
            <View style={styles.chipRow}>
              {BUDGETS.map((b) => (
                <Chip key={b.label} label={b.label} on={budgetMax === b.key} onPress={() => setBudgetMax(b.key)} />
              ))}
            </View>

            {/* Category chips */}
            <View style={styles.chipRow}>
              <Chip label="All" on={categoryId === ''} onPress={() => setCategoryId('')} />
              {categories.map((c) => (
                <Chip key={c.id} label={c.name} on={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? '' : c.id)} />
              ))}
            </View>
          </>
        }
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={colors.primary[500]} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No open errands nearby right now.</Text> : null}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardAmount}>{item.budget_hint ? `₦${item.budget_hint.toLocaleString()}` : 'Open to bids'}</Text>
            </View>
            <Text style={styles.cardMeta}>
              {item.distance_km != null ? `${item.distance_km}km away` : item.location}
              {' · posted '}{timeAgo(item.created_at)}
              {' · requester '}
              <Text style={styles.star}>★</Text>
              {item.requester?.rating != null ? Number(item.requester.rating).toFixed(1) : 'new'}
            </Text>
            <TouchableOpacity
              style={[styles.bidBtn, index === 0 ? styles.bidBtnPrimary : styles.bidBtnSecondary]}
              activeOpacity={0.85}
              onPress={() => router.push(`/bid/${item.id}`)}
            >
              <Text style={[styles.bidBtnText, index === 0 ? styles.bidBtnTextPrimary : styles.bidBtnTextSecondary]}>Place a bid</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  topbar: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 14 },
  title: { fontSize: 17, fontWeight: '700', color: colors.secondary[500], letterSpacing: -0.1 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  subPin: { fontSize: 12, color: colors.neutral[500] },
  sub: { color: colors.neutral[500], fontSize: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, paddingBottom: 4, gap: 6 },
  search: { marginHorizontal: 20, marginBottom: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: 11, padding: 12, fontSize: 14, color: colors.secondary[500] },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 100, backgroundColor: colors.neutral[100], borderWidth: 1, borderColor: colors.neutral[100] },
  chipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.secondary[500] },
  chipActiveText: { color: colors.white },
  list: { paddingHorizontal: 20, paddingBottom: 26 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[100], borderRadius: 18, padding: 16, marginBottom: 10, shadowColor: colors.secondary[500], shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  cardTitle: { flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.secondary[500] },
  cardAmount: { fontSize: 13, fontWeight: '600', color: colors.accent[500] },
  cardMeta: { fontSize: 11.5, color: colors.neutral[500], marginBottom: 10 },
  star: { color: colors.accent[500] },
  bidBtn: { borderRadius: 15, paddingVertical: 12, alignItems: 'center' },
  bidBtnPrimary: { backgroundColor: colors.primary[500] },
  bidBtnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.neutral[200] },
  bidBtnText: { fontSize: 13, fontWeight: '600' },
  bidBtnTextPrimary: { color: colors.white, fontWeight: '700' },
  bidBtnTextSecondary: { color: colors.secondary[500] },
  empty: { textAlign: 'center', color: colors.neutral[400], marginTop: 60, fontSize: 14 },
});
