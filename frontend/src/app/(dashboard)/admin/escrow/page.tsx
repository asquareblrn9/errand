"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AdminBreadcrumb } from "@/components/shared/AdminBreadcrumb";
import { ListSkeleton } from "@/components/shared/SkeletonLoader";
import { Shield, AlertTriangle } from "lucide-react";
import api from "@/lib/api";

export default function AdminEscrowPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "escrow"],
    queryFn: async () => {
      const res = await api.get("/admin/escrow");
      return (res.data as any).data;
    },
  });

  if (isLoading) return <div className="max-w-6xl"><ListSkeleton rows={3} /></div>;
  if (error) return <div className="max-w-6xl"><Card><CardContent className="py-8 text-center text-destructive">Error loading escrow data</CardContent></Card></div>;

  const { summary, holds } = data ?? {};

  return (
    <div className="max-w-6xl space-y-6">
      <AdminBreadcrumb items={[{ label: "Financial" }, { label: "Escrow" }]} />
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Escrow Balances</h1>
        <p className="text-base text-muted-foreground mt-1">Active escrow holds and platform totals</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Held</p><p className="text-xl font-bold mt-1">₦{summary?.total_held?.toLocaleString() ?? "0"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Locked Wallets</p><p className="text-xl font-bold mt-1">₦{summary?.total_locked_wallets?.toLocaleString() ?? "0"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Payments</p><p className="text-xl font-bold mt-1">₦{summary?.total_payments?.toLocaleString() ?? "0"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active Escrows</p><p className="text-xl font-bold mt-1">{summary?.active_escrow_count ?? 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border"><th className="text-left py-2 px-4 text-xs uppercase text-muted-foreground">Requester</th><th className="text-left py-2 px-4 text-xs uppercase text-muted-foreground">Errander</th><th className="text-left py-2 px-4 text-xs uppercase text-muted-foreground">Amount</th><th className="text-left py-2 px-4 text-xs uppercase text-muted-foreground">Status</th><th className="text-left py-2 px-4 text-xs uppercase text-muted-foreground">Held Since</th></tr></thead>
            <tbody>
              {holds?.length > 0 ? holds.map((h: any) => (
                <tr key={h.id} className="border-b border-border/50 hover:bg-muted/30"><td className="py-2 px-4">{h.requester ?? "—"}</td><td className="py-2 px-4">{h.errander ?? "—"}</td><td className="py-2 px-4">₦{h.amount?.toLocaleString()}</td><td className="py-2 px-4"><Badge variant="warning">{h.status}</Badge></td><td className="py-2 px-4">{new Date(h.held_at).toLocaleDateString()}</td></tr>
              )) : (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No active escrow holds</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
