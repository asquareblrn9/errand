"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/shared/SkeletonLoader";
import { AlertCircle } from "lucide-react";
import { useMyDisputes } from "@/hooks/queries/disputes/use-disputes";
import type { DisputeListItem } from "@/types/api/disputes";

const statusVariant = (s: string) => {
  if (s.includes("resolved")) return "default" as const;
  if (s === "open" || s === "under_review") return "destructive" as const;
  return "secondary" as const;
};

export default function DisputesPage() {
  const { data: disputes = [], isLoading } = useMyDisputes();

  if (isLoading) return <ListSkeleton rows={3} />;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Disputes</h1>
      {disputes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No disputes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {disputes.map((d: DisputeListItem) => (
            <Link key={d.id} href={`/disputes/${d.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="pt-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{d.reason}</h3>
                    <p className="text-sm text-muted-foreground">
                      Raised by {d.raised_by?.name} • Errander: {d.errander?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={statusVariant(d.status)}>
                      {d.status.replace(/_/g, " ")}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(d.opened_at).toLocaleDateString()}
                    </p>
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
