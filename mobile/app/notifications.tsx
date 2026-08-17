import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { colors, theme } from '../src/theme';
import api from '../src/services/api';
import type { ApiResponse } from '../src/types/api';

interface Notification { id: string; action: string; message: string; read: boolean; created_at: string; }

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = async () => {
    try { const { data } = await api.get<ApiResponse<Notification[]>>('/notifications'); setNotifications(data.data as unknown as Notification[]); } catch {} finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { fetch(); }, []);

  const actionIcon = (action: string) => {
    const map: Record<string, string> = { bid_received: '📨', bid_accepted: '✅', bid_rejected: '🚫', payment_confirmed: '💳', payment_made: '💳', delivery_otp_generated: '🔐', delivery_confirmed: '📦', delivery_started: '🚚', dispute_opened: '⚠️', dispute_resolved: '⚖️', payout_sent: '💰', payout_released: '💰', kyc_approved: '🛡️', kyc_rejected: '🛡️', funds_released: '💰', request_cancelled: '❌' };
    return map[action] ?? '🔔';
  };

  const title = (action: string) => action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <View style={[styles.container]}>
      <Text style={[styles.title]}>Notifications</Text>
      <FlatList data={notifications} keyExtractor={(n) => n.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={colors.primary[500]} />}
        ListEmptyComponent={!loading ? <Text style={[styles.empty]}>No notifications yet.</Text> : null}
        renderItem={({ item }) => (
          <View style={[styles.row, !item.read && styles.unread]}>
            <Text style={styles.icon}>{actionIcon(item.action)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.notifTitle]}>{title(item.action)}</Text>
              <Text style={[styles.notifBody]} numberOfLines={2}>{item.message}</Text>
              <Text style={[styles.notifTime]}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
            {!item.read && <View style={styles.dot} />}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], padding: theme.spacing.lg, paddingBottom: 12 },
  list: { paddingHorizontal: theme.spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.neutral[100] },
  unread: { backgroundColor: colors.primary[100] },
  icon: { fontSize: 22, marginTop: 2 },
  notifTitle: { fontSize: 15, fontWeight: '600', color: colors.neutral[600], marginBottom: 2 },
  notifBody: { fontSize: 14, color: colors.neutral[400], lineHeight: 20 },
  notifTime: { fontSize: 12, color: colors.neutral[300], marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary[500], marginTop: 6 },
  empty: { textAlign: 'center', color: colors.neutral[400], marginTop: 60 },
});
