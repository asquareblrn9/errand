import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Link, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { colors, theme } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';

const schema = z.object({
  name: z.string().min(2), email: z.string().email(), phone: z.string().regex(/^\+?[1-9]\d{6,14}$/),
  password: z.string().min(8).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^a-zA-Z0-9]/),
  password_confirmation: z.string(),
  role: z.enum(['requester', 'errander']),
}).refine((d) => d.password === d.password_confirmation, { message: 'Passwords do not match', path: ['password_confirmation'] });
type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
  const register = useAuthStore((s) => s.register);
  const [error, setError] = useState('');
  const { control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema), defaultValues: { role: 'requester' },
  });
  const role = watch('role');

  const onSubmit = async (data: FormData) => {
    setError('');
    try { await register(data); router.replace('/(auth)/verify-email'); }
    catch (err: any) { setError(err.response?.data?.message || 'Registration failed.'); }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join Errand Boy — get errands done or earn</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Controller name="name" control={control} render={({ field: { onChange, onBlur, value } }) => <Input label="Full Name" placeholder="John Doe" onChangeText={onChange} onBlur={onBlur} value={value} error={errors.name?.message} />} />
      <Controller name="email" control={control} render={({ field: { onChange, onBlur, value } }) => <Input label="Email" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" onChangeText={onChange} onBlur={onBlur} value={value} error={errors.email?.message} />} />
      <Controller name="phone" control={control} render={({ field: { onChange, onBlur, value } }) => <Input label="Phone" placeholder="+2348012345678" keyboardType="phone-pad" onChangeText={onChange} onBlur={onBlur} value={value} error={errors.phone?.message} />} />
      <Controller name="password" control={control} render={({ field: { onChange, onBlur, value } }) => <Input label="Password" placeholder="Min 8 chars, upper, lower, number, symbol" secureTextEntry onChangeText={onChange} onBlur={onBlur} value={value} error={errors.password?.message} />} />
      <Controller name="password_confirmation" control={control} render={({ field: { onChange, onBlur, value } }) => <Input label="Confirm Password" placeholder="••••••••" secureTextEntry onChangeText={onChange} onBlur={onBlur} value={value} error={errors.password_confirmation?.message} />} />

      <Text style={styles.roleLabel}>I want to...</Text>
      <View style={styles.roleRow}>
        <TouchableOpacity style={[styles.roleBtn, role === 'requester' && styles.roleActive]} onPress={() => {} /* setValue */}>
          <Text style={[styles.roleText, role === 'requester' && styles.roleActiveText]}>Post Requests</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.roleBtn, role === 'errander' && styles.roleActive]} onPress={() => {}}>
          <Text style={[styles.roleText, role === 'errander' && styles.roleActiveText]}>Earn Running Errands</Text>
        </TouchableOpacity>
      </View>

      <Button title="Create Account" onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth size="lg" />

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity style={styles.googleBtn} onPress={() => router.push('/(auth)/google-auth')}>
        <Text style={styles.googleBtnText}>G</Text>
        <Text style={styles.googleBtnLabel}>Sign up with Google</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Link href="/(auth)/login" style={styles.link}>Sign in</Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: theme.spacing.lg, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.neutral[400], marginBottom: 24 },
  errorText: { backgroundColor: '#FEE2E2', color: colors.error, padding: 12, borderRadius: theme.radius.md, marginBottom: 16, fontSize: 14 },
  roleLabel: { fontSize: 14, fontWeight: '500', color: colors.neutral[600], marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  roleBtn: { flex: 1, padding: 16, borderWidth: 2, borderColor: colors.neutral[200], borderRadius: theme.radius.md, alignItems: 'center' },
  roleActive: { borderColor: colors.primary[500], backgroundColor: colors.primary[100] },
  roleText: { fontSize: 14, color: colors.neutral[400], fontWeight: '500' },
  roleActiveText: { color: colors.primary[700] },
  divider: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.neutral[200] },
  dividerText: { marginHorizontal: 12, color: colors.neutral[400], fontSize: 12, textTransform: 'uppercase' },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, paddingVertical: 12, gap: 10 },
  googleBtnText: { fontSize: 18, fontWeight: 'bold', color: '#4285F4' },
  googleBtnLabel: { fontSize: 15, fontWeight: '500', color: colors.neutral[600] },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32, marginBottom: 40 },
  footerText: { color: colors.neutral[400], fontSize: 14 },
  link: { color: colors.primary[500], fontWeight: '600', fontSize: 14 },
});
