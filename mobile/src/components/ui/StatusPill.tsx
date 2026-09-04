import { View, Text, StyleSheet, ViewStyle } from 'react-native';

/**
 * Status pill — mirrors the web's StatusBadge/statusTone map
 * (frontend/src/components/design/StatusBadge.tsx).
 */
type Tone = 'green' | 'orange' | 'blue' | 'grey';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: '#E6F9F0', fg: '#00633F' },
  orange: { bg: '#FFF1E6', fg: '#B24E00' },
  blue: { bg: '#E8F0FF', fg: '#1D4FB8' },
  grey: { bg: '#E9ECEF', fg: '#495057' },
};

export function statusTone(status: string): Tone {
  switch (status) {
    case 'completed':
    case 'paid out':
    case 'funds_released':
    case 'delivered':
    case 'confirmed':
    case 'successful':
    case 'active':
    case 'in_transit':
      return 'green';
    case 'in_progress':
    case 'payment_made':
    case 'escrowed':
    case 'escrow_hold':
    case 'assigned':
    case 'accepted':
    case 'pending_pickup':
      return 'orange';
    case 'disputed':
    case 'dispute_window':
    case 'bids_open':
      return 'blue';
    default:
      return 'grey';
  }
}

export function StatusPill({ status, label, style }: { status: string; label?: string; style?: ViewStyle }) {
  const tone = TONES[statusTone(status)];
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }, style]}>
      <Text style={[styles.text, { color: tone.fg }]}>{label ?? status.replace(/_/g, ' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
});
