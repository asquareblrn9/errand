import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { colors, theme } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';

const menuItems = [
  { icon: '✏️', label: 'Edit Profile', route: '/profile/edit' },
  { icon: '📍', label: 'Addresses', route: '/profile/addresses' },
  { icon: '🛡️', label: 'KYC Verification', route: '/profile/kyc' },
  { icon: '🔐', label: 'Security & Verification', route: '/profile/security' },
  { icon: '⭐', label: 'Trust Score', route: '/trust-score', roles: ['errander'] },
  { icon: '💰', label: 'Earnings', route: '/earnings', roles: ['errander'] },
  { icon: '💳', label: 'Subscriptions', route: '/subscriptions' },
  { icon: '🔔', label: 'Notifications', route: '/notifications' },
  { icon: '❓', label: 'Help & Support', route: '' },
];

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const initials = user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'EB';

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const filtered = menuItems.filter((m) => !m.roles || m.roles.includes(user?.role ?? ''));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar + Info */}
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>{user?.role?.replace('_', ' ')} · Tier {user?.kyc_tier}</Text></View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statValue}>{user?.completed_orders ?? 0}</Text><Text style={styles.statLabel}>Orders</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{user?.member_since ?? '-'}</Text><Text style={styles.statLabel}>Member Since</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{user?.email_verified ? '✓' : '✗'}</Text><Text style={styles.statLabel}>Verified</Text></View>
      </View>

      {/* Menu */}
      {filtered.map((item) => (
        <TouchableOpacity key={item.label} style={styles.menuItem}
          onPress={() => item.route ? router.push(item.route as any) : Alert.alert('Coming soon')}>
          <Text style={styles.menuIcon}>{item.icon}</Text>
          <Text style={styles.menuLabel}>{item.label}</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  header: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary[100], alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: 'bold', color: colors.primary[700] },
  name: { fontSize: 20, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 2 },
  email: { fontSize: 14, color: colors.neutral[400], marginBottom: 8 },
  badge: { backgroundColor: colors.primary[100], paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  badgeText: { fontSize: 13, color: colors.primary[700], fontWeight: '500', textTransform: 'capitalize' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: colors.white, borderRadius: theme.radius.lg, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: colors.primary[500], marginBottom: 4 },
  statLabel: { fontSize: 12, color: colors.neutral[400] },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.neutral[50] },
  menuIcon: { fontSize: 20, marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 16, color: colors.neutral[600] },
  menuArrow: { fontSize: 20, color: colors.neutral[300] },
  logoutBtn: { alignItems: 'center', padding: 16, marginTop: 24 },
  logoutText: { color: colors.error, fontSize: 16, fontWeight: '500' },
});
