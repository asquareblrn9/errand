"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Mail, Gavel, Shield, Package, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ListSkeleton } from "@/components/shared/SkeletonLoader";
import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";

interface Notification {
  id: string;
  action: string;
  message: string;
  read: boolean;
  created_at: string;
}

function eventIcon(action: string) {
  if (action?.startsWith("bid")) return Gavel;
  if (action?.startsWith("kyc")) return Shield;
  if (action?.startsWith("request")) return Package;
  if (action?.startsWith("delivery")) return Package;
  if (action?.startsWith("dispute")) return AlertTriangle;
  return Bell;
}

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Notification[]>>("/notifications");
      return data.data;
    },
  });

  // Mark all as read when visiting this page
  useEffect(() => {
    api.post("/notifications/mark-read").then(() => {
      qc.invalidateQueries({ queryKey: ["notifications", "count"] });
    }).catch(() => {});
  }, [qc]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Notifications</h1>
        <p className="text-base text-muted-foreground mt-1">
          Recent activity and updates
        </p>
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No notifications</h3>
            <p className="text-sm text-muted-foreground">
              You're all caught up. Notifications about bids, KYC, and requests will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {notifications.map((n) => {
              const Icon = eventIcon(n.action);
              return (
                <div key={n.id} className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
