"use client";

import { useQuery } from "@tanstack/react-query";
import { Package, Clock, AlertTriangle, Timer, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/SkeletonLoader";
import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";

interface AdminErrand {
  id: string;
  title: string;
  status: string;
  requester: string;
  errander: string | null;
  category: string;
  amount: number;
  bid_status: string;
  sla_minutes: number | null;
  started_at: string | null;
  deadline_at: string | null;
  minutes_remaining: number;
  is_late: boolean;
  is_over_threshold: boolean;
  late_fee_accrued: number;
  created_at: string;
}

export default function AdminErrandsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "errands"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AdminErrand[]>>("/admin/errands");
      return data.data;
    },
  });

  const errands = data ?? [];

  if (error) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="text-[32px] font-bold text-foreground">Active Errands</h1>
          <p className="text-base text-muted-foreground mt-1">Monitor all active errands</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <AlertTriangle className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-1">Could not load errands</h3>
            <p className="text-sm text-muted-foreground mb-4">An error occurred fetching data.</p>
            <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Active Errands</h1>
        <p className="text-base text-muted-foreground mt-1">
          Monitor all active errands, SLA timers, and overdue tasks
        </p>
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : errands.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-1">No active errands</h3>
            <p className="text-sm text-muted-foreground">All errands have been completed or no errands are in progress.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {errands.map((errand) => (
            <Card key={errand.id} className={errand.is_late ? "border-[#EF4444]/30" : ""}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{errand.title}</h3>
                      <Badge variant={errand.is_late ? "destructive" : "secondary"}>{errand.status}</Badge>
                      {errand.bid_status && <Badge variant="outline">{errand.bid_status.replace("_", " ")}</Badge>}
                      {errand.is_over_threshold && <Badge variant="warning">Can Cancel</Badge>}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Requester:</span>
                        <span className="font-medium truncate">{errand.requester}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Errander:</span>
                        <span className="font-medium truncate">{errand.errander || "—"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Category:</span>
                        <span className="font-medium">{errand.category}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-medium">₦{errand.amount?.toLocaleString() ?? "—"}</span>
                      </div>
                    </div>

                    {/* SLA Timer */}
                    {errand.started_at && (
                      <div className="flex items-center gap-3 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Timer className={`w-4 h-4 ${errand.is_late ? "text-[#EF4444]" : "text-[#10B981]"}`} />
                          <span className={`text-sm font-mono font-bold ${errand.is_late ? "text-[#EF4444]" : "text-[#10B981]"}`}>
                            {errand.minutes_remaining <= 0
                              ? `+${Math.abs(errand.minutes_remaining)}min OVERDUE`
                              : `${errand.minutes_remaining}min remaining`}
                          </span>
                        </div>
                        <div className="w-full max-w-[200px] h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${errand.is_over_threshold ? "bg-[#EF4444]" : "bg-primary"}`}
                            style={{ width: `${Math.min(100, ((errand.sla_minutes ?? 1) - errand.minutes_remaining) / (errand.sla_minutes ?? 1) * 100)}%` }}
                          />
                        </div>
                        {errand.late_fee_accrued > 0 && (
                          <span className="text-xs text-[#EF4444] font-medium">Late: ₦{errand.late_fee_accrued}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    Created {new Date(errand.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
