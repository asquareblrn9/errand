"use client";

import Link from "next/link";
import {
  Package,
  AlertTriangle,
  DollarSign,
  TrendingDown,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  UserCheck,
  UserX,
  Wallet,
  ArrowUpDown,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatsSkeleton } from "@/components/shared/SkeletonLoader";
import { useAdminDashboard } from "@/hooks/queries/admin/use-admin";

interface StatCard {
  key: string;
  label: string;
  value: number;
  format: "currency" | "number";
  route: string;
}

const ICON_MAP: Record<string, React.ElementType> = {
  total_revenue: DollarSign,
  total_earnings: TrendingDown,
  platform_fees: BarChart3,
  completed_jobs: CheckCircle2,
  active_jobs: Clock,
  pending_jobs: Package,
  cancelled_jobs: XCircle,
  total_requesters: Users,
  total_erranders: Users,
  active_users: UserCheck,
  suspended_users: UserX,
  disputed_jobs: AlertTriangle,
  total_withdrawals: Wallet,
  successful_txns: ArrowUpDown,
  failed_txns: ArrowUpDown,
};

const COLOR_MAP: Record<string, string> = {
  total_revenue: "bg-[#10B981]/10 text-[#10B981]",
  total_earnings: "bg-primary/10 text-primary",
  platform_fees: "bg-[#F97316]/10 text-[#F97316]",
  completed_jobs: "bg-[#10B981]/10 text-[#10B981]",
  active_jobs: "bg-primary/10 text-primary",
  pending_jobs: "bg-[#F97316]/10 text-[#F97316]",
  cancelled_jobs: "bg-destructive/10 text-destructive",
  total_requesters: "bg-primary/10 text-primary",
  total_erranders: "bg-[#10B981]/10 text-[#10B981]",
  active_users: "bg-[#10B981]/10 text-[#10B981]",
  suspended_users: "bg-[#F97316]/10 text-[#F97316]",
  disputed_jobs: "bg-destructive/10 text-destructive",
  total_withdrawals: "bg-primary/10 text-primary",
  successful_txns: "bg-[#10B981]/10 text-[#10B981]",
  failed_txns: "bg-destructive/10 text-destructive",
};

function formatValue(value: number, format: "currency" | "number"): string {
  if (format === "currency") return `₦${value.toLocaleString()}`;
  return value.toLocaleString();
}

export default function AdminDashboardPage() {
  const { data, isLoading, error } = useAdminDashboard();
  const stats: StatCard[] = data?.stats ?? [];
  const rates = data?.rates;

  if (isLoading) return <StatsSkeleton cards={4} />;

  if (error) {
    return (
      <div className="max-w-6xl space-y-8">
        <div>
          <h1 className="text-[32px] font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-base text-muted-foreground mt-1">Platform overview</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">Could not load dashboard</h3>
            <p className="text-sm text-muted-foreground mb-1">{error.message}</p>
            <Button variant="outline" className="mt-2" onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats.length) {
    return (
      <div className="max-w-6xl space-y-8">
        <div>
          <h1 className="text-[32px] font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-base text-muted-foreground mt-1">Platform overview</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No data available</h3>
            <p className="text-sm text-muted-foreground">The dashboard is loading for the first time or no data exists yet.</p>
            <Button variant="outline" className="mt-2" onClick={() => window.location.reload()}>Refresh</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-base text-muted-foreground mt-1">Platform overview and operational metrics</p>
        </div>
        {rates && (
          <div className="flex gap-3 text-sm">
            <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground">
              {rates.completion_rate}% completion
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {stats.map((stat) => {
          const Icon = ICON_MAP[stat.key] ?? Package;
          const colorClass = COLOR_MAP[stat.key] ?? "bg-muted text-muted-foreground";

          return (
            <Link key={stat.key} href={stat.route}>
              <Card className="hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer h-full group">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      View →
                    </span>
                  </div>
                  <p className="text-2xl font-bold">{formatValue(stat.value, stat.format)}</p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{stat.label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
