import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { Button } from '../../src/components/ui/Button';
import { Chip } from '../../src/components/ui/Chip';
import { colors, theme } from '../../src/theme';
import api from '../../src/services/api';
import type { ApiResponse } from '../../src/types/api';

interface Address { id: string; label: string; address_line_1: string; address_line_2: string | null; city: string; state: string; is_default: boolean; }

const LABELS = ['home', 'work', 'other'] as const;
const LABEL_ICONS: Record<string, string> = { home: '🏠', work: '🏢', other: '📍' };

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [form, setForm] = useState({ label: 'home' as typeof LABELS[number], address_line_1: '', address_line_2: '', city: '', state: '', is_default: false });

  const fetch = async () => {
    try { const { data } = await api.get<ApiResponse<Address[]>>('/me/addresses'); setAddresses(data.data); } catch {} finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ label: 'home', address_line_1: '', address_line_2: '', city: '', state: '', is_default: addresses.length === 0 });
    setShowForm(true);
  };

  const openEdit = (a: Address) => {
    setEditing(a);
    setForm({ label: a.label as typeof LABELS[number], address_line_1: a.address_line_1, address_line_2: a.address_line_2 ?? '', city: a.city, state: a.state, is_default: a.is_default });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.address_line_1 || !form.city || !form.state) {
      Alert.alert('Incomplete', 'Address line 1, city and state are required.');
      return;
    }
    try {
      if (editing) {
        await api.put(`/me/addresses/${editing.id}`, { ...form, address_line_2: form.address_line_2 || null });
      } else {
        await api.post('/me/addresses', { ...form, address_line_2: form.address_line_2 || null });
      }
      setShowForm(false);
      fetch();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not save address.');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.delete(`/me/addresses/${id}`); fetch(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Addresses</Text>
        <Button title="+ Add" size="sm" onPress={openAdd} />
      </View>

      <FlatList data={addresses} keyExtractor={(a) => a.id} contentContainerStyle={styles.list}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No addresses saved.</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => openEdit(item)}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text style={styles.cardLabel}>{LABEL_ICONS[item.label] ?? '📍'}</Text>
                <Text style={styles.cardTitle}>{item.label}</Text>
                {item.is_default && <View style={styles.defaultBadge}><Text style={styles.defaultText}>Default</Text></View>}
              </View>
              <Text style={styles.cardAddr}>{item.address_line_1}{item.address_line_2 ? `, ${item.address_line_2}` : ''}</Text>
              <Text style={styles.cardAddr}>{item.city}, {item.state}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteBtn}>🗑️</Text></TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{editing ? 'Edit Address' : 'New Address'}</Text>

            <Text style={styles.label}>Label</Text>
            <View style={styles.chipRow}>
              {LABELS.map((l) => (
                <Chip key={l} label={l[0].toUpperCase() + l.slice(1)} on={form.label === l} onPress={() => setForm({ ...form, label: l })} />
              ))}
            </View>

            <Text style={styles.label}>Address Line 1 *</Text>
            <TextInput style={styles.input} value={form.address_line_1} onChangeText={(t) => setForm({ ...form, address_line_1: t })} placeholderTextColor={colors.neutral[300]} />
            <Text style={styles.label}>Address Line 2</Text>
            <TextInput style={styles.input} value={form.address_line_2} onChangeText={(t) => setForm({ ...form, address_line_2: t })} placeholderTextColor={colors.neutral[300]} />
            <Text style={styles.label}>City *</Text>
            <TextInput style={styles.input} value={form.city} onChangeText={(t) => setForm({ ...form, city: t })} placeholderTextColor={colors.neutral[300]} />
            <Text style={styles.label}>State *</Text>
            <TextInput style={styles.input} value={form.state} onChangeText={(t) => setForm({ ...form, state: t })} placeholderTextColor={colors.neutral[300]} />

            <TouchableOpacity style={styles.defaultToggle} activeOpacity={0.8} onPress={() => setForm({ ...form, is_default: !form.is_default })}>
              <Text style={styles.defaultToggleText}>Set as default address</Text>
              <View style={[styles.switch, form.is_default && styles.switchOn]}>
                <View style={[styles.switchKnob, form.is_default && styles.switchKnobOn]} />
              </View>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <Button title="Cancel" variant="ghost" onPress={() => setShowForm(false)} />
              <Button title="Save" onPress={handleSave} />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.lg, paddingBottom: 0, paddingTop: 60 },
  title: { fontFamily: theme.fontFamily.heading, fontSize: 24, fontWeight: '700', color: colors.secondary[500] },
  list: { padding: theme.spacing.lg, gap: 10 },
  empty: { textAlign: 'center', color: colors.neutral[400], marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: theme.radius.lg, padding: 16, borderWidth: 1, borderColor: '#E9ECEF', ...theme.cardShadow },
  cardLabel: { fontSize: 18 }, cardTitle: { fontSize: 16, fontWeight: '600', color: colors.secondary[500], textTransform: 'capitalize' },
  defaultBadge: { backgroundColor: colors.primary[100], paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  defaultText: { fontSize: 11, color: colors.primary[700], fontWeight: '500' },
  cardAddr: { fontSize: 14, color: colors.neutral[500], marginTop: 2 },
  deleteBtn: { fontSize: 20, padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.secondary[500], marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: colors.neutral[500], marginBottom: 6, marginTop: 10 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  input: { backgroundColor: colors.neutral[50], borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, padding: 12, fontSize: 16, color: colors.secondary[500], marginBottom: 8 },
  defaultToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 16 },
  defaultToggleText: { fontSize: 14, color: colors.secondary[500], fontWeight: '500' },
  switch: { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.neutral[200], padding: 2 },
  switchOn: { backgroundColor: colors.primary[500] },
  switchKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  switchKnobOn: { alignSelf: 'flex-end' },
  modalButtons: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
});
