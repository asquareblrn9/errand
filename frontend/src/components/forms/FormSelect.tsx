"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  name: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, error, name, options, placeholder, className, id, ...props }, ref) => {
    const form = useFormContext();
    const fieldError = error ?? form?.formState?.errors?.[name]?.message as string | undefined;

    return (
      <div className="space-y-2">
        {label && <Label htmlFor={id ?? name}>{label}</Label>}
        <select
          id={id ?? name}
          ref={ref}
          name={name}
          className={cn(
            "flex h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm transition-all duration-200 outline-none",
            "focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15",
            "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50",
            fieldError && "border-destructive ring-2 ring-destructive/20",
            className,
          )}
          aria-invalid={!!fieldError}
          {...props}
        >
          {placeholder && (
            <option value="">{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {fieldError && (
          <p className="text-sm text-destructive mt-1.5" role="alert">
            {fieldError}
          </p>
        )}
      </div>
    );
  },
);

FormSelect.displayName = "FormSelect";
