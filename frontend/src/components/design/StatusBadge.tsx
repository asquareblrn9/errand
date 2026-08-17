"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "green" | "orange" | "grey" | "blue";

const toneClass: Record<Tone, string> = {
  green: "bg-[#E6F9F0] text-[#00633F]",
  orange: "bg-[#FFF1E6] text-[#B24E00]",
  grey: "bg-[#E9ECEF] text-[#495057]",
  blue: "bg-[#E8F0FF] text-[#1D4FB8]",
};

/** Map platform statuses to the design's green/orange/grey/blue pill badges. */
export function statusTone(status: string): Tone {
  switch (status) {
    case "completed":
    case "paid out":
    case "funds_released":
    case "delivered":
    case "confirmed":
    case "successful":
    case "active":
    case "in_transit":
      return "green";
    case "in_progress":
    case "payment_made":
    case "escrowed":
    case "escrow_hold":
    case "assigned":
    case "accepted":
    case "pending_pickup":
      return "orange";
    case "disputed":
    case "dispute_window":
    case "bids_open":
      return "blue";
    default:
      return "grey";
  }
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const tone = statusTone(status);
  return (
    <Badge
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-bold",
        toneClass[tone],
        className,
      )}
    >
      {label ?? status.replace(/_/g, " ")}
    </Badge>
  );
}
