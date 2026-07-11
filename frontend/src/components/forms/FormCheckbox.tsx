"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  name: string;
}

export const FormCheckbox = forwardRef<HTMLInputElement, FormCheckboxProps>(
  ({ label, error, name, className, id, ...props }, ref) => {
    const form = useFormContext();
    const fieldError = error ?? form?.formState?.errors?.[name]?.message as string | undefined;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id={id ?? name}
            ref={ref}
            name={name}
            className={cn(
              "h-4 w-4 rounded border-input text-primary transition-all duration-200",
              "focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
              fieldError && "border-destructive",
              className,
            )}
            aria-invalid={!!fieldError}
            {...props}
          />
          {label && (
            <Label htmlFor={id ?? name} className="text-sm font-medium cursor-pointer">
              {label}
            </Label>
          )}
        </div>
        {fieldError && (
          <p className="text-sm text-destructive" role="alert">
            {fieldError}
          </p>
        )}
      </div>
    );
  },
);

FormCheckbox.displayName = "FormCheckbox";
