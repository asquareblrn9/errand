import { View, Text, StyleSheet, FlatList, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../src/components/ui/Button';
import { colors, theme } from '../../src/theme';

const { width } = Dimensions.get('window');

const slides = [
  { title: 'Get Errands Done', desc: 'Post a request and a verified errander handles it — with escrow protection.', icon: '📦' },
  { title: 'Earn Money', desc: 'Browse nearby requests, bid on jobs, and earn on your own schedule.', icon: '💰' },
  { title: 'Safe & Secure', desc: 'Every transaction is escrow-protected. Delivery confirmed by OTP.', icon: '🛡️' },
];

export default function OnboardingScreen() {
  return (
    <View style={styles.container}>
      <FlatList data={slides} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.desc}>{item.desc}</Text>
          </View>
        )}
      />
      <View style={styles.footer}>
        <Button title="Get Started" onPress={() => router.push('/(auth)/login')} fullWidth size="lg" />
        <Button title="Create Account" variant="secondary" onPress={() => router.push('/(auth)/register')} fullWidth size="lg" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  icon: { fontSize: 64, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.neutral[600], marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 16, color: colors.neutral[400], textAlign: 'center', lineHeight: 24 },
  footer: { padding: theme.spacing.lg, gap: 12 },
});
