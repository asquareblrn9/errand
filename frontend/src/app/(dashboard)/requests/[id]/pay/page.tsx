"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Wallet, Building, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";
import Link from "next/link";

interface PaymentResult {
  payment_id: string; provider_ref: string; payment_url: string | null;
  amount: number; breakdown: { goods_amount: number; service_fee: number; platform_fee: number };
  status: string;
}

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [method, setMethod] = useState<"wallet" | "card">("wallet");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState("");

  const handlePay = async () => {
    setLoading(true); setError("");
    try {
      const bidId = new URLSearchParams(window.location.search).get("bid_id") || "";
      const { data } = await api.post<ApiResponse<PaymentResult>>("/payments/initiate", {
        bid_id: bidId,
        payment_method: method,
      });
      setResult(data.data);
      if (data.data.payment_url) {
        window.open(data.data.payment_url, "_blank");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Payment failed");
    } finally { setLoading(false); }
  };

  if (result) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Card>
          <CardContent className="pt-8 pb-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Payment {result.status === "successful" ? "Successful" : "Initiated"}</h2>
            <p className="text-3xl font-bold mb-4">₦{result.amount.toLocaleString()}</p>
            <div className="text-sm text-muted-foreground space-y-1 mb-6">
              <p>Goods: ₦{result.breakdown.goods_amount.toLocaleString()}</p>
              <p>Service Fee: ₦{result.breakdown.service_fee.toLocaleString()}</p>
              <p>Platform Fee: ₦{result.breakdown.platform_fee.toLocaleString()}</p>
            </div>
            <Badge variant={result.status === "successful" ? "default" : "secondary"}>{result.status}</Badge>
            <div className="mt-6">
              <Button onClick={() => router.push(`/requests/${id}`)}>Back to Request</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/requests/${id}`}><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <h1 className="text-2xl font-bold">Complete Payment</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Payment Method</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setMethod("wallet")}
              className={`p-4 border-2 rounded-lg text-center transition-colors ${method === "wallet" ? "border-primary bg-primary/5" : "border-muted"}`}>
              <Wallet className="w-6 h-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Wallet</span>
            </button>
            <button onClick={() => setMethod("card")}
              className={`p-4 border-2 rounded-lg text-center transition-colors ${method === "card" ? "border-primary bg-primary/5" : "border-muted"}`}>
              <CreditCard className="w-6 h-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Card / Bank</span>
            </button>
          </div>
          <Button className="w-full" onClick={handlePay} disabled={loading}>
            {loading ? "Processing..." : method === "wallet" ? "Pay from Wallet" : "Pay with Card"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
