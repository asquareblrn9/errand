"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────

function formatTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0:00";
  const abs = Math.abs(totalSeconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m elapsed`;
  if (m > 0) return `${m}m elapsed`;
  return `${totalSeconds}s elapsed`;
}

// ── Types ────────────────────────────────────────────────────

interface SlaTimerProps {
  startedAt: string;          // ISO8601
  deadlineAt: string;         // ISO8601
  slaMinutes: number;
  gracePeriodMinutes: number;
  lateFeeAccrued: number;
  lateFeePerHour: number;
  className?: string;
}

// ── Component ────────────────────────────────────────────────

export function SlaTimer({
  startedAt,
  deadlineAt,
  slaMinutes,
  gracePeriodMinutes,
  lateFeeAccrued,
  lateFeePerHour,
  className,
}: SlaTimerProps) {
  const [now, setNow] = useState(Date.now());

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = new Date(startedAt).getTime();
  const deadline = new Date(deadlineAt).getTime();
  const totalSlaMs = slaMinutes * 60 * 1000;

  const elapsedMs = now - start;
  const remainingMs = deadline - now;

  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

  // Percentage of SLA used (capped at 100% until overdue, then >100%)
  const pctUsed = totalSlaMs > 0 ? Math.round((elapsedMs / totalSlaMs) * 100) : 0;

  const isOverdue = remainingMs <= 0;
  const isWarning = !isOverdue && pctUsed >= 80;
  const isGrace = isOverdue && gracePeriodMinutes > 0 &&
    remainingMs > -(gracePeriodMinutes * 60 * 1000);

  // ── Render ──────────────────────────────────────────────

  return (
    <div className={cn("space-y-3", className)}>
      {/* Time display */}
      <div className="flex items-center gap-2">
        <Clock
          className={cn(
            "w-5 h-5",
            isOverdue ? "text-destructive" : isWarning ? "text-[#F97316]" : "text-primary",
          )}
        />
        {isOverdue ? (
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-sm font-bold text-destructive">
              Overdue by {formatTime(Math.abs(remainingSeconds))}
            </span>
          </div>
        ) : (
          <span
            className={cn(
              "text-sm font-bold tabular-nums",
              isWarning ? "text-[#F97316]" : "text-foreground",
            )}
          >
            {formatTime(remainingSeconds)} remaining
          </span>
        )}
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {formatElapsed(elapsedSeconds)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{pctUsed > 100 ? 100 : pctUsed}% used</span>
          {isGrace && (
            <span className="text-[#F97316]">
              Grace period — {Math.ceil(Math.abs(remainingMs) / 60000)}m left
            </span>
          )}
          {isOverdue && !isGrace && (
            <span className="text-destructive">
              Late fee: ₦{lateFeeAccrued.toLocaleString()} (+₦{lateFeePerHour}/hr)
            </span>
          )}
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000",
              isOverdue ? "bg-destructive" : isWarning ? "bg-[#F97316]" : "bg-primary",
            )}
            style={{ width: `${Math.min(pctUsed, 100)}%` }}
          />
        </div>
        {/* Grace period marker */}
        {gracePeriodMinutes > 0 && (
          <div
            className="relative h-0"
            style={{
              marginLeft: `${Math.min(Math.round(((slaMinutes - gracePeriodMinutes) / slaMinutes) * 100), 100)}%`,
            }}
          >
            <div className="absolute -top-0.5 w-0.5 h-2 bg-[#F97316]/50 rounded" title="Grace period starts" />
          </div>
        )}
      </div>
    </div>
  );
}
