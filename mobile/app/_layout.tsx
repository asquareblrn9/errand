import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme, Linking } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from "@expo-google-fonts/sora";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { JetBrainsMono_400Regular, JetBrainsMono_600SemiBold } from "@expo-google-fonts/jetbrains-mono";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "../src/store/authStore";

const queryClient = new QueryClient();
const SPLASH_TIMEOUT = 5000; // 5s max splash

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  // Load brand fonts (Sora headings / Inter body / JetBrains Mono amounts) —
  // matches the web design system.
  const [fontsLoaded] = useFonts({
    Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    JetBrainsMono_400Regular, JetBrainsMono_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  useEffect(() => {
    restoreSession();
    const timer = setTimeout(() => {
      const store = useAuthStore as any;
      if (store.setState) store.setState({ isLoading: false });
    }, SPLASH_TIMEOUT);
    return () => clearTimeout(timer);
  }, []);

  // Deep link handler — return to request after payment
  // e.g. errandboy://requests/{id}?payment_ref=EB-XXXX&status=successful
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      const match = url.match(/requests\/([a-f0-9-]+)(?:\?([^#]*))?/);
      if (!match) return;

      const [, requestId, query = ""] = match;
      const paymentRef = query
        .split("&")
        .map((pair) => pair.split("="))
        .find(([key]) => key === "payment_ref")?.[1];
      const status = query
        .split("&")
        .map((pair) => pair.split("="))
        .find(([key]) => key === "status")?.[1];

      const queryString = paymentRef
        ? `?payment_ref=${paymentRef}${status ? `&status=${status}` : ""}`
        : "";
      router.replace(`/requests/${requestId}${queryString}`);
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
