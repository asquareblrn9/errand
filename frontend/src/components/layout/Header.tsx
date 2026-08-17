"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, PackageSearch, Plus, Search, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePageHeader } from "./PageHeaderContext";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const { title, crumb } = usePageHeader();
  const [query, setQuery] = useState("");

  // Notification count
  const { data: notifData } = useQuery({
    queryKey: ["notifications", "count"],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: { count: number } }>("/notifications/count");
      return data.data;
    },
    refetchInterval: 30_000, // Poll every 30s
  });

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "EB";

  const cta =
    user?.role === "requester"
      ? { label: "Post an errand", icon: Plus, href: "/requests/new" }
      : user?.role === "errander"
        ? { label: "Browse requests", icon: PackageSearch, href: "/feed" }
        : user?.role === "admin" || user?.role === "super_admin"
          ? { label: "Admin console", icon: Menu, href: "/admin/dashboard" }
          : null;

  return (
    <header className="flex h-[68px] shrink-0 items-center gap-4 border-b border-[#E9ECEF] bg-white px-7">
      {/* Left — page title + crumb (set by pages via usePageHeader) */}
      <div className="min-w-0">
        {title && (
          <>
            <h1 className="truncate font-heading text-lg font-bold tracking-[-0.01em] text-[#0A1628]">
              {title}
            </h1>
            {crumb && <div className="mt-px truncate text-xs text-[#6C757D]">{crumb}</div>}
          </>
        )}
      </div>

      {/* Search (mobile menu button stays for small screens) */}
      <button
        onClick={onMenuClick}
        className="rounded-[11px] p-2 text-[#495057] transition-colors hover:bg-[#F8F9FA] lg:hidden"
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="ml-3.5 flex max-w-[360px] flex-1 items-center gap-2 rounded-[11px] border border-[#E9ECEF] bg-[#F8F9FA] px-3.5 py-2 text-[#6C757D]">
        <Search className="h-4 w-4 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              router.push(query.trim() ? `/feed?q=${encodeURIComponent(query.trim())}` : "/feed");
              setQuery("");
            }
          }}
          placeholder="Search errands, erranders, addresses…"
          className="w-full bg-transparent text-[13px] text-[#0A1628] outline-none placeholder:text-[#6C757D]"
          aria-label="Search errands"
        />
      </div>

      {/* Right — bell, CTA, avatar */}
      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={() => router.push("/notifications")}
          className="relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] border border-[#E9ECEF] bg-[#F8F9FA] text-[#495057] transition-colors hover:bg-[#E9ECEF]"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {(notifData?.count ?? 0) > 0 && (
            <span className="absolute right-1.5 top-1.5 min-w-[16px] rounded-full border border-white bg-[#FF6B00] px-0.5 text-center font-mono text-[9px] font-bold leading-4 text-white">
              {notifData!.count > 99 ? "99+" : notifData!.count}
            </span>
          )}
        </button>

        {cta && (
          <Button
            onClick={() => router.push(cta.href)}
            className="h-10 rounded-[11px] bg-[#00A86B] px-4 font-heading text-[13px] font-bold text-white hover:bg-[#008554] hover:shadow-md"
          >
            <cta.icon className="mr-1.5 h-4 w-4" />
            {cta.label}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#E6F9F0] font-heading text-xs font-bold text-[#00633F] outline-none transition-all duration-200 hover:ring-2 hover:ring-[#00A86B]/30 focus-visible:ring-2 focus-visible:ring-[#00A86B]/50"
                aria-label="User menu"
              >
                {initials}
              </button>
            }
          />
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold leading-none">
                    {user?.name}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
