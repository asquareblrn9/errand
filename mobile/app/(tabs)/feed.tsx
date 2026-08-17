import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { colors, theme } from '../../src/theme';
import { requestService } from '../../src/services/requestService';
import { useLocationStore } from '../../src/store/locationStore';
import { useAuthStore } from '../../src/store/authStore';
import type { RequestItem } from '../../src/types/request';

const RADIUS_KM = 3; // default search radius, shown in the header

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

  useEffect(() => { requestService.categories().then(({ data }) => setCategories(data.data)); }, []);

  const fetch = async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (categoryId) params.category_id = categoryId;
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
  useEffect(() => { fetch(); }, [categoryId]);

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
        data={requests}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={
          <>
            {/* Category chips */}
            <View style={styles.chipRow}>
              <TouchableOpacity style={[styles.chip, categoryId === '' && styles.chipActive]} onPress={() => setCategoryId('')}>
                <Text style={[styles.chipText, categoryId === '' && styles.chipActiveText]}>All</Text>
              </TouchableOpacity>
              {categories.map((c) => (
                <TouchableOpacity key={c.id} style={[styles.chip, categoryId === c.id && styles.chipActive]} onPress={() => setCategoryId(categoryId === c.id ? '' : c.id)}>
                  <Text style={[styles.chipText, categoryId === c.id && styles.chipActiveText]}>{c.name}</Text>
                </TouchableOpacity>
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
