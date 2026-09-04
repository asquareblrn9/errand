import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../src/components/ui/Button';
import { Chip } from '../../src/components/ui/Chip';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { colors, theme } from '../../src/theme';
import { kycService } from '../../src/services/kycService';
import { useAuthStore } from '../../src/store/authStore';

const GENDERS = ['male', 'female', 'other'] as const;

export default function KycProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState({
    first_name: user?.first_name ?? user?.name?.split(' ')[0] ?? '',
    last_name: user?.last_name ?? user?.name?.split(' ')[1] ?? '',
    date_of_birth: '',
    gender: 'male' as 'male' | 'female' | 'other',
    residential_address: user?.residential_address ?? '',
    state: user?.state ?? '',
    lga: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.first_name || !form.last_name || !form.date_of_birth || !form.residential_address || !form.state || !form.lga) {
      Alert.alert('Incomplete', 'Fill all required fields.');
      return;
    }
    const dob = new Date(form.date_of_birth);
    const eighteen = new Date();
    eighteen.setFullYear(eighteen.getFullYear() - 18);
    if (isNaN(dob.getTime()) || dob > eighteen) {
      Alert.alert('Invalid date of birth', 'Use YYYY-MM-DD and you must be at least 18 years old.');
      return;
    }
    setSaving(true);
    try {
      await kycService.profile({ ...form, gender: form.gender });
      Alert.alert('Saved', 'Profile information updated.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not save profile.');
    } finally { setSaving(false); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Profile Information" />
      <Text style={styles.label}>First Name *</Text>
      <TextInput style={styles.input} value={form.first_name} onChangeText={(t) => set('first_name', t)} placeholderTextColor={colors.neutral[300]} />
      <Text style={styles.label}>Last Name *</Text>
      <TextInput style={styles.input} value={form.last_name} onChangeText={(t) => set('last_name', t)} placeholderTextColor={colors.neutral[300]} />
      <Text style={styles.label}>Date of Birth (YYYY-MM-DD, 18+) *</Text>
      <TextInput style={styles.input} value={form.date_of_birth} onChangeText={(t) => set('date_of_birth', t)} placeholder="1998-05-12" placeholderTextColor={colors.neutral[300]} />
      <Text style={styles.label}>Gender *</Text>
      <View style={styles.chipRow}>
        {GENDERS.map((g) => (
          <Chip key={g} label={g[0].toUpperCase() + g.slice(1)} on={form.gender === g}
            onPress={() => set('gender', g)} />
        ))}
      </View>
      <Text style={styles.label}>Residential Address *</Text>
      <TextInput style={styles.input} value={form.residential_address} onChangeText={(t) => set('residential_address', t)} placeholderTextColor={colors.neutral[300]} />
      <Text style={styles.label}>State *</Text>
      <TextInput style={styles.input} value={form.state} onChangeText={(t) => set('state', t)} placeholder="Lagos" placeholderTextColor={colors.neutral[300]} />
      <Text style={styles.label}>LGA *</Text>
      <TextInput style={styles.input} value={form.lga} onChangeText={(t) => set('lga', t)} placeholderTextColor={colors.neutral[300]} />
      <Button title={saving ? 'Saving…' : 'Save Profile'} onPress={save} loading={saving} fullWidth size="lg" />
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
        <Text style={styles.cancel}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 56, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '500', color: colors.neutral[600], marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, padding: 14, fontSize: 16, color: colors.secondary[500] },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cancel: { textAlign: 'center', color: colors.neutral[400], fontSize: 14 },
});
