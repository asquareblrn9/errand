"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Package,
  PackageSearch,
  ClipboardList,
  MessageSquare,
  Moon,
  Sun,
  Wallet,
  Star,
  Shield,
  Settings,
  Tag,
  Users,
  UserCheck,
  BarChart3,
  FileText,
  Bell,
  Activity,
  AlertTriangle,
  DollarSign,
  ArrowUpDown,
  Truck,
  Gavel,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyRequests } from "@/hooks/queries/requests/use-requests";
import { useErranderHome } from "@/hooks/queries/errander/use-errander-home";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["requester", "errander", "admin", "super_admin", "company_admin", "company_member"],
  },
  {
    label: "Post an errand",
    href: "/requests/new",
    icon: Package,
    roles: ["requester"],
  },
  {
    label: "Browse Requests",
    href: "/feed",
    icon: PackageSearch,
    roles: ["errander"],
  },
  {
    label: "Bids & requests",
    href: "/my-requests",
    icon: ClipboardList,
    roles: ["requester", "company_admin", "company_member"],
  },
  {
    label: "My Bids",
    href: "/my-bids",
    icon: Gavel,
    roles: ["errander"],
  },
  {
    label: "Messages",
    href: "/chat",
    icon: MessageSquare,
    roles: ["requester", "errander", "company_admin", "company_member"],
  },
  {
    label: "Wallet",
    href: "/wallet",
    icon: Wallet,
    roles: ["requester", "company_admin"],
  },
  {
    label: "Earnings",
    href: "/earnings",
    icon: DollarSign,
    roles: ["errander"],
  },
  {
    label: "Trust Score",
    href: "/trust-score",
    icon: Star,
    roles: ["errander"],
  },
  {
    label: "Verification",
    href: "/verification",
    icon: UserCheck,
    roles: ["requester", "errander", "company_admin"],
  },
  {
    label: "Subscriptions",
    href: "/subscriptions",
    icon: Wallet,
    roles: ["requester", "company_admin"],
  },
  {
    label: "Company",
    href: "/company",
    icon: Shield,
    roles: ["company_admin", "company_member"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["requester", "errander", "admin", "super_admin", "company_admin", "company_member"],
  },
];

