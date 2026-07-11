"use client";

import { useState } from "react";
import { useGetSessionsQuery, useRevokeSessionMutation } from "@/hooks/queries/auth/use-auth-mutations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Monitor, Smartphone, Globe, Loader2, X } from "lucide-react";

function deviceIcon(type: string | null) {
  switch (type) {
    case "mobile":
    case "android":
    case "ios":
      return <Smartphone className="w-4 h-4" />;
    case "desktop":
    case "web":
      return <Monitor className="w-4 h-4" />;
    default:
      return <Globe className="w-4 h-4" />;
  }
}

export function SessionsSection() {
  const { data: sessions, isLoading, error } = useGetSessionsQuery();
  const revokeMutation = useRevokeSessionMutation();
  const [message, setMessage] = useState("");

  const handleRevoke = async (id: string) => {
    setMessage("");
    try {
      await revokeMutation.mutateAsync(id);
      setMessage("Session revoked.");
    } catch {
      setMessage("Failed to revoke session.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Active Sessions</h2>
        <p className="text-sm text-muted-foreground">
          Manage your active login sessions across devices.
        </p>
      </div>

      {message && (
        <p className="text-sm text-primary">{message}</p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">Failed to load sessions.</p>
      ) : sessions && sessions.length > 0 ? (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between rounded-xl border border-border p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">
                  {deviceIcon(session.device_type)}
                </div>
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    {session.device_name || session.name || "Unknown Device"}
                    {session.is_current && (
                      <Badge variant="success" className="text-xs">Current</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.ip_address && `${session.ip_address} · `}
                    {session.last_used_at
                      ? `Last used ${new Date(session.last_used_at).toLocaleDateString()}`
                      : `Created ${new Date(session.created_at).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              {!session.is_current && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRevoke(session.id)}
                  disabled={revokeMutation.isPending}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label="Revoke session"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No active sessions found.
        </p>
      )}
    </div>
  );
}
