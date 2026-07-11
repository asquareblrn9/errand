import { useState } from 'react';
import { TextInput, Text, View, StyleSheet, Pressable, type TextInputProps } from 'react-native';
import { colors, theme } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string; error?: string;
}

function PasswordVisibilityIcon({ hidden }: { hidden: boolean }) {
  return (
    <View style={styles.eyeIcon}>
      <View style={styles.eyeOutline}>
        <View style={styles.eyePupil} />
      </View>
      {hidden && <View style={styles.eyeSlash} />}
    </View>
  );
}

export function Input({ label, error, style, secureTextEntry, ...props }: InputProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPasswordInput = !!secureTextEntry;

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputShell}>
        <TextInput
          style={[styles.input, isPasswordInput && styles.passwordInput, error && styles.errorBorder, style]}
          placeholderTextColor={colors.neutral[300]}
          secureTextEntry={isPasswordInput ? !passwordVisible : secureTextEntry}
          {...props}
        />
        {isPasswordInput && (
          <Pressable
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={styles.eyeButton}
          >
            <PasswordVisibilityIcon hidden={!passwordVisible} />
          </Pressable>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: colors.neutral[600], marginBottom: 6 },
  inputShell: { position: 'relative' },
  input: {
    height: 48, borderRadius: theme.radius.md, borderWidth: 1, borderColor: colors.neutral[200],
    paddingHorizontal: 16, fontSize: 16, color: colors.neutral[600],
    backgroundColor: colors.white,
  },
  passwordInput: { paddingRight: 48 },
  eyeButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 48,
  },
  eyeIcon: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    position: 'relative',
    width: 24,
  },
  eyeOutline: {
    alignItems: 'center',
    borderColor: colors.neutral[400],
    borderRadius: 10,
    borderWidth: 1.5,
    height: 14,
    justifyContent: 'center',
    width: 22,
  },
  eyePupil: {
    backgroundColor: colors.neutral[400],
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  eyeSlash: {
    backgroundColor: colors.neutral[400],
    borderRadius: 1,
    height: 2,
    position: 'absolute',
    transform: [{ rotate: '-45deg' }],
    width: 26,
  },
  errorBorder: { borderColor: colors.error },
  error: { fontSize: 12, color: colors.error, marginTop: 4 },
});
