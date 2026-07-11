import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { colors, theme } from '../../src/theme';
import { chatService } from '../../src/services/chatService';
import type { Conversation } from '../../src/types/chat';

export default function ChatListScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const fetch = async () => {
    try { const { data } = await chatService.conversations(); setConversations(data.data as unknown as Conversation[]); } catch {} finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { fetch(); }, []);
  const initials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Messages</Text>
      <FlatList data={conversations} keyExtractor={(c) => c.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No conversations yet.</Text> : null}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => router.push(`/chat/${item.id}`)}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials(item.other_user.name)}</Text></View>
            <View style={styles.rowContent}>
              <View style={styles.rowHeader}><Text style={styles.name}>{item.other_user.name}</Text>{item.last_message?.at && <Text style={styles.time}>{new Date(item.last_message.at).toLocaleDateString()}</Text>}</View>
              <View style={styles.rowHeader}><Text style={styles.preview} numberOfLines={1}>{item.last_message?.preview || 'No messages'}</Text>{item.unread_count > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{item.unread_count}</Text></View>}</View>
              <Text style={styles.reqTitle}>{item.request_title}</Text>
            </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.neutral[100] },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary[100], alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '600', color: colors.primary[700] },
  rowContent: { flex: 1 }, rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: colors.neutral[600] }, time: { fontSize: 12, color: colors.neutral[300] },
  preview: { fontSize: 14, color: colors.neutral[400], flex: 1, marginRight: 8 },
  badge: { backgroundColor: colors.primary[500], borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.white }, reqTitle: { fontSize: 12, color: colors.neutral[300], marginTop: 2 },
  empty: { textAlign: 'center', color: colors.neutral[400], marginTop: 60 },
});
