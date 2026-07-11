import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../src/store/authStore';

const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  useEffect(() => { restoreSession(); }, []);

  // Redirect unverified users to email verification
  useEffect(() => {
    if (!isLoading && isAuthenticated && user && !user.email_verified) {
      router.replace('/(auth)/verify-email');
    }
  }, [isLoading, isAuthenticated, user]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        {isLoading ? (
          <Stack.Screen name="splash" options={{ animation: 'none' }} />
        ) : isAuthenticated ? (
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        ) : (
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        )}
      </Stack>
    </QueryClientProvider>
  );
}
