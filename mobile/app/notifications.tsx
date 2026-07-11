import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { colors, theme } from '../src/theme';
import api from '../src/services/api';
import type { ApiResponse } from '../src/types/api';

interface Notification { id: string; type: string; title: string; body: string; read: boolean; data: any; created_at: string; }

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = async () => {
    try { const { data } = await api.get<ApiResponse<Notification[]>>('/notifications'); setNotifications(data.data as unknown as Notification[]); } catch {} finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { fetch(); }, []);

  const handleRead = async (id: string) => {
    await api.post(`/notifications/${id}/read`);
    fetch();
  };

  const typeIcon = (t: string) => {
    const map: Record<string, string> = { bid_received: '📨', bid_accepted: '✅', payment_confirmed: '💳', delivery_confirmed: '📦', dispute_opened: '⚠️', payout_sent: '💰', kyc_approved: '🛡️' };
    return map[t] || '🔔';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      <FlatList data={notifications} keyExtractor={(n) => n.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No notifications yet.</Text> : null}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.row, !item.read && styles.unread]} onPress={() => handleRead(item.id)}>
            <Text style={styles.icon}>{typeIcon(item.type)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitle}>{item.title}</Text>
              <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.notifTime}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
            {!item.read && <View style={styles.dot} />}
          </TouchableOpacity>
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
