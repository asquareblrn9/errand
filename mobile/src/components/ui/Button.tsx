import { Pressable, Text, StyleSheet, ActivityIndicator, type PressableProps } from 'react-native';
import { colors, theme } from '../../theme';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string; variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg'; loading?: boolean; fullWidth?: boolean;
}

export function Button({ title, variant = 'primary', size = 'md', loading, fullWidth, disabled, ...props }: ButtonProps) {
  const height = { sm: 40, md: 48, lg: 56 }[size];
  const bg = { primary: colors.primary[500], secondary: 'transparent', ghost: 'transparent', danger: colors.error }[variant];
  const txtColor = variant === 'primary' || variant === 'danger' ? colors.white : colors.primary[500];
  const border = variant === 'secondary' ? { borderWidth: 1.5, borderColor: colors.primary[500] } : {};

  return (
    <Pressable
      style={({ pressed }) => [styles.base, { height, backgroundColor: bg, opacity: pressed ? 0.85 : 1, width: fullWidth ? '100%' as const : undefined }, border, (disabled || loading) && styles.disabled]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <ActivityIndicator color={txtColor} size="small" /> : <Text style={[styles.text, { color: txtColor, fontSize: size === 'sm' ? 14 : 16 }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  text: { fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
