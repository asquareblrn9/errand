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

const schema = z.object({ email: z.string().email() });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const [sent, setSent] = useState(false);
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    await authService.forgotPassword(data.email);
    setSent(true);
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <Text style={styles.icon}>📧</Text>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.desc}>If an account exists, we've sent a 6-digit code.</Text>
        <Button title="Enter Reset Code" onPress={() => router.push('/(auth)/reset-password')} fullWidth size="lg" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.desc}>Enter your email to receive a verification code.</Text>
      <Controller name="email" control={control}
        render={({ field: { onChange, onBlur, value } }) => <Input label="Email" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" onChangeText={onChange} onBlur={onBlur} value={value} />}
      />
      <Button title="Send Code" onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth size="lg" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg },
  icon: { fontSize: 48, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], textAlign: 'center', marginBottom: 8 },
  desc: { fontSize: 16, color: colors.neutral[400], textAlign: 'center', marginBottom: 24 },
});
