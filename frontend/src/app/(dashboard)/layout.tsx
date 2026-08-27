"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { PageHeaderProvider } from "@/components/layout/PageHeaderContext";
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
  const [menuOpen, setMenuOpen] = useState(false);
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
    <PageHeaderProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col lg:pl-[252px]">
          <Header onMenuClick={() => setMenuOpen(true)} />
          <main className="min-h-screen flex-1 p-7">
            <div className="mx-auto max-w-[1200px]">{children}</div>
          </main>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <Sidebar mobile onNavigate={() => setMenuOpen(false)} />
        </div>
      )}
    </PageHeaderProvider>
  );
}
