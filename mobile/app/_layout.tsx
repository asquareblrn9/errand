import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme, Linking } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "../src/store/authStore";

const queryClient = new QueryClient();
const SPLASH_TIMEOUT = 5000; // 5s max splash

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    restoreSession();
    const timer = setTimeout(() => {
      const store = useAuthStore as any;
      if (store.setState) store.setState({ isLoading: false });
    }, SPLASH_TIMEOUT);
    return () => clearTimeout(timer);
  }, []);

  // Deep link handler — redirect back to request after payment
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      const match = url.match(/requests\/([a-f0-9-]+)\?payment_ref=(EB-[A-Z0-9]+)/);
      if (match) {
        const [, requestId] = match;
        router.replace(`/requests/${requestId}`);
      }
    };
    const sub = Linking.addEventListener("url", handleDeepLink);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && user?.email_verified) {
      router.replace("/(tabs)");
    } else if (isAuthenticated && user && !user.email_verified) {
      router.replace("/(auth)/verify-email");
    } else {
      router.replace("/(auth)/login");
    }
  }, [isLoading, isAuthenticated, user?.email_verified]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </QueryClientProvider>
  );
}
