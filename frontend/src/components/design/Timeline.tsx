"use client";

import { cn } from "@/lib/utils";

export interface TimelineItem {
  title: string;
  date?: string;
  state: "done" | "now" | "pending";
}

/** Vertical stepper per the design: green done dots, orange pulsing current dot. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <div className={cn("relative pl-[26px]", className)}>
      <div className="absolute bottom-1 left-2 top-1 w-[2px] bg-[#E9ECEF]" aria-hidden />
      <div className="flex flex-col">
        {items.map((item, i) => (
          <div key={i} className={cn("relative", i < items.length - 1 && "pb-[22px]")}>
            <span
              aria-hidden
              className={cn(
                "absolute -left-[26px] top-[3px] h-4 w-4 rounded-full border-[3px] border-white",
                item.state === "done" &&
                  "bg-[#00A86B] shadow-[0_0_0_1px_#00A86B]",
                item.state === "now" &&
                  "bg-[#FF6B00] shadow-[0_0_0_4px_#FFEDE0]",
                item.state === "pending" &&
                  "bg-[#CED4DA] shadow-[0_0_0_1px_#CED4DA]",
              )}
            />
            <div className="text-[13px] font-bold text-[#0A1628]">{item.title}</div>
            {item.date && <div className="mt-0.5 text-[11.5px] text-[#6C757D]">{item.date}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
