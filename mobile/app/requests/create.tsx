import { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Switch, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { colors, theme } from "../../src/theme";
import { requestService } from "../../src/services/requestService";
import api from "../../src/services/api";
import type { Category } from "../../src/types/request";

interface PlacePrediction {
  place_id: string;
  description: string;
}

const DEADLINE_OPTIONS = [
  { label: "ASAP", value: "" },
  { label: "30 min", value: "30" },
  { label: "1 hour", value: "60" },
  { label: "2 hours", value: "120" },
  { label: "3 hours", value: "180" },
  { label: "6 hours", value: "360" },
  { label: "1 day", value: "1440" },
];

export default function CreateRequestScreen() {
  const params = useLocalSearchParams<{ category_id?: string; category_name?: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    title: "", description: "", category_id: params.category_id ?? "",
    location: "", latitude: 0, longitude: 0,
    budget_hint: "", sla_minutes: "", is_urgent: false,
  });
  const [loading, setLoading] = useState(false);

  // ── Google Places Autocomplete ──────────────────────────
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLocationChange = (text: string) => {
    setForm({ ...form, location: text });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLocationLoading(true);
      try {
        const res = await api.get(`/places/autocomplete?input=${encodeURIComponent(text)}`);
        const data = res.data;
        if (data.predictions?.length) {
          setPredictions(data.predictions);
          setShowPredictions(true);
        }
      } catch { /* ignore */ }
      finally { setLocationLoading(false); }
    }, 400);
  };

  const selectPlace = async (prediction: PlacePrediction) => {
    setForm({ ...form, location: prediction.description, latitude: 0, longitude: 0 });
    setShowPredictions(false);
    setPredictions([]);
    try {
      const res = await api.get(`/places/details?place_id=${prediction.place_id}`);
      const loc = res.data?.location;
      if (loc) {
        setForm((prev) => ({ ...prev, latitude: loc.lat, longitude: loc.lng }));
      }
    } catch { /* use defaults */ }
  };

  useEffect(() => { requestService.categories().then(({ data }) => setCategories(data.data)); }, []);

  const handleSubmit = async () => {
    if (!form.title || !form.description || !form.category_id) {
      Alert.alert("Required", "Please fill in title, details, and category."); return;
    }
    if (!form.location) {
      Alert.alert("Required", "Please select a location."); return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        budget_hint: form.budget_hint ? parseFloat(form.budget_hint) : null,
        sla_minutes: form.sla_minutes ? parseInt(form.sla_minutes, 10) : null,
        latitude: form.latitude || 6.5244,
        longitude: form.longitude || 3.3792,
      };
      const { data } = await requestService.create(payload);
      router.replace(`/requests/${data.data.id}`);
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to create request.");
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Topbar */}
          <View style={styles.topbar}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>New errand</Text>
          </View>

          <Text style={styles.label}>What do you need done?</Text>
          <TextInput style={styles.field} value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} placeholder="Pick up groceries from Shoprite" placeholderTextColor={colors.neutral[300]} />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {categories.map((c) => (
              <TouchableOpacity key={c.id} style={[styles.chip, form.category_id === c.id && styles.chipActive]}
                onPress={() => setForm({ ...form, category_id: c.id })}>
                <Text style={[styles.chipText, form.category_id === c.id && styles.chipActiveText]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Details</Text>
          <TextInput style={[styles.field, styles.textarea]} value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} placeholder="What exactly do you need? The list will be shared in chat." placeholderTextColor={colors.neutral[300]} multiline numberOfLines={4} />

          <Text style={styles.label}>Your budget (₦, optional)</Text>
          <TextInput style={styles.field} value={form.budget_hint} onChangeText={(t) => setForm({ ...form, budget_hint: t })} keyboardType="numeric" placeholder="₦ 5,000" placeholderTextColor={colors.neutral[300]} />

          {/* Location with Places Autocomplete */}
          <View style={{ zIndex: 10 }}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.field}
              value={form.location}
              onChangeText={handleLocationChange}
              placeholder="Search for a location..."
              placeholderTextColor={colors.neutral[300]}
              onFocus={() => predictions.length > 0 && setShowPredictions(true)}
            />
            {locationLoading && <ActivityIndicator style={{ position: "absolute", right: 16, top: 40 }} color={colors.primary[500]} />}
            {showPredictions && predictions.length > 0 && (
              <View style={styles.predictionList}>
                {predictions.map((p) => (
                  <TouchableOpacity key={p.place_id} style={styles.predictionItem}
                    onPress={() => selectPlace(p)}>
                    <Text style={styles.predictionText} numberOfLines={2}>{p.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {form.location !== '' && (
            <View style={styles.locationCard}>
              <View style={styles.locationRow}>
                <Text style={styles.locationPin}>⌖</Text>
                <Text style={styles.locationText} numberOfLines={1}>Pickup — {form.location}</Text>
              </View>
            </View>
          )}

          <Text style={styles.label}>When do you need this by?</Text>
          <View style={styles.chipRow}>
            {DEADLINE_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt.label} style={[styles.chip, form.sla_minutes === opt.value && styles.chipActive]}
                onPress={() => setForm({ ...form, sla_minutes: opt.value })}>
                <Text style={[styles.chipText, form.sla_minutes === opt.value && styles.chipActiveText]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.urgentRow}>
            <View>
              <Text style={styles.urgentTitle}>Urgent (+₦1,500)</Text>
              <Text style={styles.urgentDesc}>Get faster responses</Text>
            </View>
            <Switch value={form.is_urgent} onValueChange={(v) => setForm({ ...form, is_urgent: v })} trackColor={{ true: colors.primary[300] }} thumbColor={form.is_urgent ? colors.primary[500] : colors.neutral[200]} />
          </View>
        </ScrollView>

        {/* Sticky CTA */}
        <View style={styles.stickyCta}>
          <TouchableOpacity style={styles.submitBtn} activeOpacity={0.85} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.submitBtnText}>{loading ? 'Posting…' : 'Post errand'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.neutral[50] },
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 26 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  backBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.neutral[100], alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: colors.secondary[500], marginTop: -2 },
  title: { fontSize: 17, fontWeight: '700', color: colors.secondary[500], letterSpacing: -0.1 },
  label: { fontSize: 11.5, color: colors.neutral[500], fontWeight: '600', marginBottom: 6 },
  field: { backgroundColor: colors.neutral[100], borderWidth: 1, borderColor: colors.neutral[100], borderRadius: 13, padding: 13, fontSize: 13.5, color: colors.secondary[500], marginBottom: 13 },
  textarea: { minHeight: 84, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 13 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 100, backgroundColor: colors.neutral[100], borderWidth: 1, borderColor: colors.neutral[100] },
  chipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.secondary[500] },
  chipActiveText: { color: colors.white },
  predictionList: { backgroundColor: colors.white, borderRadius: 13, borderWidth: 1, borderColor: colors.neutral[200], marginTop: -9, marginBottom: 13, maxHeight: 200, overflow: 'hidden' },
  predictionItem: { padding: 13, borderBottomWidth: 1, borderBottomColor: colors.neutral[100] },
  predictionText: { fontSize: 13.5, color: colors.secondary[500] },
  locationCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[100], borderRadius: 18, padding: 14, marginBottom: 13 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationPin: { fontSize: 15, color: colors.accent[500] },
  locationText: { fontSize: 13, color: colors.secondary[500], flex: 1 },
  urgentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 8, padding: 16, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.neutral[100] },
  urgentTitle: { fontSize: 13, fontWeight: '600', color: colors.secondary[500] },
  urgentDesc: { fontSize: 11.5, color: colors.neutral[400], marginTop: 2 },
  stickyCta: { padding: 20, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.neutral[100] },
  submitBtn: { backgroundColor: colors.primary[500], borderRadius: 15, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
});
