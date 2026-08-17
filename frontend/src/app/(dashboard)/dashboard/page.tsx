"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useMyBids } from "@/hooks/queries/bids/use-bids";
import { useRequesterHome } from "@/hooks/queries/requester/use-requester-home";
import { useErranderHome } from "@/hooks/queries/errander/use-errander-home";
import { useSetPageHeader } from "@/components/layout/PageHeaderContext";
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
  Amount,
  AreaChart,
  Chip,
  ProgressBar,
  StatTile,
  StatusBadge,
  timeAgo,
} from "@/components/design";
import {
  CheckCircle2,
  Star,
  ArrowRight,
  Shield,
  User,
  Timer,
  Wallet,
  MapPin,
} from "lucide-react";

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

const CATEGORY_BAR_COLORS = ["bg-[#00A86B]", "bg-[#FF6B00]", "bg-[#2979FF]", "bg-[#ADB5BD]"];

// ═══════════════════════ REQUESTER DASHBOARD ═══════════════════════

function RequesterDashboard() {
  useSetPageHeader("Dashboard", "Overview of your errands");
  const { data: home, isLoading } = useRequesterHome();
  const user = useAuthStore((s) => s.user);

  if (isLoading || !home) return <DashboardSkeleton />;

  const { stats } = home;
  const maxCategory = Math.max(...home.category_breakdown.map((c) => c.amount), 1);

  return (
    <div className="space-y-[22px]">
      {/* Stats */}
      <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Active errands"
          value={stats.active_errands}
          icon={MapPin}
          delta={`${stats.arriving_today} arriving today`}
          deltaTone="up"
        />
        <StatTile
          label="Spent this month"
          value={<Amount value={stats.spent_this_month} />}
          icon={Wallet}
          iconBg="bg-[#FFF1E6]"
          iconColor="text-[#B24E00]"
          delta={`${stats.spent_change_pct >= 0 ? "↑" : "↓"} ${Math.abs(stats.spent_change_pct)}% vs last month`}
          deltaTone={stats.spent_change_pct >= 0 ? "up" : "down"}
        />
        <StatTile
          label="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          iconBg="bg-[#E8F0FF]"
          iconColor="text-[#1D4FB8]"
          delta={`since ${formatMemberSince(user?.member_since)}`}
        />
        <StatTile
          label="Avg. rating given"
          value={stats.avg_rating > 0 ? stats.avg_rating.toFixed(1) : "—"}
          icon={Star}
          iconBg="bg-[#FFF1E6]"
          iconColor="text-[#B24E00]"
          delta={`across ${stats.total_ratings} errands`}
        />
      </div>

      {/* Chart + category breakdown */}
      <div className="grid gap-[18px] xl:grid-cols-[2fr_1fr]">
        <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-[15px] font-bold text-[#0A1628]">
              Spending — last 8 weeks
            </h2>
            <Badge
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                stats.spent_change_pct >= 0
                  ? "bg-[#E6F9F0] text-[#00633F]"
                  : "bg-[#FFF1E6] text-[#B24E00]"
              }`}
            >
              {stats.spent_change_pct >= 0 ? "↑" : "↓"}{" "}
              {Math.abs(stats.spent_change_pct)}%
            </Badge>
          </div>
          <AreaChart data={home.chart_week} />
        </div>

        <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
          <h2 className="mb-4 font-heading text-[15px] font-bold text-[#0A1628]">
            Category breakdown
          </h2>
          {home.category_breakdown.length === 0 ? (
            <p className="py-8 text-center text-[12.5px] text-[#ADB5BD]">
              No spending this month yet
            </p>
          ) : (
            <div className="flex flex-col gap-[14px]">
              {home.category_breakdown.slice(0, 5).map((c, i) => (
                <ProgressBar
                  key={c.category_name}
                  label={c.category_name}
                  value={c.amount}
                  percent={(c.amount / maxCategory) * 100}
                  color={CATEGORY_BAR_COLORS[i % CATEGORY_BAR_COLORS.length]}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active errands table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-[15px] font-bold text-[#0A1628]">
            Active errands
          </h2>
          <Link
            href="/my-requests"
            className="flex items-center gap-1 text-[12.5px] font-bold text-[#00A86B] hover:text-[#008554]"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-hidden rounded-[20px] border border-[#E9ECEF] bg-white shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
          {home.active_errands.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[#6C757D]">
              No active errands —{" "}
              <Link href="/requests/new" className="font-bold text-[#00A86B]">
                post one now
              </Link>
            </p>
          ) : (
            <table className="eg-table">
              <thead>
                <tr>
                  <th>Errand</th>
                  <th>Errander</th>
                  <th>Status</th>
                  <th>Escrowed</th>
                  <th>ETA</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {home.active_errands.map((r) => (
                  <tr key={r.id} className="eg-row-hover cursor-pointer" onClick={() => (window.location.href = `/requests/${r.id}`)}>
                    <td>
                      <strong className="text-[13px] text-[#0A1628]">{r.title}</strong>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[10px] bg-[#E6F9F0] font-heading text-[10px] font-bold text-[#00633F]">
                          {r.errander_name
                            ? r.errander_name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)
                            : "—"}
                        </span>
                        <span className="text-[13px]">{r.errander_name ?? "Awaiting bids"}</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="eg-amt">{r.escrow_amount != null ? `₦${r.escrow_amount.toLocaleString()}` : "—"}</td>
                    <td>
                      {r.minutes_remaining === null || r.minutes_remaining === undefined ? (
                        "—"
                      ) : r.minutes_remaining <= 0 ? (
                        <span className="font-semibold text-[#00A86B]">Arrived</span>
                      ) : (
                        `${r.minutes_remaining} min`
                      )}
                    </td>
                    <td>
                      <ArrowRight className="h-4 w-4 text-[#ADB5BD]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ ERRANDER DASHBOARD ═══════════════════════

function ErranderDashboard() {
  useSetPageHeader("Dashboard", "Your earnings and activity at a glance");
  const { data: home, isLoading } = useErranderHome();
  const [chartRange, setChartRange] = useState<"today" | "week">("week");

  if (isLoading || !home) return <DashboardSkeleton />;

  const { earnings, performance, active_errand, nearby } = home;
  const chartData = chartRange === "week" ? earnings.chart_week : earnings.chart_today;
  const activeBidId = active_errand?.bid_id;

  return (
    <div className="space-y-[22px]">
      {/* Stats */}
      <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Today's earnings"
          value={<Amount value={earnings.today} />}
          icon={Wallet}
          delta={`${earnings.change_pct >= 0 ? "↑" : "↓"} ${Math.abs(earnings.change_pct)}% vs yesterday`}
          deltaTone={earnings.change_pct >= 0 ? "up" : "down"}
        />
        <StatTile
          label="This week"
          value={<Amount value={earnings.this_week} />}
          icon={Star}
          iconBg="bg-[#FFF1E6]"
          iconColor="text-[#B24E00]"
          delta={`${earnings.this_week_jobs} errands done`}
        />
        <StatTile
          label="Rating"
          value={performance.rating != null ? performance.rating.toFixed(1) : "—"}
          icon={Star}
          iconBg="bg-[#E8F0FF]"
          iconColor="text-[#1D4FB8]"
          delta={`${performance.completed_orders} completed`}
        />
        <StatTile
          label="Accept rate"
          value={performance.accept_rate != null ? `${Math.round(performance.accept_rate)}%` : "—"}
          icon={CheckCircle2}
          delta={
            performance.on_time_pct != null
              ? `${Math.round(performance.on_time_pct)}% on time`
              : undefined
          }
        />
      </div>

      {/* Chart + active errand */}
      <div className="grid gap-[18px] xl:grid-cols-[2fr_1fr]">
        <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-[15px] font-bold text-[#0A1628]">
              Earnings — {chartRange === "week" ? "last 7 days" : "today"}
            </h2>
            <div className="flex items-center gap-2">
              <Badge
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  earnings.change_pct >= 0
                    ? "bg-[#E6F9F0] text-[#00633F]"
                    : "bg-[#FFF1E6] text-[#B24E00]"
                }`}
              >
                {earnings.change_pct >= 0 ? "↑" : "↓"} {Math.abs(earnings.change_pct)}%
              </Badge>
              <Chip on={chartRange === "today"} onClick={() => setChartRange("today")}>
                Today
              </Chip>
              <Chip on={chartRange === "week"} onClick={() => setChartRange("week")}>
                Week
              </Chip>
            </div>
          </div>
          <AreaChart data={chartData} />
        </div>

        {/* Active errand */}
        <div className="flex flex-col rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-[15px] font-bold text-[#0A1628]">Active errand</h2>
            {active_errand && (
              <Badge className="rounded-full bg-[#FFF1E6] px-2.5 py-1 text-[11px] font-bold text-[#B24E00]">
                Live
              </Badge>
            )}
          </div>

          {active_errand ? (
            <>
              <div className="mb-4 flex items-center gap-[14px]">
                <div className="relative h-16 w-16 shrink-0">
                  <svg viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="32" cy="32" r="27" fill="none" stroke="#E9ECEF" strokeWidth="6" />
                    <circle
                      cx="32"
                      cy="32"
                      r="27"
                      fill="none"
                      stroke="#FF6B00"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray="169.6"
                      strokeDashoffset={169.6 - (169.6 * Math.min(Math.max(active_errand.progress_pct, 0), 100)) / 100}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-mono text-[13px] font-bold text-[#0A1628]">
                    {Math.round(active_errand.progress_pct)}%
                  </div>
                </div>
                <div>
                  <div className="font-heading text-[14px] font-bold text-[#0A1628]">
                    {active_errand.title}
                  </div>
                  <div className="mt-1 text-xs text-[#6C757D]">
                    {active_errand.state_label} · <Amount value={active_errand.escrow_amount} /> escrowed
                  </div>
                </div>
              </div>
              <Link href={activeBidId ? `/delivery/${activeBidId}` : "/my-bids"} className="mt-auto">
                <Button className="h-11 w-full justify-center rounded-[11px] bg-[#00A86B] font-heading text-[13px] font-bold text-white hover:bg-[#008554]">
                  Submit for completion
                </Button>
              </Link>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
              <MapPin className="mb-3 h-8 w-8 text-[#ADB5BD]" />
              <p className="text-[13px] font-bold text-[#0A1628]">No active errand</p>
              <p className="mb-4 mt-1 text-xs text-[#6C757D]">
                Browse nearby requests and place a bid
              </p>
              <Link href="/feed">
                <Button className="h-9 rounded-[11px] bg-[#00A86B] font-heading text-xs font-bold text-white hover:bg-[#008554]">
                  Browse requests
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* New nearby requests */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-[15px] font-bold text-[#0A1628]">
            New nearby requests
          </h2>
          <Link
            href="/feed"
            className="flex items-center gap-1 text-[12.5px] font-bold text-[#00A86B] hover:text-[#008554]"
          >
            Browse all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {nearby.length === 0 ? (
          <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-8 text-center text-[13px] text-[#6C757D] shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
            No requests near you right now. Check back soon.
          </div>
        ) : (
          <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-3">
            {nearby.map((r) => (
              <div
                key={r.id}
                className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]"
              >
                <div className="mb-2 font-heading text-[13.5px] font-bold text-[#0A1628]">
                  {r.title}
                </div>
                <div className="mb-2.5 text-[11.5px] text-[#6C757D]">
                  {r.distance_km != null ? `${r.distance_km}km · ` : ""}
                  posted {timeAgo(r.created_at)} · requester{" "}
                  {r.requester?.rating != null ? `${r.requester.rating.toFixed(1)}★` : "new"}
                </div>
                <div className="flex items-center justify-between">
                  {r.budget_hint != null ? (
                    <Amount value={r.budget_hint} className="text-[#FF6B00]" />
                  ) : (
                    <span className="rounded-full bg-[#E9ECEF] px-2.5 py-1 text-[11px] font-bold text-[#495057]">
                      Open to bids
                    </span>
                  )}
                  <Link href={`/requests/${r.id}`}>
                    <Button
                      variant={r.budget_hint != null ? "outline" : "default"}
                      className="h-8 rounded-[9px] px-3 font-heading text-xs font-bold"
                    >
                      Bid
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════ ADMIN / COMPANY (existing UI) ═══════════════════════

function GenericDashboard() {
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
            <div className="w-9 h-9 rounded-xl bg-[#E6F9F0] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-[#00A86B]" />
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
            <div className="w-9 h-9 rounded-xl bg-[#FFF1E6] flex items-center justify-center">
              <Star className="w-4 h-4 text-[#B24E00]" />
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
                        ? "bg-[#E6F9F0] text-[#00A86B]"
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

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  if (!user) return <DashboardSkeleton />;
  if (user.role === "requester") return <RequesterDashboard />;
  if (user.role === "errander") return <ErranderDashboard />;
  return <GenericDashboard />;
}
