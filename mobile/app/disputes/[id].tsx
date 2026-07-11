import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button } from '../../src/components/ui/Button';
import { colors, theme } from '../../src/theme';
import { disputeService } from '../../src/services/disputeService';
import { useAuthStore } from '../../src/store/authStore';

interface DisputeDetail {
  id: string; reason: string; description: string; status: string;
  errander_response: string | null; resolution_note: string | null; resolved_at: string | null;
  raised_by?: { id: string; name: string }; errander?: { id: string; name: string }; opened_at: string;
}

export default function DisputeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    try { const { data } = await disputeService.getById(id!); setDispute(data.data as unknown as DisputeDetail); } catch {} finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [id]);

  const handleRespond = async () => {
    await disputeService.respond(id!, response);
    setResponse('');
    fetch();
  };

  const isErrander = user?.id === dispute?.errander?.id;
  const canRespond = isErrander && dispute?.status === 'open';

  if (!dispute) return <View style={styles.container}><Text style={styles.empty}>Loading...</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{dispute.reason}</Text>
      <View style={[styles.badge, { backgroundColor: dispute.status.includes('resolved') ? colors.success + '20' : colors.error + '20', alignSelf: 'flex-start', marginBottom: 16 }]}>
        <Text style={[styles.badgeText, { color: dispute.status.includes('resolved') ? colors.success : colors.error }]}>{dispute.status.replace(/_/g, ' ')}</Text>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.body}>{dispute.description}</Text>
        <Text style={styles.meta}>Raised by {dispute.raised_by?.name} • {new Date(dispute.opened_at).toLocaleString()}</Text>
      </View>

      {/* Errander Response */}
      {dispute.errander_response && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Errander Response</Text>
          <Text style={styles.body}>{dispute.errander_response}</Text>
        </View>
      )}

      {/* Resolution */}
      {dispute.resolution_note && (
        <View style={[styles.section, { backgroundColor: '#F0FFF4', borderRadius: theme.radius.md, padding: 16 }]}>
          <Text style={[styles.sectionTitle, { color: colors.success }]}>Resolution</Text>
          <Text style={styles.body}>{dispute.resolution_note}</Text>
          {dispute.resolved_at && <Text style={styles.meta}>Resolved {new Date(dispute.resolved_at).toLocaleString()}</Text>}
        </View>
      )}

      {/* Respond Form */}
      {canRespond && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Submit Response</Text>
          <TextInput style={styles.input} value={response} onChangeText={setResponse} placeholder="Describe your side..." placeholderTextColor={colors.neutral[300]} multiline numberOfLines={4} />
          <Button title="Submit Response" onPress={handleRespond} disabled={!response.trim()} fullWidth />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  badgeText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral[600], marginBottom: 8 },
  body: { fontSize: 15, color: colors.neutral[500], lineHeight: 22 },
  meta: { fontSize: 12, color: colors.neutral[300], marginTop: 8 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, padding: 14, fontSize: 15, color: colors.neutral[600], minHeight: 100, textAlignVertical: 'top', marginBottom: 12 },
  empty: { textAlign: 'center', color: colors.neutral[400], marginTop: 100 },
});
