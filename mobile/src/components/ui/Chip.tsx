import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, theme } from '../../theme';

/**
 * Pill toggle chip — mirrors the web Chip: on = navy bg + white text,
 * off = light outline (frontend/src/components/design/Chip.tsx).
 */
export function Chip({
  label,
  on,
  onPress,
  style,
  disabled,
}: {
  label: string;
  on: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        on ? styles.on : styles.off,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.text, on ? styles.textOn : styles.textOff]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  on: { backgroundColor: '#0A1628', borderColor: '#0A1628' },
  off: { backgroundColor: colors.white, borderColor: '#E9ECEF' },
  disabled: { opacity: 0.5 },
  text: { fontSize: 12.5, fontWeight: '700', fontFamily: theme.fontFamily.semibold },
  textOn: { color: colors.white },
  textOff: { color: '#0A1628' },
});
