"use client";

import { useQuery } from "@tanstack/react-query";
import { DollarSign, Users, Wallet, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminBreadcrumb } from "@/components/shared/AdminBreadcrumb";
import { ListSkeleton } from "@/components/shared/SkeletonLoader";
import api from "@/lib/api";

export default function ErranderEarningsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "errander-earnings"],
    queryFn: async () => {
      const res = await api.get("/admin/errander-earnings");
      return (res.data as any).data;
    },
  });

  if (isLoading) return <div className="max-w-6xl"><ListSkeleton rows={5} /></div>;
  if (error) return <div className="max-w-6xl"><Card><CardContent className="py-8 text-center text-destructive">Error loading earnings data</CardContent></Card></div>;

  const erranders = data?.erranders ?? [];
  const summary = data?.summary ?? {};

  return (
    <div className="max-w-6xl space-y-6">
      <AdminBreadcrumb items={[{ label: "Reports" }, { label: "Errander Earnings" }]} />
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Errander Earnings</h1>
        <p className="text-base text-muted-foreground mt-1">Earnings overview for all erranders</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><Users className="w-4 h-4 text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">Total Erranders</p><p className="text-xl font-bold">{summary.total_erranders ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><DollarSign className="w-4 h-4 text-[#10B981] mb-1" /><p className="text-xs text-muted-foreground">Total Paid Out</p><p className="text-xl font-bold text-[#10B981]">₦{summary.total_paid_out?.toLocaleString() ?? "0"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><Wallet className="w-4 h-4 text-[#F97316] mb-1" /><p className="text-xs text-muted-foreground">In Escrow</p><p className="text-xl font-bold text-[#F97316]">₦{summary.total_in_escrow?.toLocaleString() ?? "0"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><TrendingUp className="w-4 h-4 text-primary mb-1" /><p className="text-xs text-muted-foreground">Active Erranders</p><p className="text-xl font-bold">{summary.active_erranders ?? 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border"><th className="text-left py-2 px-4 text-xs uppercase text-muted-foreground">Errander</th><th className="text-left py-2 px-4 text-xs uppercase text-muted-foreground">Completed</th><th className="text-left py-2 px-4 text-xs uppercase text-muted-foreground">Total Earned</th><th className="text-left py-2 px-4 text-xs uppercase text-muted-foreground">Wallet</th><th className="text-left py-2 px-4 text-xs uppercase text-muted-foreground">KYC</th><th className="text-left py-2 px-4 text-xs uppercase text-muted-foreground">Status</th></tr></thead>
            <tbody>
              {erranders.map((e: any) => (
                <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-4 font-medium">{e.name}</td>
                  <td className="py-2 px-4">{e.completed_orders}</td>
                  <td className="py-2 px-4 text-[#10B981]">₦{e.total_earned?.toLocaleString()}</td>
                  <td className="py-2 px-4">₦{e.wallet_balance?.toLocaleString()}</td>
                  <td className="py-2 px-4"><Badge variant={e.kyc_tier >= 1 ? "success" : "warning"}>Tier {e.kyc_tier}</Badge></td>
                  <td className="py-2 px-4"><Badge variant={e.status === "active" ? "success" : "warning"}>{e.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
