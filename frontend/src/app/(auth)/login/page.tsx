"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LogIn, Shield } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/shared/OtpInput";
import { loginSchema, type LoginFormData } from "@/lib/validators";
import { useAuthStore } from "@/store/authStore";
import type { AxiosError } from "axios";
import type { ApiError } from "@/types/api";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const completeLogin2FA = useAuthStore((s) => s.completeLogin2FA);
  const formRef = useRef<HTMLFormElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");

  // 2FA state
  const [twoFactorTempToken, setTwoFactorTempToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorError, setTwoFactorError] = useState("");
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError("");
    try {
      const result = await login(data);

      // If 2FA is required, switch to the 2FA code view
      if (result?.requires_2fa) {
        setTwoFactorTempToken(result.temp_token);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      const axiosErr = err as AxiosError<ApiError>;
      const msg =
        axiosErr.response?.data?.message ||
        "Login failed. Please check your credentials.";
      setServerError(msg);
    }
  };

  const handle2FAVerify = async () => {
    if (!twoFactorTempToken || twoFactorCode.length !== 6) return;

    setIsVerifying2FA(true);
    setTwoFactorError("");

    try {
      await completeLogin2FA(twoFactorTempToken, twoFactorCode);
      router.push("/dashboard");
    } catch (err) {
      const axiosErr = err as AxiosError<ApiError>;
      setTwoFactorError(
        axiosErr.response?.data?.message ||
          "Invalid verification code. Please try again.",
      );
      setTwoFactorCode("");
    } finally {
      setIsVerifying2FA(false);
    }
  };

  const handleCancel2FA = () => {
    setTwoFactorTempToken(null);
    setTwoFactorCode("");
    setTwoFactorError("");
    setServerError("");
  };

  /** Safari fallback: Base UI Button may not trigger native form submit. */
  const handleLoginClick = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  // ── 2FA Code View ────────────────────────────────────────
  if (twoFactorTempToken) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto w-12 h-12 bg-[#F97316]/10 rounded-2xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#F97316]" />
          </div>
          <CardTitle className="text-2xl font-bold">Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app to complete sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-5">
            {twoFactorError && (
              <div className="w-full p-3 text-sm rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-center">
                {twoFactorError}
              </div>
            )}

            <OtpInput
              value={twoFactorCode}
              onChange={(val) => {
                setTwoFactorCode(val);
                setTwoFactorError("");
              }}
              disabled={isVerifying2FA}
              length={6}
            />

            <Button
              onClick={handle2FAVerify}
              disabled={twoFactorCode.length !== 6 || isVerifying2FA}
              className="w-full"
              size="lg"
            >
              {isVerifying2FA ? "Verifying..." : "Verify & Sign In"}
            </Button>

            <button
              type="button"
              onClick={handleCancel2FA}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to sign in
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Normal Login View ────────────────────────────────────
  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-2 text-center pb-6">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
          <LogIn className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
        <CardDescription>Sign in to your Errand Boy account</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
        >
          {serverError && (
            <div className="p-3 text-sm rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
              {serverError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="login">Email or Phone Number</Label>
            <Input
              id="login"
              type="text"
              placeholder="you@example.com or +2348012345678"
              {...register("login", {
                required: "Email or phone number is required",
              })}
              autoComplete="username"
              aria-invalid={!!errors.login}
            />
            {errors.login && (
              <p className="text-sm text-destructive">{errors.login.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-primary hover:underline font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                {...register("password", { required: "Password is required" })}
                autoComplete="current-password"
                className="pr-10"
                aria-invalid={!!errors.password}
              />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground hover:text-foreground transition-colors"
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            onClick={handleLoginClick}
            disabled={isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <GoogleSignInButton mode="login" />
        </form>
      </CardContent>
      <CardFooter className="flex justify-center text-center text-sm">
        <p className="text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-primary hover:underline font-semibold"
          >
            Create one
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
