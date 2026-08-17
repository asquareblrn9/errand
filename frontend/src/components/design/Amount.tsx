"use client";

import { cn } from "@/lib/utils";

/** Naira amount in the design's IBM Plex Mono tabular style. */
export function formatNaira(
  value: number | null | undefined,
  opts?: { sign?: boolean; decimals?: boolean },
): string {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-NG", {
    minimumFractionDigits: opts?.decimals ? 2 : 0,
    maximumFractionDigits: opts?.decimals ? 2 : 0,
  });
  const prefix = opts?.sign && value > 0 ? "+" : value < 0 ? "−" : "";
  return `${prefix}₦${formatted}`;
}

export function Amount({
  value,
  className,
  sign = false,
}: {
  value: number | null | undefined;
  className?: string;
  sign?: boolean;
}) {
  return <span className={cn("eg-amt", className)}>{formatNaira(value, { sign })}</span>;
}
