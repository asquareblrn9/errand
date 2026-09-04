import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../src/components/ui/Button';
import { Chip } from '../../src/components/ui/Chip';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { colors, theme } from '../../src/theme';
import { kycService } from '../../src/services/kycService';

const DOC_TYPES = [
  { value: 'nin', label: 'NIN' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'voters_card', label: "Voter's Card" },
  { value: 'international_passport', label: 'Passport' },
];
const RELATIONSHIPS = ['parent', 'sibling', 'friend', 'spouse', 'other'];

interface PickedFile { uri: string; name: string; type: string; }

export default function KycWizardScreen() {
  const [step, setStep] = useState(1); // 1 identity, 2 selfie, 3 emergency contact
  const [saving, setSaving] = useState(false);

  // ── Step 1: Identity ──────────────────────────────────────
  const [docType, setDocType] = useState('nin');
  const [docNumber, setDocNumber] = useState('');
  const [front, setFront] = useState<PickedFile | null>(null);
  const [back, setBack] = useState<PickedFile | null>(null);

  // ── Step 2: Selfie ────────────────────────────────────────
  const [selfie, setSelfie] = useState<PickedFile | null>(null);

  // ── Step 3: Emergency contact ─────────────────────────────
  const [contact, setContact] = useState({ full_name: '', phone_number: '', relationship: 'parent', other_relationship: '' });

  const pickImage = async (fromCamera: boolean): Promise<PickedFile | null> => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', fromCamera ? 'Camera access is required for the selfie.' : 'Photo library access is required to upload documents.');
      return null;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return null;
    const a = res.assets[0];

    // Backend only accepts jpg/jpeg/png (≤5 MB) — validate before upload
    const mime = a.mimeType ?? 'image/jpeg';
    if (!['image/jpeg', 'image/png'].includes(mime)) {
      Alert.alert('Unsupported format', 'Please use a JPG or PNG image.');
      return null;
    }
    if (a.fileSize != null && a.fileSize > 5 * 1024 * 1024) {
      Alert.alert('File too large', 'Images must be 5 MB or smaller.');
      return null;
    }
    const ext = mime === 'image/png' ? 'png' : 'jpg';
    return { uri: a.uri, name: `upload.${ext}`, type: mime };
  };

  const submitIdentity = async () => {
    if (!docNumber || !front) {
      Alert.alert('Incomplete', 'Enter your document number and upload the front image.');
      return;
    }
    setSaving(true);
    try {
      await kycService.identity({
        document_type: docType,
        document_number: docNumber,
        front_image: front,
        back_image: back ?? undefined,
      });
      Alert.alert('Submitted', 'Identity documents submitted for review.');
      setStep(2);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not submit identity documents.');
    } finally { setSaving(false); }
  };

  const submitSelfie = async () => {
    if (!selfie) {
      Alert.alert('Incomplete', 'Capture a selfie first.');
      return;
    }
    setSaving(true);
    try {
      await kycService.selfie(selfie);
      Alert.alert('Submitted', 'Selfie submitted for review.');
      setStep(3);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not submit selfie.');
    } finally { setSaving(false); }
  };

  const submitContact = async () => {
    if (!contact.full_name || !contact.phone_number || (contact.relationship === 'other' && !contact.other_relationship)) {
      Alert.alert('Incomplete', 'Fill all required fields.');
      return;
    }
    if (!/^\+?[1-9]\d{6,14}$/.test(contact.phone_number.trim())) {
      Alert.alert('Invalid phone', 'Use international format, e.g. +2348012345678.');
      return;
    }
    setSaving(true);
    try {
      await kycService.emergencyContact(contact);
      Alert.alert('Saved', 'Emergency contact saved. You can now submit for review.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not save emergency contact.');
    } finally { setSaving(false); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title={step === 1 ? 'Identity Verification' : step === 2 ? 'Selfie' : 'Emergency Contact'} />

      {step === 1 && (
        <>
          <Text style={styles.label}>Document Type *</Text>
          <View style={styles.chipWrap}>
            {DOC_TYPES.map((d) => (
              <Chip key={d.value} label={d.label} on={docType === d.value} onPress={() => setDocType(d.value)} />
            ))}
          </View>
          <Text style={styles.label}>Document Number *</Text>
          <TextInput style={styles.input} value={docNumber} onChangeText={setDocNumber} placeholder="e.g. NIN number" placeholderTextColor={colors.neutral[300]} />
          <Text style={styles.label}>Front Image * (≤5MB, jpg/png/pdf)</Text>
          <TouchableOpacity style={styles.picker} onPress={async () => setFront(await pickImage(false))} activeOpacity={0.8}>
            {front ? <Image source={{ uri: front.uri }} style={styles.preview} /> : <Text style={styles.pickerText}>Tap to upload front image</Text>}
          </TouchableOpacity>
          <Text style={styles.label}>Back Image (optional)</Text>
          <TouchableOpacity style={styles.picker} onPress={async () => setBack(await pickImage(false))} activeOpacity={0.8}>
            {back ? <Image source={{ uri: back.uri }} style={styles.preview} /> : <Text style={styles.pickerText}>Tap to upload back image</Text>}
          </TouchableOpacity>
          <Button title={saving ? 'Submitting…' : 'Continue'} onPress={submitIdentity} loading={saving} fullWidth size="lg" />
        </>
      )}

      {step === 2 && (
        <>
          <Text style={styles.hint}>Take a clear photo of your face in good lighting. The photo is compared with your ID for review.</Text>
          <TouchableOpacity style={styles.picker} onPress={async () => setSelfie(await pickImage(true))} activeOpacity={0.8}>
            {selfie ? <Image source={{ uri: selfie.uri }} style={styles.preview} /> : <Text style={styles.pickerText}>Tap to capture selfie</Text>}
          </TouchableOpacity>
          <Button title={saving ? 'Submitting…' : 'Submit Selfie'} onPress={submitSelfie} loading={saving} fullWidth size="lg" />
        </>
      )}

      {step === 3 && (
        <>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput style={styles.input} value={contact.full_name} onChangeText={(t) => setContact({ ...contact, full_name: t })} placeholderTextColor={colors.neutral[300]} />
          <Text style={styles.label}>Phone Number *</Text>
          <TextInput style={styles.input} value={contact.phone_number} keyboardType="phone-pad" onChangeText={(t) => setContact({ ...contact, phone_number: t })} placeholder="+2348012345678" placeholderTextColor={colors.neutral[300]} />
          <Text style={styles.label}>Relationship *</Text>
          <View style={styles.chipWrap}>
            {RELATIONSHIPS.map((r) => (
              <Chip key={r} label={r[0].toUpperCase() + r.slice(1)} on={contact.relationship === r}
                onPress={() => setContact({ ...contact, relationship: r })} />
            ))}
          </View>
          {contact.relationship === 'other' && (
            <>
              <Text style={styles.label}>Specify Relationship *</Text>
              <TextInput style={styles.input} value={contact.other_relationship} onChangeText={(t) => setContact({ ...contact, other_relationship: t })} placeholderTextColor={colors.neutral[300]} />
            </>
          )}
          <Button title={saving ? 'Saving…' : 'Save Contact'} onPress={submitContact} loading={saving} fullWidth size="lg" />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 56, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '500', color: colors.neutral[600], marginBottom: 6, marginTop: 12 },
  hint: { fontSize: 13, color: colors.neutral[500], marginBottom: 12 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, padding: 14, fontSize: 16, color: colors.secondary[500] },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  picker: {
    height: 160, borderRadius: theme.radius.lg, borderWidth: 1, borderStyle: 'dashed',
    borderColor: colors.neutral[300], backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  pickerText: { color: colors.neutral[400], fontSize: 14 },
  preview: { width: '100%', height: '100%', resizeMode: 'cover' },
});
