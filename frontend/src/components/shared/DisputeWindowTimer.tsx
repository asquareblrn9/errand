"use client";

import { useEffect, useState } from "react";
import { Clock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

interface DisputeWindowTimerProps {
  closesAt: string; // ISO8601
  className?: string;
}

export function DisputeWindowTimer({ closesAt, className }: DisputeWindowTimerProps) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(closesAt).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const r = new Date(closesAt).getTime() - Date.now();
      setRemainingMs(r);
    }, 1000);
    return () => clearInterval(id);
  }, [closesAt]);

  const isExpired = remainingMs <= 0;
  const pctUsed = isExpired ? 100 : Math.max(0, 100 - (remainingMs / (24 * 3600000)) * 100); // approximate from 24h

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Shield className={cn("w-4 h-4", isExpired ? "text-[#10B981]" : "text-[#F97316]")} />
        <span className={cn("text-sm font-bold tabular-nums", isExpired ? "text-[#10B981]" : "text-[#F97316]")}>
          {isExpired ? "Dispute window closed — funds releasing" : formatRemaining(remainingMs)}
        </span>
        <Clock className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", isExpired ? "bg-[#10B981]" : "bg-[#F97316]")}
          style={{ width: `${Math.min(pctUsed, 100)}%` }}
        />
      </div>
    </div>
  );
}
