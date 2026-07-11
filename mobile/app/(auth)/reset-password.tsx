import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { colors, theme } from '../../src/theme';
import { authService } from '../../src/services/authService';

const schema = z.object({
  email: z.string().email(), code: z.string().length(6),
  password: z.string().min(8), password_confirmation: z.string(),
}).refine((d) => d.password === d.password_confirmation, { message: 'Passwords do not match', path: ['password_confirmation'] });
type FormData = z.infer<typeof schema>;

export default function ResetPasswordScreen() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(''); setSuccess('');
    try {
      await authService.resetPassword(data);
      setSuccess('Password reset! Redirecting...');
      setTimeout(() => router.push('/(auth)/login'), 1500);
    } catch (err: any) { setError(err.response?.data?.message || 'Failed.'); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set New Password</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}
      <Controller name="email" control={control} render={({ field }) => <Input label="Email" placeholder="you@example.com" autoCapitalize="none" {...field} />} />
      <Controller name="code" control={control} render={({ field }) => <Input label="Verification Code" placeholder="000000" keyboardType="number-pad" maxLength={6} {...field} />} />
      <Controller name="password" control={control} render={({ field }) => <Input label="New Password" secureTextEntry {...field} />} />
      <Controller name="password_confirmation" control={control} render={({ field }) => <Input label="Confirm Password" secureTextEntry {...field} />} />
      <Button title="Reset Password" onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth size="lg" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], textAlign: 'center', marginBottom: 24 },
  error: { backgroundColor: '#FEE2E2', color: colors.error, padding: 12, borderRadius: theme.radius.md, marginBottom: 16 },
  success: { backgroundColor: '#DCFCE7', color: colors.success, padding: 12, borderRadius: theme.radius.md, marginBottom: 16 },
});
