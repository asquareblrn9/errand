import { z } from "zod";

// ── Login ──────────────────────────────────────────────────

export const loginSchema = z.object({
  login: z
    .string()
    .min(1, "Email or phone number is required")
    .max(255, "Too long"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// ── Register ───────────────────────────────────────────────

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(200, "Name is too long"),
    email: z
      .string()
      .email("Please enter a valid email address")
      .max(255, "Email is too long"),
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{6,14}$/, "Enter a valid phone number (e.g. +2348012345678)")
      .max(20, "Phone number is too long"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[^a-zA-Z0-9]/, "Must contain a special character"),
    password_confirmation: z.string(),
    role: z.enum(["requester", "errander"], {
      message: "Please select a role",
    }),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: "Passwords do not match",
    path: ["password_confirmation"],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

// ── Forgot Password ────────────────────────────────────────

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

// ── Reset Password ─────────────────────────────────────────

export const resetPasswordSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    code: z
      .string()
      .length(6, "Verification code must be 6 digits"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[^a-zA-Z0-9]/, "Must contain a special character"),
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: "Passwords do not match",
    path: ["password_confirmation"],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

// ── Verify Email ──────────────────────────────────────────────

export const verifyEmailSchema = z.object({
  code: z.string().length(6, "Verification code must be 6 digits"),
});

export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;

// ── Verify Phone ──────────────────────────────────────────────

export const verifyPhoneSchema = z.object({
  code: z.string().length(6, "Verification code must be 6 digits"),
});

export type VerifyPhoneFormData = z.infer<typeof verifyPhoneSchema>;

// ── Verify 2FA ────────────────────────────────────────────────

export const verify2FASchema = z.object({
  code: z.string().length(6, "Verification code must be 6 digits"),
});

export type Verify2FAFormData = z.infer<typeof verify2FASchema>;
