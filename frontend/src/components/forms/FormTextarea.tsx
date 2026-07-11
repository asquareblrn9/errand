"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";
import { useFormContext } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  name: string;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, name, className, id, ...props }, ref) => {
    const form = useFormContext();
    const fieldError = error ?? form?.formState?.errors?.[name]?.message as string | undefined;

    return (
      <div className="space-y-2">
        {label && <Label htmlFor={id ?? name}>{label}</Label>}
        <Textarea
          id={id ?? name}
          ref={ref}
          name={name}
          className={cn(fieldError && "border-destructive", className)}
          aria-invalid={!!fieldError}
          {...props}
        />
        {fieldError && (
          <p className="text-sm text-destructive mt-1.5" role="alert">
            {fieldError}
          </p>
        )}
      </div>
    );
  },
);

FormTextarea.displayName = "FormTextarea";
