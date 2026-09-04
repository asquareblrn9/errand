import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { useLocationStore } from '../../src/store/locationStore';
import { erranderService } from '../../src/services/erranderService';
import { requesterService } from '../../src/services/requesterService';
import { requestService } from '../../src/services/requestService';
import { colors, theme } from '../../src/theme';
import { formatNaira } from '../../src/utils/format';
import { StatTile } from '../../src/components/ui/StatTile';
import { Card } from '../../src/components/ui/Card';
import { StatusPill } from '../../src/components/ui/StatusPill';
import type { ErranderHomeData, NearbyRequest } from '../../src/types/errander';
import type { RequesterHomeData } from '../../src/types/requester';
import type { Category } from '../../src/types/request';

const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Format an ISO date string into a readable "Month Year" display (web parity). */
function formatMemberSince(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso; // already formatted
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

/** ETA label for active errand rows (web: "Arrived" once past the deadline). */
function minutesLabel(m: number | null | undefined): string {
  if (m == null) return '—';
  if (m <= 0) return 'Arrived';
  return `${m} min`;
}

/** Normalize a series of amounts to bar heights for the mini charts. */
function toHeights(amounts: number[], maxHeight: number, min = 2): number[] {
  const max = Math.max(...amounts, 0);
  if (max <= 0) return amounts.map(() => min);
  return amounts.map((a) => (a <= 0 ? min : Math.max(min, Math.round((a / max) * maxHeight))));
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const isRequester = user?.role === 'requester';
  const [home, setHome] = useState<ErranderHomeData | null>(null);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requesterHome, setRequesterHome] = useState<RequesterHomeData | null>(null);
  const [requesterCategories, setRequesterCategories] = useState<Category[]>([]);

  const loadErranderHome = useCallback(async () => {
    try {
      // Try to refresh device location for real distance sorting
      const loc = useLocationStore.getState();
      if (loc.permission !== 'denied' && !loc.latitude) {
        await loc.fetchLocation().catch(() => {});
      }
      const { latitude, longitude } = useLocationStore.getState();
      const params = latitude && longitude
        ? { latitude: String(latitude), longitude: String(longitude) }
        : undefined;
      const { data } = await erranderService.home(params);
      setHome(data.data);
    } catch {
      // Leave previous data on screen; interceptor handles auth errors
    }
  }, []);

  const loadRequesterHome = useCallback(async () => {
    try {
      const [homeRes, catRes] = await Promise.all([
        requesterService.home(),
        requestService.categories(),
      ]);
      setRequesterHome(homeRes.data.data);
      setRequesterCategories((catRes.data.data ?? []).slice(0, 4));
    } catch { /* leave previous data */ }
  }, []);

  // Refresh user profile + role dashboard on screen focus
  useFocusEffect(useCallback(() => {
    fetchUser(); // refreshes completed_orders and member_since
    if (isRequester) {
      loadRequesterHome();
    } else {
      loadErranderHome();
    }
  }, [isRequester, fetchUser, loadRequesterHome, loadErranderHome]));

  const firstName = user?.first_name ?? user?.name?.split(' ')[0] ?? 'User';
  const initials = user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'EB';
  const userLocation = user?.residential_address ?? user?.state ?? null;

  if (!isRequester) {
    const earnings = home?.earnings;
    const performance = home?.performance;
    const isOnline = home?.availability.is_online ?? user?.is_online ?? false;
    const nearby: NearbyRequest[] = home?.nearby ?? [];
    const active = home?.active_errand ?? null;
    const changePct = earnings ? Math.abs(earnings.change_pct) : 0;
    const trendUp = earnings ? earnings.change_pct >= 0 : true;
    const weekBars = toHeights((earnings?.chart_week ?? []).map(p => p.amount), 30);

    const toggleOnline = async () => {
      if (toggling || !home) return;
      const next = !home.availability.is_online;
      setToggling(true);
      setHome({ ...home, availability: { ...home.availability, is_online: next } }); // optimistic
      try {
        const { data } = await erranderService.setAvailability(next);
        setHome(h => h ? {
          ...h,
          availability: { is_online: data.data.is_online, last_location_update: data.data.last_location_update },
        } : h);
      } catch {
        setHome(h => h ? { ...h, availability: { ...h.availability, is_online: !next } } : h); // rollback
      } finally {
        setToggling(false);
      }
    };

    const onRefresh = async () => {
      setRefreshing(true);
      await Promise.all([loadErranderHome(), fetchUser()]);
      setRefreshing(false);
    };

    return (
      <SafeAreaView style={styles.erranderSafeArea}>
        <StatusBar style="dark" />
        <ScrollView
          style={styles.erranderContainer}
          contentContainerStyle={styles.erranderContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
        >
          {/* Header */}
          <View style={styles.erranderHeader}>
            <View style={styles.erranderIdentity}>
              <View style={styles.amberAvatar}><Text style={styles.amberAvatarText}>{initials}</Text></View>
              <View>
                <Text style={styles.erranderName}>{firstName}</Text>
                <View style={styles.erranderLocationRow}>
                  <Text style={styles.erranderLocationPin}>⌖</Text>
                  <Text style={styles.erranderLocation}>{userLocation ?? 'Nearby errands'}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.onlinePill} onPress={toggleOnline} activeOpacity={0.85} disabled={toggling}>
              <Text style={[styles.onlineText, !isOnline && styles.onlineTextOff]}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
              <View style={[styles.toggleTrack, !isOnline && styles.toggleTrackOff]}>
                <View style={[styles.toggleKnob, !isOnline && styles.toggleKnobOff]} />
              </View>
            </TouchableOpacity>
          </View>

          {home === null ? (
            <View style={styles.loadingBox}><ActivityIndicator color={colors.primary[500]} /></View>
          ) : (
            <>
              {/* Bento tiles */}
              <View style={styles.bento}>
                <View style={styles.tile}>
                  <View style={styles.tileTopRow}>
                    <Text style={styles.tileLabel}>Today</Text>
                    <Text style={styles.tileIcon}>▤</Text>
                  </View>
                  <Text style={styles.tileNum}>{naira(earnings?.today ?? 0)}</Text>
                  <Text style={[styles.tileDelta, !trendUp && styles.tileDeltaDown]}>
                    {trendUp ? '↑' : '↓'} {changePct}% vs yesterday
                  </Text>
                  <View style={styles.sparkline}>
                    {toHeights((earnings?.chart_today ?? []).slice(-12).map(p => p.amount), 24).map((height, i) => (
                      <View key={i} style={[styles.sparkSegment, { height }]} />
                    ))}
                  </View>
                </View>
                <View style={styles.tile}>
                  <View style={styles.tileTopRow}>
                    <Text style={styles.tileLabel}>This week</Text>
                    <Text style={styles.tileIcon}>★</Text>
                  </View>
                  <Text style={styles.tileNum}>{naira(earnings?.this_week ?? 0)}</Text>
                  <Text style={[styles.tileDelta, styles.tileDeltaMuted]}>{earnings?.this_week_jobs ?? 0} errands done</Text>
                  <View style={styles.barChart}>
                    {weekBars.map((height, index) => (
                      <View key={index} style={[styles.bar, { height }, index === weekBars.length - 1 && { backgroundColor: colors.accent[500] }]} />
                    ))}
                  </View>
                </View>
              </View>

              {/* Active errand */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Active errand</Text>
                <Text style={styles.sectionAction}>Live</Text>
              </View>
              {active ? (
                <TouchableOpacity style={styles.activeCard} activeOpacity={0.85} onPress={() => router.push(`/jobs/${active.bid_id}`)}>
                  <View style={styles.ringWrap}>
                    <View style={styles.progressRing}>
                      <View style={styles.progressInner}><Text style={styles.progressText}>{active.progress_pct}%</Text></View>
                    </View>
                  </View>
                  <View style={styles.activeCopy}>
                    <Text style={styles.activeTitle} numberOfLines={1}>{active.title} · {active.requester_first_name}</Text>
                    <Text style={styles.activeMeta} numberOfLines={2}>{active.state_label} · {naira(active.escrow_amount)} escrowed</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.activeCard} activeOpacity={0.85} onPress={() => router.push('/(tabs)/feed')}>
                  <View style={styles.emptyRing}>
                    <Text style={styles.emptyRingIcon}>⌕</Text>
                  </View>
                  <View style={styles.activeCopy}>
                    <Text style={styles.activeTitle}>No active errand</Text>
                    <Text style={styles.activeMeta}>Browse open requests to start earning</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              )}

              {/* New nearby */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>New nearby</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/feed')}>
                  <Text style={styles.sectionAction}>
                    {(home.nearby_total ?? 0) > 0 ? `${home.nearby_total} requests ›` : 'See all ›'}
                  </Text>
                </TouchableOpacity>
              </View>
              {nearby.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
                  {nearby.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.jobcard} activeOpacity={0.85} onPress={() => router.push(`/requests/${item.id}`)}>
                      <Text style={styles.jobcardTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.jobcardMeta}>
                        ⌖ {item.distance_km != null ? `${item.distance_km}km` : item.location} · {timeAgo(item.created_at)}
                      </Text>
                      <Text style={styles.jobcardMeta}>
                        <Text style={styles.jobcardStar}>★</Text>
                        {item.requester?.rating != null ? ` ${Number(item.requester.rating).toFixed(1)} requester` : ' New requester'}
                      </Text>
                      <Text style={styles.jobcardPrice}>{item.budget_hint ? naira(item.budget_hint) : 'Open to bids'}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.nearbyEmpty}>
                  <Text style={styles.nearbyEmptyText}>No open requests nearby right now</Text>
                  <Text style={styles.nearbyEmptySub}>Pull back later — new requests drop in all the time</Text>
                </View>
              )}

              {/* Stat strip */}
              <View style={styles.statstrip}>
                <View style={styles.statstripItem}>
                  <Text style={styles.statstripValue}>{(performance?.rating ?? 0) > 0 ? (performance?.rating ?? 0).toFixed(1) : 'New'}</Text>
                  <Text style={styles.statstripLabel}>RATING</Text>
                </View>
                <View style={styles.statstripItem}>
                  <Text style={styles.statstripValue}>{performance?.completed_orders ?? user?.completed_orders ?? 0}</Text>
                  <Text style={styles.statstripLabel}>COMPLETED</Text>
                </View>
                <View style={styles.statstripItem}>
                  <Text style={styles.statstripValue}>{Math.round(performance?.accept_rate ?? 0)}%</Text>
                  <Text style={styles.statstripLabel}>ACCEPT RATE</Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const stats = requesterHome?.stats;
  const maxCategory = Math.max(...(requesterHome?.category_breakdown ?? []).map((c) => c.amount), 1);
  const weekBars = toHeights((requesterHome?.chart_week ?? []).map((p) => p.amount), 90);
  const spendChangePct = Math.abs(stats?.spent_change_pct ?? 0);
  const spendUp = (stats?.spent_change_pct ?? 0) >= 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.reqContent}>
      {/* Header */}
      <View style={styles.reqHeader}>
        <Text style={styles.reqGreeting}>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName}</Text>
        {userLocation && (
          <View style={styles.reqLocationRow}>
            <Text style={styles.reqLocationPin}>⌖</Text>
            <Text style={styles.reqLocation}>{userLocation}</Text>
          </View>
        )}
      </View>

      {/* Hero */}
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Need something done?</Text>
        <Text style={styles.heroTitle}>Post an errand, get bids in minutes</Text>
        <TouchableOpacity style={styles.heroBtn} activeOpacity={0.85} onPress={() => router.push('/requests/create')}>
          <Text style={styles.heroBtnText}>Post an errand  ›</Text>
        </TouchableOpacity>
      </View>

      {requesterHome === null ? (
        <View style={styles.loadingBox}><ActivityIndicator color={colors.primary[500]} /></View>
      ) : (
        <>
          {/* Stat tiles */}
          <View style={styles.reqStatRow}>
            <StatTile
              label="Active errands"
              value={stats?.active_errands ?? 0}
              icon="📍"
              delta={`${stats?.arriving_today ?? 0} arriving today`}
              style={styles.reqStatTile}
            />
            <StatTile
              label="Spent this month"
              value={formatNaira(stats?.spent_this_month)}
              icon="💳"
              iconBg="#FFF1E6"
              iconColor="#B24E00"
              delta={`${spendUp ? '↑' : '↓'} ${spendChangePct}% vs last month`}
              style={styles.reqStatTile}
            />
          </View>
          <View style={styles.reqStatRow}>
            <StatTile
              label="Completed"
              value={stats?.completed ?? 0}
              icon="✅"
              iconBg="#E8F0FF"
              iconColor="#1D4FB8"
              delta={`since ${formatMemberSince(user?.member_since)}`}
              style={styles.reqStatTile}
            />
            <StatTile
              label="Avg. rating given"
              value={(stats?.avg_rating ?? 0) > 0 ? (stats?.avg_rating ?? 0).toFixed(1) : '—'}
              icon="⭐"
              iconBg="#FFF1E6"
              iconColor="#B24E00"
              delta={`across ${stats?.total_ratings ?? 0} errands`}
              style={styles.reqStatTile}
            />
          </View>

          {/* Spending chart */}
          <Card
            title="Spending — last 8 weeks"
            right={
              <View style={[styles.chartBadge, spendUp ? styles.chartBadgeUp : styles.chartBadgeDown]}>
                <Text style={[styles.chartBadgeText, spendUp ? styles.chartBadgeTextUp : styles.chartBadgeTextDown]}>
                  {spendUp ? '↑' : '↓'} {spendChangePct}%
                </Text>
              </View>
            }
            style={styles.reqCardSpacing}
          >
            <View style={styles.spendChart}>
              {weekBars.map((height, i) => (
                <View key={i} style={[styles.spendBar, { height }, i === weekBars.length - 1 && styles.spendBarLatest]} />
              ))}
            </View>
            <View style={styles.spendLabels}>
              {(requesterHome?.chart_week ?? []).map((p, i) => (
                <Text key={i} style={styles.spendLabel}>{p.label}</Text>
              ))}
            </View>
          </Card>

          {/* Category breakdown */}
          <Card title="Category breakdown" style={styles.reqCardSpacing}>
            {(requesterHome?.category_breakdown ?? []).length === 0 ? (
              <Text style={styles.catEmpty}>No spending this month yet</Text>
            ) : (
              requesterHome?.category_breakdown.slice(0, 5).map((c) => {
                const pct = Math.max((c.amount / maxCategory) * 100, 0);
                return (
                  <View key={c.category_name} style={styles.catRow}>
                    <View style={styles.catRowTop}>
                      <Text style={styles.catLabel}>{c.category_name}</Text>
                      <Text style={styles.catAmount}>{formatNaira(c.amount)}</Text>
                    </View>
                    <View style={styles.catTrack}>
                      <View style={[styles.catFill, { width: `${pct}%` as `${number}%` }]} />
                    </View>
                  </View>
                );
              })
            )}
          </Card>

          {/* Active errands */}
          <View style={styles.reqSectionHead}>
            <Text style={styles.reqSectionTitle}>Active errands</Text>
            <Text style={styles.reqSectionCount}>{stats?.active_errands ?? 0} running</Text>
          </View>
          {(requesterHome?.active_errands ?? []).length === 0 ? (
            <TouchableOpacity style={styles.reqCard} activeOpacity={0.85} onPress={() => router.push('/requests/create')}>
              <View style={styles.reqCardLeft}>
                <View style={styles.emptyRing}><Text style={styles.emptyRingIcon}>⌕</Text></View>
                <View>
                  <Text style={styles.reqCardTitle}>No active errands</Text>
                  <Text style={styles.reqCardSub}>Post an errand to get bids in minutes</Text>
                </View>
              </View>
              <Text style={styles.reqChevron}>›</Text>
            </TouchableOpacity>
          ) : (
            requesterHome?.active_errands.map((r) => (
              <TouchableOpacity key={r.id} style={styles.activeErrandCard} activeOpacity={0.85} onPress={() => router.push(`/requests/${r.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqCardTitle} numberOfLines={1}>{r.title}</Text>
                  <Text style={styles.reqCardSub} numberOfLines={1}>
                    {r.errander_name ? `${r.errander_name} · ` : ''}{formatNaira(r.escrow_amount)} escrowed · {minutesLabel(r.minutes_remaining)}
                  </Text>
                </View>
                <StatusPill status={r.status} />
              </TouchableOpacity>
            ))
          )}

          {/* Quick categories */}
          <View style={styles.reqSectionHead}>
            <Text style={styles.reqSectionTitle}>Quick categories</Text>
          </View>
          <View style={styles.reqChipRow}>
            {requesterCategories.map((c) => (
              <TouchableOpacity key={c.id} style={styles.reqChip} onPress={() => router.push({ pathname: '/requests/create', params: { category_id: c.id, category_name: c.name } })}>
                <Text style={styles.reqChipText}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Requester (per req-home design)
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  reqContent: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 28 },
  reqHeader: { marginBottom: 14 },
  reqGreeting: { fontSize: 17, fontWeight: '700', color: colors.secondary[500], letterSpacing: -0.1 },
  reqLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  reqLocationPin: { fontSize: 12, color: colors.neutral[500] },
  reqLocation: { color: colors.neutral[500], fontSize: 11.5 },
  heroCard: {
    backgroundColor: 'rgba(255,107,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.22)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  eyebrow: { fontSize: 10, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.accent[500], fontWeight: '600', marginBottom: 6 },
  heroTitle: { fontSize: 15.5, fontWeight: '700', color: colors.secondary[500], marginBottom: 12, letterSpacing: -0.1 },
  heroBtn: { backgroundColor: colors.primary[500], borderRadius: 15, paddingVertical: 14, alignItems: 'center' },
  heroBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  reqSectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 },
  reqSectionTitle: { color: colors.secondary[500], fontSize: 14, fontWeight: '700' },
  reqSectionCount: { color: colors.neutral[500], fontSize: 12 },
  reqCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
  },
  reqCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  reqCardTitle: { color: colors.secondary[500], fontSize: 13, fontWeight: '700' },
  reqCardSub: { color: colors.neutral[500], fontSize: 11, marginTop: 2 },
  reqChevron: { color: colors.neutral[400], fontSize: 24 },
  reqChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  reqChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 100, backgroundColor: colors.neutral[100], borderWidth: 1, borderColor: colors.neutral[100] },
  reqChipText: { fontSize: 12, fontWeight: '600', color: colors.secondary[500] },
  recentCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[100], borderRadius: 18, padding: 14, marginBottom: 8 },
  recentText: { fontSize: 12, color: colors.secondary[500], flex: 1, marginRight: 8 },
  recentStars: { color: colors.accent[500], fontSize: 11, letterSpacing: 1 },
  recentEmpty: { color: colors.neutral[400], fontSize: 12 },

  // Requester dashboard (requester/home parity)
  reqStatRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  reqStatTile: { flex: 1 },
  chartBadge: { borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 },
  chartBadgeUp: { backgroundColor: '#E6F9F0' },
  chartBadgeDown: { backgroundColor: '#FFE3E9' },
  chartBadgeText: { fontSize: 11, fontWeight: '700' },
  chartBadgeTextUp: { color: '#008554' },
  chartBadgeTextDown: { color: '#FF1744' },
  reqCardSpacing: { marginBottom: 10 },
  spendChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 100 },
  spendBar: { flex: 1, borderRadius: 4, backgroundColor: '#E6F9F0' },
  spendBarLatest: { backgroundColor: colors.primary[500] },
  spendLabels: { flexDirection: 'row', marginTop: 6 },
  spendLabel: { flex: 1, fontSize: 9, color: colors.neutral[400], textAlign: 'center' },
  catEmpty: { color: colors.neutral[400], fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  catRow: { marginBottom: 10 },
  catRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catLabel: { fontSize: 12, fontWeight: '600', color: colors.secondary[500] },
  catAmount: { fontSize: 12, fontWeight: '600', color: colors.neutral[500] },
  catTrack: { height: 4, borderRadius: 2, backgroundColor: '#E9ECEF', overflow: 'hidden' },
  catFill: { height: '100%', borderRadius: 2, backgroundColor: colors.primary[500] },
  activeErrandCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[100], borderRadius: 18, padding: 14, marginBottom: 8, ...theme.cardShadow },

  // Errander (per err-home design)
  erranderSafeArea: { flex: 1, backgroundColor: colors.neutral[50] },
  erranderContainer: { flex: 1, backgroundColor: colors.neutral[50] },
  erranderContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  erranderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  erranderIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amberAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,107,0,0.14)', alignItems: 'center', justifyContent: 'center' },
  amberAvatarText: { color: colors.accent[500], fontSize: 14, fontWeight: '700' },
  erranderName: { color: colors.secondary[500], fontSize: 17, fontWeight: '700', marginBottom: 2, letterSpacing: -0.1 },
  erranderLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  erranderLocationPin: { fontSize: 12, color: colors.neutral[500] },
  erranderLocation: { color: colors.neutral[500], fontSize: 11.5 },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: 100,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
  },
  onlineText: { color: colors.primary[500], fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },
  onlineTextOff: { color: colors.neutral[400] },
  toggleTrack: { width: 32, height: 18, borderRadius: 100, backgroundColor: colors.primary[500], alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 2 },
  toggleTrackOff: { backgroundColor: colors.neutral[200], alignItems: 'flex-start' },
  toggleKnob: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.white },
  toggleKnobOff: { backgroundColor: colors.white },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  bento: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  tile: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: 16,
    padding: 14,
  },
  tileTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  tileLabel: { fontSize: 10.5, color: colors.neutral[500], fontWeight: '600' },
  tileIcon: { fontSize: 12, color: colors.neutral[400] },
  tileNum: { fontSize: 19, fontWeight: '600', color: colors.secondary[500], letterSpacing: -0.1 },
  tileDelta: { fontSize: 10, color: colors.primary[500], fontWeight: '600', marginTop: 2 },
  tileDeltaDown: { color: colors.error },
  tileDeltaMuted: { color: colors.neutral[500] },
  sparkline: { height: 26, flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 8 },
  sparkSegment: { width: 10, borderTopWidth: 2, borderTopColor: colors.primary[500], borderRadius: 2 },
  barChart: { height: 26, flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 8 },
  bar: { flex: 1, borderRadius: 2, backgroundColor: colors.neutral[100] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { color: colors.secondary[500], fontSize: 14, fontWeight: '700' },
  sectionAction: { color: colors.neutral[500], fontSize: 12 },
  activeCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
  },
  ringWrap: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  progressRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 4,
    borderColor: colors.neutral[100],
    borderTopColor: colors.accent[500],
    borderRightColor: colors.accent[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressInner: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  progressText: { color: colors.accent[500], fontSize: 9, fontWeight: '800' },
  emptyRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRingIcon: { color: colors.neutral[400], fontSize: 18 },
  activeCopy: { flex: 1 },
  activeTitle: { color: colors.secondary[500], fontSize: 13, fontWeight: '700', marginBottom: 3 },
  activeMeta: { color: colors.neutral[500], fontSize: 11, lineHeight: 15 },
  chevron: { color: colors.neutral[400], fontSize: 24 },
  hscroll: { flexDirection: 'row', gap: 10, paddingBottom: 18 },
  jobcard: {
    width: 150,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: 16,
    padding: 13,
  },
  jobcardTitle: { color: colors.secondary[500], fontSize: 13, fontWeight: '700', lineHeight: 17, marginBottom: 10 },
  jobcardMeta: { color: colors.neutral[500], fontSize: 10.5, marginBottom: 4 },
  jobcardStar: { color: colors.accent[500] },
  jobcardPrice: { color: colors.accent[500], fontSize: 13, fontWeight: '700', marginTop: 6 },
  nearbyEmpty: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  nearbyEmptyText: { color: colors.secondary[500], fontSize: 13, fontWeight: '600' },
  nearbyEmptySub: { color: colors.neutral[500], fontSize: 11 },
  statstrip: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: 18,
    paddingVertical: 14,
  },
  statstripItem: { flex: 1, alignItems: 'center' },
  statstripValue: { color: colors.secondary[500], fontSize: 16, fontWeight: '700', marginBottom: 3 },
  statstripLabel: { color: colors.neutral[400], fontSize: 9, fontWeight: '600' },
});
