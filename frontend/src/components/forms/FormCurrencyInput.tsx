"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormCurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  name: string;
  currency?: string;
}

export const FormCurrencyInput = forwardRef<HTMLInputElement, FormCurrencyInputProps>(
  ({ label, error, name, currency = "₦", className, id, ...props }, ref) => {
    const form = useFormContext();
    const fieldError = error ?? form?.formState?.errors?.[name]?.message as string | undefined;

    return (
      <div className="space-y-2">
        {label && <Label htmlFor={id ?? name}>{label}</Label>}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium select-none">
            {currency}
          </span>
          <Input
            id={id ?? name}
            ref={ref}
            name={name}
            type="number"
            className={cn("pl-8", fieldError && "border-destructive", className)}
            aria-invalid={!!fieldError}
            {...props}
          />
        </div>
        {fieldError && (
          <p className="text-sm text-destructive mt-1.5" role="alert">
            {fieldError}
          </p>
        )}
      </div>
    );
  },
);

FormCurrencyInput.displayName = "FormCurrencyInput";
