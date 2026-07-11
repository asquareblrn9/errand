import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Switch, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../src/components/ui/Button';
import { colors, theme } from '../../src/theme';
import { requestService } from '../../src/services/requestService';
import type { Category } from '../../src/types/request';

export default function CreateRequestScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ title: '', description: '', category_id: '', location: 'Lagos, Nigeria', budget_hint: '', is_urgent: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => { requestService.categories().then(({ data }) => setCategories(data.data)); }, []);

  const handleSubmit = async () => {
    if (!form.title || !form.description || !form.category_id) {
      Alert.alert('Required', 'Please fill in title, description, and category.'); return;
    }
    setLoading(true);
    try {
      const payload = { ...form, budget_hint: form.budget_hint ? parseFloat(form.budget_hint) : null, latitude: 6.5244, longitude: 3.3792 };
      const { data } = await requestService.create(payload);
      router.replace(`/requests/${data.data.id}`);
    } catch (err: any) { Alert.alert('Error', err.response?.data?.message || 'Failed to create request.'); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>New Request</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} placeholder="e.g. Buy groceries from Shoprite" placeholderTextColor={colors.neutral[300]} />

      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, styles.textArea]} value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} placeholder="Describe what you need..." placeholderTextColor={colors.neutral[300]} multiline numberOfLines={4} />

      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {categories.map((c) => (
          <TouchableOpacity key={c.id} style={[styles.chip, form.category_id === c.id && styles.chipActive]}
            onPress={() => setForm({ ...form, category_id: c.id })}>
            <Text style={[styles.chipText, form.category_id === c.id && styles.chipActiveText]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.label}>Location</Text>
      <TextInput style={styles.input} value={form.location} onChangeText={(t) => setForm({ ...form, location: t })} />

      <Text style={styles.label}>Budget Hint (₦, optional)</Text>
      <TextInput style={styles.input} value={form.budget_hint} onChangeText={(t) => setForm({ ...form, budget_hint: t })} keyboardType="numeric" placeholder="5000" placeholderTextColor={colors.neutral[300]} />

      <View style={styles.urgentRow}>
        <View>
          <Text style={styles.label}>Urgent (+₦1,500)</Text>
          <Text style={styles.urgentDesc}>Get faster responses</Text>
        </View>
        <Switch value={form.is_urgent} onValueChange={(v) => setForm({ ...form, is_urgent: v })} trackColor={{ true: colors.primary[300] }} thumbColor={form.is_urgent ? colors.primary[500] : colors.neutral[200]} />
      </View>

      <Button title={loading ? 'Posting...' : 'Post Request'} onPress={handleSubmit} loading={loading} fullWidth size="lg" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '500', color: colors.neutral[600], marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, padding: 14, fontSize: 16, color: colors.neutral[600] },
  textArea: { height: 100, textAlignVertical: 'top' },
  chipScroll: { marginBottom: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: colors.neutral[200], marginRight: 8, backgroundColor: colors.white },
  chipActive: { borderColor: colors.primary[500], backgroundColor: colors.primary[100] },
  chipText: { fontSize: 14, color: colors.neutral[500] },
  chipActiveText: { color: colors.primary[700], fontWeight: '600' },
  urgentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 24, padding: 16, backgroundColor: colors.white, borderRadius: theme.radius.md, borderWidth: 1, borderColor: colors.neutral[200] },
  urgentDesc: { fontSize: 13, color: colors.neutral[400], marginTop: 2 },
});
