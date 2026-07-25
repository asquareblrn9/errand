"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/store/authStore";
import { useMyBids } from "@/hooks/queries/bids/use-bids";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/shared/SkeletonLoader";
import {
  Package,
  CheckCircle2,
  Star,
  ArrowRight,
  PlusCircle,
  Search,
  Shield,
  User,
  Timer,
} from "lucide-react";
import Link from "next/link";

/** Format an ISO date string into a readable "Month Year" display. */
function formatMemberSince(isoString: string | undefined | null): string {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString; // already formatted
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  } catch {
    return isoString;
  }
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: myBids } = useMyBids();

  const inProgressCount = useMemo(
    () => myBids?.filter((b) => b.status === "in_progress").length ?? 0,
    [myBids],
  );

  const memberSince = useMemo(
    () => user?.member_since || formatMemberSince(user?.created_at),
    [user?.member_since, user?.created_at],
  );

  if (!user) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-[32px] font-bold text-foreground">
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p className="text-base text-muted-foreground mt-1">
          {user.role === "requester" &&
            "Post requests and get errands done quickly."}
          {user.role === "errander" &&
            "Find requests near you and start earning."}
          {(user.role === "admin" || user.role === "super_admin") &&
            "Monitor platform activity and manage operations."}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed Orders
            </CardTitle>
            <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.completed_orders ?? 0}</div>
          </CardContent>
        </Card>

        {user.role === "errander" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Errands In Progress
              </CardTitle>
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Timer className="w-4 h-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inProgressCount}</div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              KYC Level
            </CardTitle>
            <div className="w-9 h-9 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
              <Star className="w-4 h-4 text-[#F97316]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">Tier {user.kyc_tier}</div>
              <Badge variant={user.kyc_tier >= 1 ? "success" : "warning"}>
                {user.kyc_tier >= 1 ? "Verified" : "Unverified"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Account Status
            </CardTitle>
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold capitalize">{user.status}</div>
              {!user.email_verified && (
                <Badge variant="warning" className="text-xs">
                  Verify Email
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Member Since
            </CardTitle>
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberSince}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions + Getting Started */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Role-Specific Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Quick Actions
            </CardTitle>
            <CardDescription>Get started with common tasks</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {user.role === "requester" && (
              <>
                <Link href="/requests/new">
                  <Button className="w-full justify-between">
                    Post a New Request
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/my-requests">
                  <Button variant="outline" className="w-full justify-between">
                    View My Requests
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/wallet">
                  <Button variant="outline" className="w-full justify-between">
                    Fund Wallet
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </>
            )}

            {user.role === "errander" && (
              <>
                <Link href="/feed">
                  <Button className="w-full justify-between">
                    Browse Open Requests
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/my-bids">
                  <Button variant="outline" className="w-full justify-between">
                    View My Bids
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/wallet">
                  <Button variant="outline" className="w-full justify-between">
                    Withdraw Earnings
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </>
            )}

            {(user.role === "admin" || user.role === "super_admin") && (
              <>
                <Link href="/admin/users">
                  <Button className="w-full justify-between">
                    Manage Users
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/disputes">
                  <Button variant="outline" className="w-full justify-between">
                    Review Disputes
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/admin/users">
                  <Button variant="outline" className="w-full justify-between">
                    KYC Review Queue
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        {/* Getting Started Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Getting Started
            </CardTitle>
            <CardDescription>Complete your profile setup</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {[
                {
                  done: user.email_verified,
                  label: "Verify your email",
                  doneLabel: "Email verified",
                },
                {
                  done: user.phone_verified,
                  label: "Verify your phone",
                  doneLabel: "Phone verified",
                },
                {
                  done: user.kyc_tier >= 1,
                  label: "Complete KYC verification",
                  doneLabel: `KYC Tier ${user.kyc_tier} verified`,
                },
                {
                  done: user.two_factor_enabled,
                  label: "Enable two-factor authentication",
                  doneLabel: "2FA enabled",
                },
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.done
                        ? "bg-[#10B981]/10 text-[#10B981]"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <span
                    className={
                      item.done ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    {item.done ? item.doneLabel : item.label}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
