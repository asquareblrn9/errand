"use client";

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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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
    label: "Browse Requests",
    href: "/feed",
    icon: PackageSearch,
    roles: ["errander"],
  },
  {
    label: "My Requests",
    href: "/my-requests",
    icon: ClipboardList,
    roles: ["requester", "company_admin", "company_member"],
  },
  {
    label: "My Bids",
    href: "/my-bids",
    icon: ClipboardList,
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
    roles: ["requester", "errander", "company_admin"],
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
    label: "Categories",
    href: "/admin/categories",
    icon: Tag,
    roles: ["admin", "super_admin"],
  },
  {
    label: "Active Errands",
    href: "/admin/errands",
    icon: Package,
    roles: ["admin", "super_admin"],
  },
  {
    label: "KYC Review",
    href: "/admin/kyc",
    icon: UserCheck,
    roles: ["admin", "super_admin"],
  },
  {
    label: "Admin Users",
    href: "/admin/users",
    icon: Users,
    roles: ["admin", "super_admin"],
  },
  {
    label: "Admin Dashboard",
    href: "/admin/dashboard",
    icon: Shield,
    roles: ["admin", "super_admin"],
  },
  {
    label: "Platform Settings",
    href: "/admin/settings",
    icon: Settings,
    roles: ["super_admin"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["requester", "errander", "admin", "super_admin", "company_admin", "company_member"],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);

  const filteredItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role),
  );

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "EB";

  return (
    <aside className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] w-64 border-r border-border bg-card lg:flex lg:flex-col">
      {/* User Profile Section */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {user?.name ?? "User"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {user?.email}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary border-l-[3px] border-primary shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-[3px] border-transparent",
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-2">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 w-full"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 shrink-0" />
          ) : (
            <Moon className="w-4 h-4 shrink-0" />
          )}
          <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>
        <p className="text-xs text-muted-foreground text-center">
          Errand Boy v2.0
        </p>
      </div>
    </aside>
  );
}
