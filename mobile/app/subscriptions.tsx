import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { colors, theme } from '../src/theme';
import api from '../src/services/api';
import type { ApiResponse } from '../src/types/api';

interface Plan { id: string; name: string; slug: string; monthly_price: number; annual_price: number; features: string[]; }
interface MySub { plan: { id: string; name: string; slug: string }; status: string; billing_cycle: string; expires_at: string; auto_renew: boolean; features: string[]; }

export default function SubscriptionsScreen() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [mySub, setMySub] = useState<MySub | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<ApiResponse<Plan[]>>('/plans'),
      api.get<ApiResponse<MySub>>('/my/subscription'),
    ]).then(([p, s]) => {
      setPlans(p.data.data as unknown as Plan[]);
      setMySub(s.data.data as unknown as MySub);
    }).finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (planId: string) => {
    try {
      const { data } = await api.post('/subscriptions', { plan_id: planId });
      setMySub(data.data as unknown as MySub);
    } catch (err: any) { Alert.alert('Error', err.response?.data?.message || 'Failed'); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Subscription Plans</Text>
      {mySub && <Text style={styles.current}>Current: {mySub.plan.name} • Expires {new Date(mySub.expires_at).toLocaleDateString()}</Text>}

      {plans.map((plan) => {
        const isCurrent = mySub?.plan.slug === plan.slug;
        return (
          <View key={plan.id} style={[styles.card, isCurrent && styles.cardCurrent]}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{plan.name}</Text>
              {isCurrent && <View style={styles.currentBadge}><Text style={styles.currentBadgeText}>Current</Text></View>}
            </View>
            <Text style={styles.price}>₦{plan.monthly_price.toLocaleString()}<Text style={styles.perMonth}>/mo</Text></Text>
            {plan.features.map((f) => <Text key={f} style={styles.feature}>✓ {f}</Text>)}
            {!isCurrent && <Button title={plan.monthly_price === 0 ? 'Free Plan' : 'Subscribe'} onPress={() => handleSubscribe(plan.id)} fullWidth variant={plan.monthly_price === 0 ? 'secondary' : 'primary'} />}
            {isCurrent && !mySub?.auto_renew && <Button title="Cancelled" variant="ghost" fullWidth />}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: theme.spacing.lg, paddingTop: 60, gap: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 4 },
  current: { fontSize: 14, color: colors.primary[500], marginBottom: 8 },
  card: { backgroundColor: colors.white, borderRadius: theme.radius.lg, padding: 20, borderWidth: 1, borderColor: colors.neutral[100] },
  cardCurrent: { borderColor: colors.primary[500], borderWidth: 2 },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  planName: { fontSize: 20, fontWeight: 'bold', color: colors.neutral[600] },
  currentBadge: { backgroundColor: colors.primary[100], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  currentBadgeText: { fontSize: 12, color: colors.primary[700], fontWeight: '600' },
  price: { fontSize: 32, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 12 },
  perMonth: { fontSize: 16, color: colors.neutral[400], fontWeight: '400' },
  feature: { fontSize: 14, color: colors.neutral[500], marginBottom: 6, paddingLeft: 4 },
});
