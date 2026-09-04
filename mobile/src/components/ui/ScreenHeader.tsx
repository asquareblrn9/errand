import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { colors, theme } from '../../theme';

/** Standard screen header: back chevron + title + optional right action. */
export function ScreenHeader({
  title,
  right,
  style,
}: {
  title: string;
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.header, style]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Text style={styles.backIcon}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  backBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#E9ECEF', alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 22, color: '#0A1628', marginTop: -2, fontFamily: theme.fontFamily.heading },
  title: { flex: 1, fontFamily: theme.fontFamily.heading, fontSize: 17, fontWeight: '700', color: '#0A1628', letterSpacing: -0.1 },
  right: { minWidth: 32, alignItems: 'flex-end' },
});
