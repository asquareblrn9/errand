import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Link, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { colors, theme } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';

const schema = z.object({
  login: z.string().min(1, 'Email or phone is required'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const completeLogin2FA = useAuthStore((s) => s.completeLogin2FA);
  const [error, setError] = useState('');
  const [step2FA, setStep2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);
  const googleEnabled = !!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      const { requires2FA } = await login(data);
      if (requires2FA) {
        setStep2FA(true);
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
    }
  };

  const submit2FA = async (code: string) => {
    if (code.length !== 6) return;
    setVerifying2FA(true);
    setError('');
    try {
      await completeLogin2FA(code);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid code. Please try again.');
      setTwoFactorCode('');
    } finally {
      setVerifying2FA(false);
    }
  };

  if (step2FA) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Two-Factor Authentication</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code from your authenticator app</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Input
            label="Authentication Code"
            placeholder="••••••"
            keyboardType="number-pad"
            maxLength={6}
            value={twoFactorCode}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, '').slice(0, 6);
              setTwoFactorCode(digits);
              if (digits.length === 6) submit2FA(digits);
            }}
          />

          <Button title={verifying2FA ? 'Verifying…' : 'Verify'} loading={verifying2FA} fullWidth size="lg"
            onPress={() => submit2FA(twoFactorCode)} />

          <TouchableOpacity onPress={() => { setStep2FA(false); setTwoFactorCode(''); setError(''); }}>
            <Text style={styles.forgot}>Back to sign in</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your ErrandGuy account</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Controller name="login" control={control}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Email or Phone Number" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" onChangeText={onChange} onBlur={onBlur} value={value} error={errors.login?.message} />
          )}
        />
        <Controller name="password" control={control}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Password" placeholder="••••••••" secureTextEntry onChangeText={onChange} onBlur={onBlur} value={value} error={errors.password?.message} />
          )}
        />

        <Button title="Sign In" onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth size="lg" />

        {googleEnabled && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.googleBtn} onPress={() => router.push('/(auth)/google-auth')}>
              <Text style={styles.googleBtnText}>G</Text>
              <Text style={styles.googleBtnLabel}>Sign in with Google</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
          <Text style={styles.forgot}>Forgot your password?</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" style={styles.link}>Create one</Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, container: { flexGrow: 1, justifyContent: 'center', padding: theme.spacing.lg },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.neutral[400] },
  error: { backgroundColor: '#FEE2E2', color: colors.error, padding: 12, borderRadius: theme.radius.md, marginBottom: 16, fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.neutral[200] },
  dividerText: { marginHorizontal: 12, color: colors.neutral[400], fontSize: 12, textTransform: 'uppercase' },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, paddingVertical: 12, gap: 10 },
  googleBtnText: { fontSize: 18, fontWeight: 'bold', color: '#4285F4' },
  googleBtnLabel: { fontSize: 15, fontWeight: '500', color: colors.neutral[600] },
  forgot: { textAlign: 'center', color: colors.primary[500], marginTop: 20, fontSize: 14, fontWeight: '500' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { color: colors.neutral[400], fontSize: 14 },
  link: { color: colors.primary[500], fontWeight: '600', fontSize: 14 },
});
