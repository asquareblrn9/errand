// Re-exports from the centralized Zod schemas — backward-compatible.
export {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyPhoneSchema,
  verify2FASchema,
} from "@/schemas/auth.schema";
export type {
  LoginFormData,
  RegisterFormData,
  ForgotPasswordFormData,
  ResetPasswordFormData,
  VerifyEmailFormData,
  VerifyPhoneFormData,
  Verify2FAFormData,
} from "@/schemas/auth.schema";
