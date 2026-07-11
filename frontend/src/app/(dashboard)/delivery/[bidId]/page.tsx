"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { KeyRound, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";

interface OtpData { otp: string; expires_in_minutes: number; expires_at: string; }
interface ConfirmData { delivery_id: string; confirmed_at: string; dispute_window_hours: number; dispute_window_closes_at: string; }

export default function DeliveryPage() {
  const { bidId } = useParams<{ bidId: string }>();
  const { user } = useAuthStore();
  const [otp, setOtp] = useState<OtpData | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmData | null>(null);
  const [inputOtp, setInputOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isErrander = user?.role === "errander";

  const handleGenerateOtp = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.post<ApiResponse<OtpData>>(`/deliveries/${bidId}/generate-otp`);
      setOtp(data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to generate OTP");
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.post<ApiResponse<ConfirmData>>(`/deliveries/${bidId}/confirm`, { otp: inputOtp });
      setConfirmResult(data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid OTP");
    } finally { setLoading(false); }
  };

  if (confirmResult) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Card>
          <CardContent className="pt-8 pb-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Delivery Confirmed!</h2>
            <p className="text-muted-foreground mb-4">
              Dispute window: {confirmResult.dispute_window_hours} hours
            </p>
            <p className="text-sm text-muted-foreground">
              Window closes: {new Date(confirmResult.dispute_window_closes_at).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Delivery Verification</h1>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Errander: Generate OTP */}
      {isErrander && !otp && (
        <Card>
          <CardHeader><CardTitle>Generate Delivery OTP</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Generate a one-time code when you arrive at the delivery location. Share it with the requester to confirm.
            </p>
            <Button onClick={handleGenerateOtp} disabled={loading} className="w-full">
              <KeyRound className="w-4 h-4 mr-2" /> {loading ? "Generating..." : "Generate OTP"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Errander: Show OTP */}
      {isErrander && otp && (
        <Card>
          <CardContent className="pt-8 pb-6 text-center">
            <KeyRound className="w-8 h-8 text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">Share this code with the requester</p>
            <div className="text-4xl font-bold tracking-[0.5em] mb-4">{otp.otp}</div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Expires in {otp.expires_in_minutes} minutes</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requester: Enter OTP */}
      {!isErrander && !confirmResult && (
        <Card>
          <CardHeader><CardTitle>Confirm Delivery</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code provided by the errander to confirm delivery.
            </p>
            <Input
              type="text" inputMode="numeric" maxLength={6}
              placeholder="000000" value={inputOtp}
              onChange={(e) => setInputOtp(e.target.value)}
              className="text-center text-2xl tracking-[0.5em]"
            />
            <Button onClick={handleConfirm} disabled={loading || inputOtp.length !== 6} className="w-full">
              <CheckCircle className="w-4 h-4 mr-2" /> Confirm Delivery
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
