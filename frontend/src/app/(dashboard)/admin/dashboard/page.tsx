"use client";

import Link from "next/link";
import {
  Users,
  Package,
  Wallet,
  Shield,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatsSkeleton } from "@/components/shared/SkeletonLoader";
import { useAdminDashboard } from "@/hooks/queries/admin/use-admin";

export default function AdminDashboardPage() {
  const { data: stats, isLoading, error } = useAdminDashboard();

  if (isLoading) return <StatsSkeleton cards={4} />;
  if (error || !stats) {
    return (
      <div className="max-w-6xl space-y-8">
        <div>
          <h1 className="text-[32px] font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-base text-muted-foreground mt-1">Platform overview and operational metrics</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">Could not load dashboard</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {error ? "An error occurred fetching dashboard data." : "No data available."}
            </p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-base text-muted-foreground mt-1">
          Platform overview and operational metrics
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users?.total?.toLocaleString() ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.users?.active ?? "—"} active · {stats.users?.requesters ?? "—"} requesters · {stats.users?.erranders ?? "—"} erranders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-[#10B981]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.requests?.total?.toLocaleString() ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.requests?.completed ?? "—"} completed · {stats.requests?.completion_rate ?? "—"}% rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#F97316]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{stats.finances?.total_payments?.toLocaleString() ?? "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ₦{stats.finances?.platform_revenue?.toLocaleString() ?? "—"} platform revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Disputes</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.disputes?.pending ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">Open disputes requiring review</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <Link href="/admin/kyc">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="pt-5">
                <Shield className="w-8 h-8 text-[#F97316] mb-2" />
                <h3 className="font-semibold text-sm">Review KYC</h3>
                <p className="text-xs text-muted-foreground">Verify errander documents</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/users">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="pt-5">
                <Users className="w-8 h-8 text-primary mb-2" />
                <h3 className="font-semibold text-sm">Manage Users</h3>
                <p className="text-xs text-muted-foreground">View and manage accounts</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/wallet">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="pt-5">
                <Wallet className="w-8 h-8 text-[#10B981] mb-2" />
                <h3 className="font-semibold text-sm">View Withdrawals</h3>
                <p className="text-xs text-muted-foreground">Process payout requests</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/disputes">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="pt-5">
                <AlertTriangle className="w-8 h-8 text-[#EF4444] mb-2" />
                <h3 className="font-semibold text-sm">Disputes</h3>
                <p className="text-xs text-muted-foreground">Resolve complaints</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
