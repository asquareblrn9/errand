import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../src/components/ui/Button';
import { colors, theme } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import type { ApiResponse } from '../../src/types/api';
import type { UserData } from '../../src/types/api';

export default function EditProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const [form, setForm] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put<ApiResponse<UserData>>('/me', form);
      setUser(data.data);
      router.back();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const changeAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is required to change your photo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    // Backend accepts jpeg/png/webp only
    const mime = a.mimeType ?? 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
      Alert.alert('Unsupported format', 'Please use a JPG or PNG photo.');
      return;
    }
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const fd = new FormData();
    fd.append('avatar', { uri: a.uri, name: `avatar.${ext}`, type: mime } as any);
    setUploading(true);
    try {
      await api.post('/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await fetchUser();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not upload photo.');
    } finally { setUploading(false); }
  };

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'EB';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Edit Profile</Text>

      {/* Avatar (web parity) */}
      <View style={styles.avatarRow}>
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarInitials}>{initials}</Text></View>
        )}
        <TouchableOpacity onPress={changeAvatar} disabled={uploading} activeOpacity={0.8}>
          <Text style={styles.changePhoto}>{uploading ? 'Uploading…' : 'Change Photo'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Full Name</Text>
      <TextInput style={styles.input} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholderTextColor={colors.neutral[300]} />
      <Text style={styles.label}>Phone Number</Text>
      <TextInput style={styles.input} value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} keyboardType="phone-pad" placeholderTextColor={colors.neutral[300]} />
      <Button title={saving ? 'Saving...' : 'Save Changes'} onPress={handleSave} loading={saving} fullWidth size="lg" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.secondary[500], marginBottom: 24 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  avatar: { width: 72, height: 72, borderRadius: 20, backgroundColor: '#E9ECEF' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,107,0,0.14)' },
  avatarInitials: { fontSize: 22, fontWeight: '700', color: colors.accent[500] },
  changePhoto: { color: colors.primary[500], fontSize: 14, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '500', color: colors.neutral[600], marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, padding: 14, fontSize: 16, color: colors.neutral[600] },
});
