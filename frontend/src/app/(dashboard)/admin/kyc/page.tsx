"use client";

import Link from "next/link";
import { Shield, ArrowRight, CheckCircle2, Clock, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/SkeletonLoader";
import { useAdminKycPending } from "@/hooks/queries/kyc/use-kyc";
import type { KycStatus } from "@/types/api/kyc";

function statusBadge(status: KycStatus) {
  switch (status) {
    case "approved": return <Badge variant="success">Approved</Badge>;
    case "pending_review": return <Badge variant="warning">Pending</Badge>;
    case "under_review": return <Badge variant="default">Under Review</Badge>;
    case "rejected": return <Badge variant="destructive">Rejected</Badge>;
    case "requires_resubmission": return <Badge variant="warning">Resubmit</Badge>;
    default: return <Badge variant="secondary">Draft</Badge>;
  }
}

export default function AdminKycPage() {
  const { data: users = [], isLoading } = useAdminKycPending();

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-foreground">KYC Review Queue</h1>
        <p className="text-base text-muted-foreground mt-1">
          Review and manage user verification submissions
        </p>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No pending reviews</h3>
            <p className="text-sm text-muted-foreground">All KYC applications have been processed.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Link key={user.id} href={`/admin/kyc/${user.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{user.name}</h3>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Submitted {user.kyc_submitted_at ? new Date(user.kyc_submitted_at).toLocaleDateString() : "—"}
                      </span>
                      <Badge variant="outline" className="text-xs">{user.role}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {statusBadge(user.kyc_status)}
                    <Button variant="ghost" size="sm">
                      Review <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
