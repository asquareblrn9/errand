"use client";

import { cn } from "@/lib/utils";

/** Pill toggle chip per the design: light outline, ink fill when on. */
export function Chip({
  on = false,
  onClick,
  children,
  className,
}: {
  on?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap transition-colors",
        on
          ? "border-[#0A1628] bg-[#0A1628] text-white"
          : "border-[#CED4DA] bg-white text-[#0A1628] hover:border-[#ADB5BD]",
        className,
      )}
    >
      {children}
    </button>
  );
}
