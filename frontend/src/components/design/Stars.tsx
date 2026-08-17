"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Orange star + numeric rating, per the design's requester/errander rating chips. */
export function Stars({
  rating,
  count,
  className,
}: {
  rating?: number | null;
  count?: number | null;
  className?: string;
}) {
  if (rating === null || rating === undefined) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[#B24E00]", className)}>
      <Star className="h-3 w-3 fill-[#FF6B00] text-[#FF6B00]" />
      <span className="text-xs font-bold tabular-nums">
        {Number.isInteger(rating) ? rating : rating.toFixed(1)}
      </span>
      {count !== null && count !== undefined && (
        <span className="text-xs text-[#6C757D] font-medium">· {count} errands</span>
      )}
    </span>
  );
}
