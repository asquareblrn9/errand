"use client";

import { useEffect, useState } from "react";
import { useToastStore, type Toast as ToastType } from "@/store/toastStore";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  default: Info,
};

const variantStyles: Record<ToastType["variant"], string> = {
  success: "border-[#10B981]/20 bg-[#10B981]/10 text-[#10B981]",
  error: "border-destructive/20 bg-destructive/10 text-destructive",
  warning: "border-[#F97316]/20 bg-[#F97316]/10 text-[#F97316]",
  default: "border-border bg-card text-foreground",
};

function ToastItem({ toast: t }: { toast: ToastType }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const [visible, setVisible] = useState(false);
  const Icon = iconMap[t.variant];

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      role="alert"
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-4 shadow-lg transition-all duration-300",
        variantStyles[t.variant],
        visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0",
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{t.title}</p>
        {t.description && (
          <p className="text-sm opacity-80 mt-1">{t.description}</p>
        )}
      </div>
      <button
        onClick={() => removeToast(t.id)}
        className="flex-shrink-0 rounded-lg p-1 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
