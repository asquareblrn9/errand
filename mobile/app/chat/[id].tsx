import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors, theme } from '../../src/theme';
import { chatService } from '../../src/services/chatService';
import { useAuthStore } from '../../src/store/authStore';
import type { Message } from '../../src/types/chat';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const fetch = async () => {
    try { const { data } = await chatService.messages(id!); setMessages(data.data as unknown as Message[]); } catch {} finally { setLoading(false); }
    chatService.markRead(id!);
  };
  useEffect(() => { fetch(); }, [id]);

  const send = async () => {
    if (!input.trim()) return;
    const content = input; setInput('');
    try { await chatService.send(id!, content); fetch(); } catch {}
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList ref={flatListRef} data={messages} keyExtractor={(m) => m.id} contentContainerStyle={styles.list}
        inverted={false} onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMine = item.sender_id === user?.id;
          return (
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
              {!isMine && <Text style={styles.senderName}>{item.sender_name}</Text>}
              <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.content}</Text>
              <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          );
        }}
      />
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Type a message..." placeholderTextColor={colors.neutral[300]} multiline />
        <TouchableOpacity style={[styles.sendBtn, !input.trim() && styles.sendDisabled]} onPress={send} disabled={!input.trim()}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.neutral[50] },
  list: { padding: 12, gap: 8 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 4 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.primary[500] },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[100] },
  senderName: { fontSize: 12, fontWeight: '600', color: colors.primary[700], marginBottom: 2 },
  msgText: { fontSize: 16, color: colors.neutral[600], lineHeight: 22 },
  msgTextMine: { color: colors.white },
  msgTime: { fontSize: 11, color: colors.neutral[300], alignSelf: 'flex-end', marginTop: 4 },
  msgTimeMine: { color: 'rgba(255,255,255,0.7)' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: colors.neutral[100], backgroundColor: colors.white, gap: 8 },
  input: { flex: 1, backgroundColor: colors.neutral[50], borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, maxHeight: 100, color: colors.neutral[600] },
  sendBtn: { backgroundColor: colors.primary[500], borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: colors.white, fontWeight: '600', fontSize: 14 },
});
