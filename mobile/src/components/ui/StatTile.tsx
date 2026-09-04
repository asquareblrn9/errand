import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, theme } from '../../theme';

/**
 * Stat tile — mirrors the web StatTile
 * (frontend/src/components/design/StatTile.tsx): label + icon chip +
 * large value + delta line.
 */
export function StatTile({
  label,
  value,
  delta,
  icon,
  iconBg = '#E6F9F0',
  iconColor = '#00633F',
  style,
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.tile, style]}>
      <View style={styles.topRow}>
        <Text style={styles.label}>{label}</Text>
        {icon && (
          <View style={[styles.iconChip, { backgroundColor: iconBg }]}>
            <Text style={[styles.icon, { color: iconColor }]}>{icon}</Text>
          </View>
        )}
      </View>
      <Text style={styles.value}>{value}</Text>
      {delta && <Text style={styles.delta}>{delta}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: theme.radius.lg,
    padding: 16,
    ...theme.cardShadow,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontSize: 12.5, fontWeight: '600', color: '#6C757D', fontFamily: theme.fontFamily.medium },
  iconChip: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 16 },
  value: { fontFamily: theme.fontFamily.heading, fontSize: 25, fontWeight: '700', color: '#0A1628' },
  delta: { fontSize: 12, color: '#6C757D', marginTop: 4 },
});
