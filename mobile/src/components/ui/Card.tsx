import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, theme } from '../../theme';

/**
 * Card — matches the web card: 20px radius, white, #E9ECEF border, soft shadow
 * (frontend/src/components/ui/card.tsx + design tokens).
 */
export function Card({
  children,
  style,
  title,
  meta,
  right,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  title?: string;
  meta?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={[styles.card, style]}>
      {(title || right) && (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            {title && <Text style={styles.title}>{title}</Text>}
            {meta && <Text style={styles.meta}>{meta}</Text>}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: theme.radius.lg,
    padding: 20,
    ...theme.cardShadow,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: theme.fontFamily.heading, fontSize: 15, fontWeight: '700', color: '#0A1628' },
  meta: { fontSize: 12.5, color: '#6C757D', marginTop: 2 },
});
