"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { MapPin, Clock, User, ArrowLeft, CheckCircle, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSkeleton } from "@/components/shared/SkeletonLoader";
import { useAuthStore } from "@/store/authStore";
import { useRequest } from "@/hooks/queries/requests/use-requests";
import { useCreateBidMutation, useAcceptBidMutation } from "@/hooks/queries/bids/use-bids";
import { toast } from "@/store/toastStore";
import { handleApiError } from "@/lib/error-handler";
import api from "@/lib/api";
import { PaymentModal } from "@/components/payments/PaymentModal";
import { SlaTimer } from "@/components/shared/SlaTimer";
import { DisputeWindowTimer } from "@/components/shared/DisputeWindowTimer";
import { useDelivery } from "@/hooks/queries/delivery/use-delivery";
import type { RequestData, BidSummary } from "@/types/api/requests";
import Link from "next/link";

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { data: request, isLoading, refetch } = useRequest(id);
  const createBid = useCreateBidMutation(id);
  const acceptBid = useAcceptBidMutation();

  // Handle return from card payment redirect — actively verify
  useEffect(() => {
    const paymentRef = searchParams.get("payment_ref");
    if (!paymentRef) return;

    let cancelled = false;

    const verifyPayment = async () => {
      try {
        const res = await api.get(`/payments/verify/${paymentRef}`);
        const data = res.data?.data ?? res.data;
        if (cancelled) return;

        if (data?.status === "successful") {
          toast.success(
            "Payment confirmed",
            "The errander can now start your errand.",
          );
          refetch();
        } else if (data?.status === "failed") {
          toast.error(
            "Payment failed",
            data?.failure_reason || "Please try again.",
          );
          refetch();
        } else {
          // Still pending — poll once more after delay
          toast("Verifying payment", "Checking with provider...", "default");
          setTimeout(() => {
            if (!cancelled) verifyPayment();
          }, 4000);
        }
      } catch {
        // Fallback: just refetch and hope the webhook processed it
        if (!cancelled) {
          setTimeout(() => refetch(), 3000);
        }
      }
    };

    verifyPayment();
    return () => {
      cancelled = true;
    };
  }, [searchParams, refetch]);

  const [bidForm, setBidForm] = useState({
    goods_amount: "",
    service_fee: "",
    note: "",
  });
  const [paymentBid, setPaymentBid] = useState<BidSummary | null>(null);
  const [startingBidId, setStartingBidId] = useState<string | null>(null);
  const [extForm, setExtForm] = useState({ minutes: "", reason: "" });
  const [extLoading, setExtLoading] = useState(false);
  const [decidingExtId, setDecidingExtId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const handleBid = async () => {
    try {
      await createBid.mutateAsync({
        goods_amount: parseFloat(bidForm.goods_amount),
        service_fee: parseFloat(bidForm.service_fee),
        note: bidForm.note || undefined,
      });
      toast.success("Bid submitted", "Your bid has been placed.");
      setBidForm({ goods_amount: "", service_fee: "", note: "" });
    } catch (err) {
      handleApiError(err, "Failed to submit bid.");
    }
  };

  const handleAcceptBid = async (bidId: string) => {
    try {
      await acceptBid.mutateAsync(bidId);
      toast.success("Bid accepted", "Proceed to payment.");
      const accepted = request?.bids?.find((b) => b.id === bidId);
      if (accepted) {
        setPaymentBid(accepted);
      }
    } catch (err) {
      handleApiError(err, "Failed to accept bid.");
    }
  };

  const handleStartErrand = async (bidId: string) => {
    setStartingBidId(bidId);
    try {
      await api.post(`/deliveries/${bidId}/start`);
      toast.success("Errand started", "SLA timer is now active.");
      refetch();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to start errand.";
      toast.error("Error", msg);
    } finally {
      setStartingBidId(null);
    }
  };

  const handleRequestExtension = async (bidId: string) => {
    const mins = parseInt(extForm.minutes, 10);
    if (!mins || mins < 5 || !extForm.reason.trim()) return;
    setExtLoading(true);
    try {
      await api.post(`/deliveries/${bidId}/extensions`, {
        additional_minutes: mins,
        reason: extForm.reason.trim(),
      });
      toast.success("Extension requested", "Waiting for requester approval.");
      setExtForm({ minutes: "", reason: "" });
      refetch();
    } catch (err: any) {
      toast.error(
        "Error",
        err.response?.data?.message || "Failed to request extension.",
      );
    } finally {
      setExtLoading(false);
    }
  };

  const handleDecideExtension = async (
    extensionId: string,
    approved: boolean,
  ) => {
    setDecidingExtId(extensionId);
    try {
      await api.post(`/deliveries/extensions/${extensionId}/decide`, {
        approved,
      });
      toast.success(approved ? "Extension approved" : "Extension rejected");
      refetch();
    } catch {
      toast.error("Error", "Failed to process extension.");
    } finally {
      setDecidingExtId(null);
    }
  };

  const handleCancelErrand = async () => {
    if (!activeBid || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await api.post(`/deliveries/${activeBid.id}/cancel`, {
        reason: cancelReason.trim(),
      });
      toast.success("Errand cancelled", "A refund has been initiated.");
      setShowCancelConfirm(false);
      setCancelReason("");
      refetch();
    } catch (err: any) {
      toast.error(
        "Error",
        err.response?.data?.message || "Failed to cancel errand.",
      );
    } finally {
      setCancelling(false);
    }
  };

  // Find the active bid to fetch delivery SLA data — covers both
  // payment_made (pre-start) and in_progress (post-start) since
  // the delivery is created on start and we need started_at for the timer.
  const activeBid = request?.bids?.find(
    (b) => b.status === "in_progress" || b.status === "payment_made",
  );
  const { data: delivery } = useDelivery(activeBid?.id ?? "");

  if (isLoading) return <FormSkeleton fields={3} />;
  if (!request)
    return <p className="text-muted-foreground">Request not found.</p>;

  const isOwner = user?.id === request.requester?.id;
  const isErrander = user?.role === "errander";

  return (
    <div className="max-w-2xl space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Link href="/feed">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-[32px] font-bold text-foreground truncate">
            {request.title}
          </h1>
        </div>
        <Badge variant="secondary">{request.status}</Badge>
        {request.is_urgent && <Badge variant="destructive">Urgent</Badge>}
      </div>

      {/* Request Info */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <p className="text-base">{request.description}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {request.location}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              {request.requester?.name}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {new Date(request.created_at).toLocaleDateString()}
            </span>
          </div>
          {request.budget_hint && (
            <p className="text-sm font-medium">
              Budget: ₦{request.budget_hint.toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bids Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Bids ({request.bids?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {request.bids?.map((bid: BidSummary) => (
            <div
              key={bid.id}
              className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-muted/30 transition-colors"
            >
              <div>
                <p className="font-semibold">{bid.errander?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {bid.errander?.completed_orders} orders completed
                </p>
                <p className="text-sm mt-1">
                  Goods: ₦{bid.goods_amount.toLocaleString()} + Service: ₦
                  {bid.service_fee.toLocaleString()}
                </p>
                <p className="text-sm font-semibold">
                  Total: ₦{bid.total_amount.toLocaleString()}
                </p>
                {bid.note && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {bid.note}
                  </p>
                )}
              </div>
              <div className="text-right">
                <Badge
                  variant={
                    bid.status === "accepted" ||
                    bid.status === "payment_made" ||
                    bid.status === "in_progress"
                      ? "success"
                      : bid.status === "rejected"
                        ? "destructive"
                        : bid.status === "escrow_hold"
                          ? "warning"
                          : "secondary"
                  }
                >
                  {bid.status.replace("_", " ")}
                </Badge>

                {/* Requester: Accept bid */}
                {isOwner && bid.status === "pending" && (
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => handleAcceptBid(bid.id)}
                    disabled={acceptBid.isPending}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" /> Accept
                  </Button>
                )}

                {/* Requester: Pay after acceptance */}
                {isOwner && bid.status === "accepted" && (
                  <Button
                    size="sm"
                    className="mt-2"
                    variant="success"
                    onClick={() => setPaymentBid(bid)}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" /> Pay Now
                  </Button>
                )}

                {/* SLA Timer (visible to both) */}
                {delivery?.started_at && delivery?.deadline_at && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <SlaTimer
                      startedAt={delivery.started_at}
                      deadlineAt={delivery.deadline_at}
                      slaMinutes={delivery.sla_minutes}
                      gracePeriodMinutes={delivery.grace_period_minutes}
                      lateFeeAccrued={delivery.late_fee_accrued}
                      lateFeePerHour={delivery.late_fee_per_hour}
                    />
                  </div>
                )}

                {/* Dispute Window Countdown + Raise Dispute (visible to both) */}
                {delivery?.confirmed &&
                  delivery?.dispute_window_closes_at &&
                  request?.status !== "completed" &&
                  request?.status !== "funds_released" && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <DisputeWindowTimer
                        closesAt={delivery.dispute_window_closes_at}
                      />
                      {isOwner && (
                        <Link
                          href={`/disputes/new?delivery_id=${delivery.id}&bid_id=${bid.id}&request_id=${request.id}`}
                        >
                          <Button
                            size="sm"
                            variant="destructive"
                            className="mt-2 w-full"
                          >
                            Raise Dispute
                          </Button>
                        </Link>
                      )}
                      {isErrander && (
                        <div className="text-xs space-y-0.5 mt-1">
                          <p className="font-medium text-[#F97316]">
                            ₦{bid.total_amount?.toLocaleString()} held in escrow
                          </p>
                          <p className="text-muted-foreground">
                            Released after{" "}
                            {new Date(
                              delivery.dispute_window_closes_at,
                            ).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                {/* Requester: Cancel if late threshold exceeded */}
                {isOwner &&
                  delivery?.late_threshold_exceeded &&
                  bid.status === "in_progress" && (
                    <div className="mt-2 pt-2 border-t border-border">
                      {!showCancelConfirm ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full"
                          onClick={() => setShowCancelConfirm(true)}
                        >
                          Cancel Errand
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            This errand is significantly delayed. Cancelling
                            will initiate a refund.
                          </p>
                          <input
                            type="text"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Reason for cancellation"
                            className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-primary"
                          />
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs flex-1"
                              onClick={handleCancelErrand}
                              disabled={cancelling || !cancelReason.trim()}
                            >
                              {cancelling ? "..." : "Confirm Cancel"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => {
                                setShowCancelConfirm(false);
                                setCancelReason("");
                              }}
                            >
                              Keep Waiting
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                {/* Errander: Request More Time */}
                {isErrander && bid.status === "in_progress" && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">
                      Request More Time
                    </p>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min={5}
                        max={1440}
                        value={extForm.minutes}
                        onChange={(e) =>
                          setExtForm({ ...extForm, minutes: e.target.value })
                        }
                        placeholder="Minutes"
                        className="w-20 h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                      />
                      <input
                        type="text"
                        value={extForm.reason}
                        onChange={(e) =>
                          setExtForm({ ...extForm, reason: e.target.value })
                        }
                        placeholder="Reason (e.g. traffic)"
                        className="flex-1 h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => handleRequestExtension(bid.id)}
                        disabled={
                          extLoading ||
                          !extForm.minutes ||
                          !extForm.reason.trim()
                        }
                      >
                        {extLoading ? "..." : "Request"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Requester: Pending extension to approve/reject */}
                {isOwner &&
                  delivery?.pending_extension &&
                  bid.status === "in_progress" && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs font-medium text-[#F97316] mb-1.5">
                        Time Extension Requested
                      </p>
                      <p className="text-xs text-muted-foreground">
                        +{delivery.pending_extension.additional_minutes} min —{" "}
                        {delivery.pending_extension.reason}
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-[#10B981] hover:bg-[#10B981]/90"
                          onClick={() =>
                            handleDecideExtension(
                              delivery.pending_extension!.id,
                              true,
                            )
                          }
                          disabled={
                            decidingExtId === delivery.pending_extension!.id
                          }
                        >
                          {decidingExtId === delivery.pending_extension!.id
                            ? "..."
                            : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          onClick={() =>
                            handleDecideExtension(
                              delivery.pending_extension!.id,
                              false,
                            )
                          }
                          disabled={
                            decidingExtId === delivery.pending_extension!.id
                          }
                        >
                          {decidingExtId === delivery.pending_extension!.id
                            ? "..."
                            : "Reject"}
                        </Button>
                      </div>
                    </div>
                  )}

                {/* Errander: Start Errand after payment (or retry if stuck) */}
                {isErrander &&
                  (bid.status === "payment_made" ||
                    (bid.status === "in_progress" &&
                      !delivery?.started_at)) && (
                    <Button
                      size="sm"
                      className="mt-2"
                      variant="success"
                      onClick={() => handleStartErrand(bid.id)}
                      disabled={startingBidId === bid.id}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {startingBidId === bid.id
                        ? "Starting..."
                        : "Start Errand"}
                    </Button>
                  )}

                {/* Delivery page link (both errander and requester) */}
                {(isErrander || isOwner) && bid.status === "in_progress" && (
                  <Link href={`/delivery/${bid.id}`}>
                    <Button size="sm" className="mt-2" variant="outline">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {isErrander ? "Delivery" : "Track Delivery"}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
          {(!request.bids || request.bids.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No bids yet. Be the first to bid!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bid Form (erranders only) */}
      {isErrander && request.status === "open" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Submit a Bid
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Goods Amount (₦)</Label>
                <Input
                  type="number"
                  value={bidForm.goods_amount}
                  onChange={(e) =>
                    setBidForm({ ...bidForm, goods_amount: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Service Fee (₦)</Label>
                <Input
                  type="number"
                  value={bidForm.service_fee}
                  onChange={(e) =>
                    setBidForm({ ...bidForm, service_fee: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input
                value={bidForm.note}
                onChange={(e) =>
                  setBidForm({ ...bidForm, note: e.target.value })
                }
                placeholder="Add a note to your bid..."
              />
            </div>
            <Button
              onClick={handleBid}
              disabled={createBid.isPending}
              className="w-full"
            >
              <Send className="w-4 h-4 mr-2" />{" "}
              {createBid.isPending ? "Submitting..." : "Submit Bid"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Payment Modal */}
      {paymentBid && (
        <PaymentModal
          open={!!paymentBid}
          onClose={() => setPaymentBid(null)}
          bid={{
            id: paymentBid.id,
            goods_amount: paymentBid.goods_amount,
            service_fee: paymentBid.service_fee,
            platform_fee: paymentBid.platform_fee,
            total_amount: paymentBid.total_amount,
            status: paymentBid.status,
          }}
          onSuccess={() => {
            setPaymentBid(null);
            // Small delay to ensure DB transaction is committed, then refetch
            setTimeout(() => refetch(), 500);
          }}
        />
      )}
    </div>
  );
}
