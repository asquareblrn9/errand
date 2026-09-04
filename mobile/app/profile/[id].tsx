import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Card } from '../../src/components/ui/Card';
import { colors, theme } from '../../src/theme';
import api from '../../src/services/api';
import type { ApiResponse } from '../../src/types/api';

interface PublicProfile {
  id: string; name: string; role: string; kyc_tier: number;
  avatar_url: string | null; completed_orders: number; member_since: string | null;
}

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    api.get<ApiResponse<PublicProfile>>(`/users/${id}/profile`)
      .then(({ data }) => setProfile(data.data))
      .catch(() => {});
    api.get(`/users/${id}/ratings`)
      .then(({ data }) => {
        setRating(data.meta?.average_rating ?? null);
        setRatingCount(data.meta?.total ?? 0);
      })
      .catch(() => {});
  }, [id]);

  if (!profile) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary[500]} /></View>;
  }

  const initials = profile.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Profile" />

      <Card>
        <View style={styles.head}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.role}>{profile.role === 'errander' ? 'Errander' : 'Requester'}{profile.kyc_tier >= 1 ? ` · Tier ${profile.kyc_tier} verified` : ''}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.completed_orders}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{rating != null ? rating.toFixed(1) : '—'}</Text>
            <Text style={styles.statLabel}>Rating ({ratingCount})</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.member_since ?? '—'}</Text>
            <Text style={styles.statLabel}>Member Since</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 56 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutral[50] },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatar: { width: 64, height: 64, borderRadius: 18, backgroundColor: '#E9ECEF' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,107,0,0.14)' },
  avatarInitials: { fontSize: 20, fontWeight: '700', color: colors.accent[500] },
  name: { fontFamily: theme.fontFamily.heading, fontSize: 18, fontWeight: '700', color: '#0A1628' },
  role: { fontSize: 13, color: colors.neutral[500], marginTop: 3 },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#E9ECEF', paddingTop: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: theme.fontFamily.heading, fontSize: 16, fontWeight: '700', color: '#0A1628' },
  statLabel: { fontSize: 11, color: colors.neutral[400], marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#E9ECEF' },
});
