import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { colors, theme } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleAuthScreen() {
  const googleLogin = useAuthStore((s) => s.googleLogin);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    // These should be set via app.json extra or env vars in production
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      setLoading(true);
      setError('');
      googleLogin(id_token)
        .then(() => router.replace('/(tabs)'))
        .catch(() => {
          setError('Google sign-in failed. Please try again.');
          setLoading(false);
        });
    } else if (response?.type === 'error') {
      setError('Google sign-in was cancelled or failed.');
    }
  }, [response]);

  const handlePress = () => {
    if (request) {
      promptAsync();
    } else {
      setError('Google Sign-In is not configured. Add EXPO_PUBLIC_GOOGLE_CLIENT_ID to your environment.');
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Signing in with Google...</Text>
        </View>
      ) : (
        <>
          <Text style={styles.title}>Google Sign-In</Text>
          <Text style={styles.desc}>Use your Google account to sign in or create an account.</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.googleBtn} onPress={handlePress}>
            <Text style={styles.googleBtnText}>G</Text>
            <Text style={styles.googleBtnLabel}>Sign in with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>Back to login</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg },
  centered: { alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 16, color: colors.neutral[400] },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.neutral[600], textAlign: 'center', marginBottom: 8 },
  desc: { fontSize: 16, color: colors.neutral[400], textAlign: 'center', marginBottom: 32 },
  error: { backgroundColor: '#FEE2E2', color: colors.error, padding: 12, borderRadius: theme.radius.md, marginBottom: 16, fontSize: 14, textAlign: 'center' },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: theme.radius.md, paddingVertical: 14, gap: 10 },
  googleBtnText: { fontSize: 20, fontWeight: 'bold', color: '#4285F4' },
  googleBtnLabel: { fontSize: 16, fontWeight: '500', color: colors.neutral[600] },
  backBtn: { alignItems: 'center', marginTop: 32 },
  backText: { color: colors.neutral[400], fontSize: 14 },
});
