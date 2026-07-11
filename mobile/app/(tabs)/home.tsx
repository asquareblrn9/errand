import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { colors, theme } from '../../src/theme';

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const isRequester = user?.role === 'requester';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] ?? 'User'} 👋</Text>
      <Text style={styles.subtitle}>{isRequester ? 'What do you need done today?' : 'Ready to earn today?'}</Text>

      {/* Quick Actions */}
      <View style={styles.actions}>
        {isRequester ? (
          <>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/requests/create')}>
              <Text style={styles.actionIcon}>📝</Text>
              <Text style={styles.actionTitle}>New Request</Text>
              <Text style={styles.actionDesc}>Post an errand</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/requests')}>
              <Text style={styles.actionIcon}>📋</Text>
              <Text style={styles.actionTitle}>My Requests</Text>
              <Text style={styles.actionDesc}>Track your errands</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/feed')}>
              <Text style={styles.actionIcon}>🔍</Text>
              <Text style={styles.actionTitle}>Browse Requests</Text>
              <Text style={styles.actionDesc}>Find jobs near you</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/bids')}>
              <Text style={styles.actionIcon}>📊</Text>
              <Text style={styles.actionTitle}>My Bids</Text>
              <Text style={styles.actionDesc}>Track your offers</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/wallet')}>
          <Text style={styles.actionIcon}>💰</Text>
          <Text style={styles.actionTitle}>Wallet</Text>
          <Text style={styles.actionDesc}>{isRequester ? 'Fund & pay' : 'Earnings & withdraw'}</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}><Text style={styles.statValue}>{user?.completed_orders ?? 0}</Text><Text style={styles.statLabel}>Completed</Text></View>
          <View style={styles.statBox}><Text style={styles.statValue}>Tier {user?.kyc_tier ?? 0}</Text><Text style={styles.statLabel}>KYC Level</Text></View>
          <View style={styles.statBox}><Text style={styles.statValue}>{user?.member_since ?? '-'}</Text><Text style={styles.statLabel}>Member Since</Text></View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  greeting: { fontSize: 26, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 4 },
  subtitle: { fontSize: 16, color: colors.neutral[400], marginBottom: 24 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  actionCard: { flex: 1, minWidth: '45%', backgroundColor: colors.white, borderRadius: theme.radius.lg, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  actionIcon: { fontSize: 28, marginBottom: 8 },
  actionTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral[600], marginBottom: 2 },
  actionDesc: { fontSize: 13, color: colors.neutral[400] },
  card: { backgroundColor: colors.white, borderRadius: theme.radius.lg, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: colors.neutral[600], marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: colors.primary[500], marginBottom: 4 },
  statLabel: { fontSize: 12, color: colors.neutral[400] },
});
