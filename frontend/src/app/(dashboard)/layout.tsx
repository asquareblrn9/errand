"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, fetchUser, token } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);
  const hasFetched = useRef(false);

  // Wait for Zustand persist to hydrate
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Fetch fresh user profile on mount (always, to refresh stale persisted data)
  useEffect(() => {
    if (hydrated && token && !hasFetched.current) {
      hasFetched.current = true;
      fetchUser();
    }
  }, [hydrated, token, fetchUser]);

  // Redirect if not authenticated
  useEffect(() => {
    if (hydrated && !token) {
      router.push("/login");
    }
  }, [hydrated, token, router]);

  // Redirect to email verification if not verified
  useEffect(() => {
    if (
      hydrated &&
      token &&
      user &&
      !user.email_verified &&
      pathname !== "/verify-email"
    ) {
      router.push(`/verify-email?email=${encodeURIComponent(user.email)}`);
    }
  }, [hydrated, token, user, router, pathname]);

  if (!hydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading your dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8 pt-20 lg:ml-64 min-h-screen">
          <div className="mt-15">{children}</div>
        </main>
      </div>
    </div>
  );
}
