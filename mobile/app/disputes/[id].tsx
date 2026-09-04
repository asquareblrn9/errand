import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button } from '../../src/components/ui/Button';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { StatusPill } from '../../src/components/ui/StatusPill';
import { colors, theme } from '../../src/theme';
import { disputeService } from '../../src/services/disputeService';
import { useAuthStore } from '../../src/store/authStore';

interface DisputeDetail {
  id: string; reason: string; description: string; status: string;
  errander_response: string | null; resolution_note: string | null; resolved_at: string | null;
  raised_by?: { id: string; name: string } | null; errander?: { id: string; name: string } | null; opened_at: string;
  evidence: { id: string; type: string; url: string; uploaded_by: string | null; created_at: string | null }[];
}

export default function DisputeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetch = async () => {
    try { const { data } = await disputeService.getById(id!); setDispute(data.data as unknown as DisputeDetail); } catch { /* ignore */ }
  };
  useEffect(() => { fetch(); }, [id]);

  const handleRespond = async () => {
    if (!response.trim()) return;
    setSubmitting(true);
    try {
      await disputeService.respond(id!, response.trim());
      setResponse('');
      await fetch();
      Alert.alert('Response submitted', 'Your response has been recorded.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not submit response.');
    } finally { setSubmitting(false); }
  };

  const isErrander = user?.id === dispute?.errander?.id;
  const canRespond = isErrander && dispute?.status === 'dispute_opened';

  if (!dispute) return <View style={styles.container}><Text style={styles.empty}>Loading...</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Dispute" />
      <Text style={styles.title}>{dispute.reason}</Text>
      <View style={{ marginBottom: 14 }}>
        <StatusPill status={dispute.status} />
      </View>

      {/* Parties */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Parties</Text>
        <Text style={styles.body}>Raised by {dispute.raised_by?.name ?? '—'}</Text>
        <Text style={styles.body}>Errander: {dispute.errander?.name ?? '—'}</Text>
        <Text style={styles.meta}>Opened {new Date(dispute.opened_at).toLocaleString()}</Text>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.body}>{dispute.description}</Text>
      </View>

      {/* Evidence */}
      {dispute.evidence?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Evidence</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.evidenceRow}>
            {dispute.evidence.map((e) => (
              <Image key={e.id} source={{ uri: e.url }} style={styles.evidenceThumb} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Errander Response */}
      {dispute.errander_response && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Errander Response</Text>
          <Text style={styles.body}>{dispute.errander_response}</Text>
        </View>
      )}

      {/* Resolution */}
      {dispute.resolution_note && (
        <View style={[styles.section, { backgroundColor: '#E6F9F0', borderRadius: theme.radius.lg, padding: 16 }]}>
          <Text style={[styles.sectionTitle, { color: '#00633F' }]}>Resolution</Text>
          <Text style={styles.body}>{dispute.resolution_note}</Text>
          {dispute.resolved_at && <Text style={styles.meta}>Resolved {new Date(dispute.resolved_at).toLocaleString()}</Text>}
        </View>
      )}

      {/* Respond Form */}
      {canRespond && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Submit Response</Text>
          <TextInput style={styles.input} value={response} onChangeText={(t) => setResponse(t.slice(0, 2000))} maxLength={2000} placeholder="Describe your side..." placeholderTextColor={colors.neutral[300]} multiline numberOfLines={4} />
          <Button title={submitting ? 'Submitting…' : 'Submit Response'} onPress={handleRespond} loading={submitting} disabled={!response.trim()} fullWidth />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 56, paddingBottom: 40 },
  title: { fontFamily: theme.fontFamily.heading, fontSize: 22, fontWeight: '700', color: colors.secondary[500], marginBottom: 8 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.secondary[500], marginBottom: 8 },
  body: { fontSize: 15, color: colors.neutral[500], lineHeight: 22 },
  meta: { fontSize: 12, color: colors.neutral[400], marginTop: 8 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, padding: 14, fontSize: 15, color: colors.secondary[500], minHeight: 100, textAlignVertical: 'top', marginBottom: 12 },
  empty: { textAlign: 'center', color: colors.neutral[400], marginTop: 100 },
  evidenceRow: { gap: 8 },
  evidenceThumb: { width: 110, height: 110, borderRadius: 12, backgroundColor: '#E9ECEF' },
});
