"use client";

import { TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  iconBg?: string; // e.g. "bg-[#E6F9F0]"
  iconColor?: string; // e.g. "text-[#008554]"
  delta?: React.ReactNode;
  deltaTone?: "up" | "down" | "neutral";
  action?: React.ReactNode; // e.g. Top up / Withdraw button
  className?: string;
}

export function StatTile({
  label,
  value,
  icon: Icon,
  iconBg = "bg-[#E6F9F0]",
  iconColor = "text-[#008554]",
  delta,
  deltaTone = "neutral",
  action,
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]",
        className,
      )}
    >
      <div className="mb-2.5 flex items-center justify-between text-xs font-semibold text-[#6C757D]">
        <span>{label}</span>
        <span
          className={cn(
            "flex h-[30px] w-[30px] items-center justify-center rounded-[9px]",
            iconBg,
            iconColor,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="font-heading text-[25px] font-bold tracking-[-0.01em] text-[#0A1628]">
        {value}
      </div>
      {delta && (
        <div
          className={cn(
            "mt-1.5 flex items-center gap-1 text-[11.5px] font-bold",
            deltaTone === "up" && "text-[#008554]",
            deltaTone === "down" && "text-[#FF1744]",
            deltaTone === "neutral" && "text-[#6C757D]",
          )}
        >
          {deltaTone !== "neutral" && <TrendingUp className="h-3 w-3" />}
          {delta}
        </div>
      )}
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}
