import { useEffect, useRef } from "react";
import { Stack, router, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import * as Linking from "expo-linking";
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

  // Deep link routing — after payment the provider redirects to the backend
  // completion page, which deep-links back into the app:
  //  - errandboy://requests/{id}?payment_ref=EB-XXXX&status=successful
  //  - errandboy://wallet?payment_ref=FUND-XXXX&provider=paystack
  const pendingDeepLinkRef = useRef<Href | null>(null);

  const routePaymentDeepLink = (url: string): Href | null => {
    const { hostname, queryParams } = Linking.parse(url);
    const q = (queryParams ?? {}) as Record<string, string | undefined>;

    if (hostname === "wallet" && q.payment_ref) {
      const provider = q.provider === "flutterwave" ? "flutterwave" : "paystack";
      return `/wallet?payment_ref=${q.payment_ref}&provider=${provider}` as Href;
    }

    const match = url.match(/requests\/([a-f0-9-]+)(?:\?([^#]*))?/);
    if (!match) return null;

    const [, requestId, query = ""] = match;
    const pairs = query.split("&").map((pair) => pair.split("="));
    const paymentRef = pairs.find(([key]) => key === "payment_ref")?.[1];
    const status = pairs.find(([key]) => key === "status")?.[1];

    const queryString = paymentRef
      ? `?payment_ref=${paymentRef}${status ? `&status=${status}` : ""}`
      : "";
    return `/requests/${requestId}${queryString}` as Href;
  };

  // useLinkingURL gives the launch URL on cold start and re-renders on every
  // subsequent deep link, replacing both getInitialURL() and the url listener.
  const linkingUrl = Linking.useLinkingURL();

  useEffect(() => {
    if (!linkingUrl) return;
    const href = routePaymentDeepLink(linkingUrl);
    if (!href) return;

    const { isLoading: authLoading, isAuthenticated } = useAuthStore.getState();
    if (authLoading || !isAuthenticated) {
      // Session still restoring (or logged out) — apply after auth settles.
      pendingDeepLinkRef.current = href;
      return;
    }
    router.replace(href);
  }, [linkingUrl]);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && user?.email_verified) {
      if (pendingDeepLinkRef.current) {
        const href = pendingDeepLinkRef.current;
        pendingDeepLinkRef.current = null;
        router.replace(href);
      } else {
        router.replace("/(tabs)");
      }
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
