"use client";

import { cn } from "@/lib/utils";
import { formatNaira } from "./Amount";

interface ProgressBarProps {
  label: string;
  value: number;
  percent: number; // 0-100
  color?: string; // fill color class, e.g. "bg-[#00A86B]"
  amount?: number; // optional naira amount shown right-aligned
  className?: string;
}

export function ProgressBar({
  label,
  value,
  percent,
  color = "bg-[#00A86B]",
  amount,
  className,
}: ProgressBarProps) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
        <span className="text-[#212529]">{label}</span>
        <span className="eg-amt text-[#495057]">
          {amount !== undefined ? formatNaira(amount) : value}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#E9ECEF]">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
