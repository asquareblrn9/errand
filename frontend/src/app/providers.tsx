"use client";

import { type ReactNode } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { QueryProvider } from "@/components/shared/QueryProvider";
import { ToastContainer } from "@/components/shared/Toast";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export function AppProviders({ children }: { children: ReactNode }) {
  const content = (
    <ErrorBoundary>
      <QueryProvider>
        {children}
        <ToastContainer />
      </QueryProvider>
    </ErrorBoundary>
  );

  // Only wrap with Google provider when a client ID is configured
  if (googleClientId) {
    return (
      <GoogleOAuthProvider clientId={googleClientId}>
        {content}
      </GoogleOAuthProvider>
    );
  }

  return content;
}
