import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { Button } from '../../src/components/ui/Button';
import { colors, theme } from '../../src/theme';
import api from '../../src/services/api';
import type { ApiResponse } from '../../src/types/api';

interface Address { id: string; label: string; address_line_1: string; city: string; state: string; is_default: boolean; }

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: 'home', address_line_1: '', city: '', state: '' });

  const fetch = async () => {
    try { const { data } = await api.get<ApiResponse<Address[]>>('/me/addresses'); setAddresses(data.data); } catch {} finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const handleSave = async () => {
    await api.post('/me/addresses', form);
    setShowForm(false); setForm({ label: 'home', address_line_1: '', city: '', state: '' });
    fetch();
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await api.delete(`/me/addresses/${id}`); fetch(); } }]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Addresses</Text>
        <Button title="+ Add" size="sm" onPress={() => setShowForm(true)} />
      </View>

      <FlatList data={addresses} keyExtractor={(a) => a.id} contentContainerStyle={styles.list}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No addresses saved.</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text style={styles.cardLabel}>{item.label === 'home' ? '🏠' : item.label === 'work' ? '🏢' : '📍'}</Text>
                <Text style={styles.cardTitle}>{item.label}</Text>
                {item.is_default && <View style={styles.defaultBadge}><Text style={styles.defaultText}>Default</Text></View>}
              </View>
              <Text style={styles.cardAddr}>{item.address_line_1}</Text>
              <Text style={styles.cardAddr}>{item.city}, {item.state}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteBtn}>🗑️</Text></TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>New Address</Text>
          <TextInput style={styles.input} value={form.address_line_1} onChangeText={(t) => setForm({ ...form, address_line_1: t })} placeholder="Address Line 1" placeholderTextColor={colors.neutral[300]} />
          <TextInput style={styles.input} value={form.city} onChangeText={(t) => setForm({ ...form, city: t })} placeholder="City" placeholderTextColor={colors.neutral[300]} />
          <TextInput style={styles.input} value={form.state} onChangeText={(t) => setForm({ ...form, state: t })} placeholder="State" placeholderTextColor={colors.neutral[300]} />
          <View style={styles.modalButtons}><Button title="Cancel" variant="ghost" onPress={() => setShowForm(false)} /><Button title="Save" onPress={handleSave} /></View>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.lg, paddingBottom: 0, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600] },
  list: { padding: theme.spacing.lg, gap: 10 },
  empty: { textAlign: 'center', color: colors.neutral[400], marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: theme.radius.md, padding: 16, borderWidth: 1, borderColor: colors.neutral[100] },
  cardLabel: { fontSize: 18 }, cardTitle: { fontSize: 16, fontWeight: '600', color: colors.neutral[600], textTransform: 'capitalize' },
  defaultBadge: { backgroundColor: colors.primary[100], paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  defaultText: { fontSize: 11, color: colors.primary[700], fontWeight: '500' },
  cardAddr: { fontSize: 14, color: colors.neutral[500], marginTop: 2 },
  deleteBtn: { fontSize: 20, padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 16 },
  input: { backgroundColor: colors.neutral[50], borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, padding: 12, fontSize: 16, color: colors.neutral[600], marginBottom: 10 },
  modalButtons: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
});