// Admin navigation sections — shown only to admin/super_admin
const ADMIN_SECTIONS = [
  {
    title: "Dashboard",
    items: [
      { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "User Management",
    items: [
      { label: "Requesters", href: "/admin/users?role=requester", icon: Users },
      { label: "Erranders", href: "/admin/users?role=errander", icon: Users },
      { label: "Admins", href: "/admin/users?role=admin", icon: Shield },
      { label: "Suspended Users", href: "/admin/users?suspended=true", icon: AlertTriangle },
      { label: "All Users", href: "/admin/users", icon: Users },
    ],
  },
  {
    title: "Jobs",
    items: [
      { label: "Active Jobs", href: "/admin/errands", icon: Package },
      { label: "KYC Review", href: "/admin/kyc", icon: UserCheck },
      { label: "Categories", href: "/admin/categories", icon: Tag },
    ],
  },
  {
    title: "Financial",
    items: [
      { label: "Transactions", href: "/admin/transactions", icon: ArrowUpDown },
      { label: "Payments", href: "/admin/payments", icon: DollarSign },
      { label: "Escrow", href: "/admin/escrow", icon: Shield },
    ],
  },
  {
    title: "Reports",
    items: [
      { label: "Analytics", href: "/admin/dashboard", icon: BarChart3 },
      { label: "Earnings", href: "/admin/errander-earnings", icon: DollarSign },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Audit Logs", href: "/admin/audit-logs", icon: FileText },
      { label: "System Health", href: "/admin/dashboard", icon: Activity },
      { label: "Notifications", href: "/admin/notifications", icon: Bell },
    ],
    roles: ["super_admin"],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);

  const isRequester = user?.role === "requester";
  const isErrander = user?.role === "errander";

  // Live nav badges (cached queries shared with the pages that need them)
  const { data: myRequests } = useMyRequests(undefined, isRequester);
  const { data: erranderHome } = useErranderHome(isErrander);

  const openBids = useMemo(
    () =>
      myRequests
        ?.filter((r) => r.status === "open")
        .reduce((sum, r) => sum + (r.bids_count ?? 0), 0) ?? 0,
    [myRequests],
  );

  // "Active errand" nav — links straight to the live errand when one exists
  const requesterActiveHref = myRequests?.find((r) =>
    ["assigned", "in_progress", "delivered", "confirmed", "escrow_hold", "dispute_window"].includes(r.status),
  );
  const erranderActiveHref = erranderHome?.active_errand?.bid_id;

  const activeErrandHref = isErrander
    ? erranderActiveHref
      ? `/delivery/${erranderActiveHref}`
      : "/my-bids"
    : requesterActiveHref
      ? `/requests/${requesterActiveHref.id}`
      : "/my-requests";

  const filteredItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role),
  );

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "EB";

  const location =
    user?.residential_address?.split(",")[0] ?? user?.state ?? "Nigeria";

  const roleLabel = user?.role
    ? user.role.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "User";

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[252px] flex-col border-r border-[#E9ECEF] bg-white px-4 py-[22px] lg:flex">
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2 pb-[22px]">
        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#0A1628] text-[#80DFB8]">
          <Truck className="h-[18px] w-[18px]" />
        </div>
        <span className="font-heading text-[16.5px] font-extrabold tracking-[-0.01em] text-[#0A1628]">
          Errand<span className="text-[#00A86B]">Guy</span>
        </span>
      </Link>

      {/* Static role indicator (single-role accounts — non-clickable) */}
      {(isRequester || isErrander) && (
        <div className="mb-[22px] flex rounded-full bg-[#E9ECEF] p-[3px]">
          <div
            className={cn(
              "flex-1 rounded-full py-2 text-center font-heading text-xs font-bold",
              isRequester ? "bg-[#0A1628] text-white shadow-sm" : "text-[#495057]",
            )}
          >
            Requester
          </div>
          <div
            className={cn(
              "flex-1 rounded-full py-2 text-center font-heading text-xs font-bold",
              isErrander ? "bg-[#0A1628] text-white shadow-sm" : "text-[#495057]",
            )}
          >
            Errander
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {!isAdmin && (
          <p className="px-2.5 pb-2 pt-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#6C757D]">
            Menu
          </p>
        )}

        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          let badge: number | null = null;
          if (item.href === "/my-requests" && isRequester && openBids > 0)
            badge = openBids;
          if (item.href === "/feed" && isErrander && (erranderHome?.nearby_total ?? 0) > 0)
            badge = erranderHome!.nearby_total;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-[11px] rounded-[11px] px-3 py-2.5 text-[13.5px] font-semibold transition-colors",
                isActive
                  ? "bg-[#E6F9F0] text-[#00633F]"
                  : "text-[#495057] hover:bg-[#F8F9FA] hover:text-[#0A1628]",
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{item.label}</span>
              {badge !== null && (
                <span
                  className={cn(
                    "ml-auto rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold text-white",
                    isActive ? "bg-[#00A86B]" : "bg-[#FF6B00]",
                  )}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Active errand quick link (both user roles) */}
        {!isAdmin && (isRequester || isErrander) && (
          <Link
            href={activeErrandHref}
            className={cn(
              "flex items-center gap-[11px] rounded-[11px] px-3 py-2.5 text-[13.5px] font-semibold transition-colors",
              pathname.startsWith("/delivery/") || (isRequester && pathname.startsWith("/requests/"))
                ? "bg-[#E6F9F0] text-[#00633F]"
                : "text-[#495057] hover:bg-[#F8F9FA] hover:text-[#0A1628]",
            )}
          >
            <MapPin className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">Active errand</span>
          </Link>
        )}
      </nav>

      {/* Admin Navigation Sections */}
      {isAdmin &&
        ADMIN_SECTIONS.filter((s) => !s.roles || s.roles.includes(user!.role)).map(
          (section) => (
            <div key={section.title} className="pt-2">
              <p className="mb-1 px-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#6C757D]">
                {section.title}
              </p>
              <nav className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/") ||
                    pathname.startsWith(item.href + "?");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-[11px] rounded-[11px] px-3 py-2 text-[13.5px] font-semibold transition-colors",
                        active
                          ? "bg-[#E6F9F0] text-[#00633F]"
                          : "text-[#495057] hover:bg-[#F8F9FA] hover:text-[#0A1628]",
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ),
        )}

      {/* Footer card */}
      <div className="mt-auto border-t border-[#E9ECEF] pt-4">
        <div className="flex items-center gap-2.5 rounded-[13px] bg-[#F8F9FA] p-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#E6F9F0] font-heading text-[13px] font-bold text-[#00633F]">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-bold text-[#0A1628]">
              {user?.name ?? "User"}
            </p>
            <p className="truncate text-[10.5px] text-[#6C757D]">
              {roleLabel} · {location}
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between px-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center gap-2 text-xs font-medium text-[#6C757D] transition-colors hover:text-[#0A1628]"
          >
            {theme === "dark" ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <p className="text-[10px] text-[#ADB5BD]">ErrandGuy v2.0</p>
        </div>
      </div>
    </aside>
  );
}
