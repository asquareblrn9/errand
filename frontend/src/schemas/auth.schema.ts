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
    first_name: z
      .string()
      .min(1, "First name is required")
      .max(100, "First name is too long"),
    last_name: z
      .string()
      .min(1, "Last name is required")
      .max(100, "Last name is too long"),
    date_of_birth: z
      .string()
      .min(1, "Date of birth is required")
      .refine((val) => {
        const dob = new Date(val);
        const now = new Date();
        const age = now.getFullYear() - dob.getFullYear();
        const monthDiff = now.getMonth() - dob.getMonth();
        const dayDiff = now.getDate() - dob.getDate();
        const exactAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
        return exactAge >= 18;
      }, "You must be at least 18 years old to register"),
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
