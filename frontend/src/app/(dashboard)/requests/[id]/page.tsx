"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { MapPin, Clock, User, ArrowLeft, CheckCircle, Send, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSkeleton } from "@/components/shared/SkeletonLoader";
import { useSetPageHeader } from "@/components/layout/PageHeaderContext";
import { Amount, Chip, Stars, StatusBadge } from "@/components/design";
import { useAuthStore } from "@/store/authStore";
import { useRequest } from "@/hooks/queries/requests/use-requests";
import { useCreateBidMutation, useAcceptBidMutation } from "@/hooks/queries/bids/use-bids";
import { toast } from "@/store/toastStore";
import { handleApiError, getApiErrorMessage } from "@/lib/error-handler";
import api from "@/lib/api";
import { paymentsApi } from "@/services/api/payments.api";
import { PaymentModal } from "@/components/payments/PaymentModal";
import { RatingCard } from "@/components/ratings/RatingCard";
import { SlaTimer } from "@/components/shared/SlaTimer";
import { DisputeWindowTimer } from "@/components/shared/DisputeWindowTimer";
import { useDelivery } from "@/hooks/queries/delivery/use-delivery";
import type { BidSummary } from "@/types/api/requests";
import Link from "next/link";

type BidSort = "rating" | "price" | "newest";

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { data: request, isLoading, refetch } = useRequest(id);
  const createBid = useCreateBidMutation(id);
  const acceptBid = useAcceptBidMutation();
  const [bidSort, setBidSort] = useState<BidSort>("rating");

  useSetPageHeader(
    request ? (user?.id === request.requester?.id ? "Bids & requests" : request.title) : "Request",
    user?.id === request?.requester?.id ? "Compare and accept bids" : "Request details",
  );

  // Handle return from card payment redirect — actively verify
  useEffect(() => {
    const paymentRef = searchParams.get("payment_ref");
    if (!paymentRef) return;

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 8;

    const clearParams = () => {
      window.history.replaceState({}, "", window.location.pathname);
    };

    const verifyPayment = async () => {
      attempts += 1;
      try {
        const data = await paymentsApi.verifyByRef(paymentRef);
        if (cancelled) return;

        if (data.status === "successful") {
          toast.success(
            "Payment confirmed",
            "The errander can now start your errand.",
          );
          refetch();
          clearParams();
        } else if (data.status === "failed") {
          toast.error(
            "Payment failed",
            data.failure_reason || "Please try again.",
          );
          refetch();
          clearParams();
        } else if (data.status === "cancelled") {
          toast.warning("Payment cancelled", "You can pay again when ready.");
          refetch();
          clearParams();
        } else if (attempts >= MAX_ATTEMPTS) {
          toast(
            "Payment still pending",
            "We'll confirm it automatically shortly.",
            "default",
          );
          refetch();
          clearParams();
        } else {
          // Still pending — poll again after delay
          if (attempts === 1) {
            toast("Verifying payment", "Checking with provider...", "default");
          }
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
    } catch (err) {
      toast.error("Error", getApiErrorMessage(err, "Failed to start errand."));
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
    } catch (err) {
      toast.error(
        "Error",
        getApiErrorMessage(err, "Failed to request extension."),
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
    } catch (err) {
      toast.error(
        "Error",
        getApiErrorMessage(err, "Failed to cancel errand."),
      );
    } finally {
      setCancelling(false);
    }
  };

  // Find the active bid to fetch delivery SLA data — covers
  // payment_made (pre-start), in_progress (post-start) and completed
  // (post-confirm, so the rating card can render during the dispute window).
  const activeBid =
    request?.bids?.find(
      (b) => b.status === "in_progress" || b.status === "payment_made",
    ) ?? request?.bids?.find((b) => b.status === "completed");
  const { data: delivery } = useDelivery(activeBid?.id ?? "");

  const sortedBids = useMemo(() => {
    const bids = [...(request?.bids ?? [])];
    if (bidSort === "price") {
      bids.sort((a, b) => a.total_amount - b.total_amount);
    } else if (bidSort === "rating") {
      bids.sort((a, b) => (b.errander?.rating ?? 0) - (a.errander?.rating ?? 0));
    } else {
      bids.reverse(); // newest last in payload → newest first
    }
    return bids;
  }, [request?.bids, bidSort]);

  if (isLoading) return <FormSkeleton fields={3} />;
  if (!request)
    return <p className="text-muted-foreground">Request not found.</p>;

  const isOwner = user?.id === request.requester?.id;
  const isErrander = user?.role === "errander";

  return (
    <div className="space-y-[22px]">
      {/* Header card (owner) or back + title (errander) */}
      {isOwner ? (
        <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-heading text-[15px] font-bold text-[#0A1628]">
                {request.title}
              </div>
              <div className="mt-1 text-[12.5px] text-[#6C757D]">
                {request.budget_hint != null && <>Budget <Amount value={request.budget_hint} /> · </>}
                {request.bids_count} bid{request.bids_count !== 1 ? "s" : ""} received
                {request.is_urgent && <span className="ml-1 text-[#FF6B00]">· Urgent</span>}
              </div>
            </div>
            <StatusBadge
              status={request.status === "open" ? "bids_open" : request.status}
              label={request.status === "open" ? "Bids open" : request.status.replace(/_/g, " ")}
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Link href="/feed">
            <Button variant="ghost" size="icon" className="rounded-[11px]">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="truncate font-heading text-[20px] font-bold text-[#0A1628]">
              {request.title}
            </h1>
          </div>
          <StatusBadge status={request.status} />
          {request.is_urgent && (
            <Badge className="rounded-full bg-[#FFE3E9] px-2.5 py-1 text-[11px] font-bold text-[#FF1744]">
              Urgent
            </Badge>
          )}
        </div>
      )}

      {/* Request info card */}
      <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
        <p className="text-base text-[#0A1628]">{request.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-[#6C757D]">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {request.location}
          </span>
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            {request.requester?.name}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {new Date(request.created_at).toLocaleDateString()}
          </span>
          {request.budget_hint != null && (
            <span className="flex items-center gap-1.5 font-medium text-[#0A1628]">
              Budget: <Amount value={request.budget_hint} />
            </span>
          )}
        </div>
      </div>

      {/* Bids section */}
      <div>
        {isOwner && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-[15px] font-bold text-[#0A1628]">
              Compare bids
            </h2>
            <div className="flex gap-2">
              <Chip on={bidSort === "rating"} onClick={() => setBidSort("rating")}>
                Best rated
              </Chip>
              <Chip on={bidSort === "price"} onClick={() => setBidSort("price")}>
                Lowest price
              </Chip>
              <Chip on={bidSort === "newest"} onClick={() => setBidSort("newest")}>
                Newest
              </Chip>
            </div>
          </div>
        )}

        {(!request.bids || request.bids.length === 0) && (
          <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-6 text-center shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
            <p className="text-sm text-[#6C757D]">No bids yet. Be the first to bid!</p>
          </div>
        )}

        <div className={isOwner ? "grid gap-[18px] md:grid-cols-2 2xl:grid-cols-3" : "space-y-3"}>
          {sortedBids.map((bid: BidSummary) => (
            <div
              key={bid.id}
              className={`rounded-[20px] border bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)] ${
                bid.status === "pending" && isOwner
                  ? "border-[#00A86B] ring-[3px] ring-[#E6F9F0]"
                  : "border-[#E9ECEF]"
              }`}
            >
              {/* Errander identity */}
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#E6F9F0] font-heading text-[13px] font-bold text-[#00633F]">
                  {bid.errander?.name
                    ? bid.errander.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "EB"}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-heading text-[14px] font-bold text-[#0A1628]">
                    {bid.errander?.name ?? "Errander"}
                  </div>
                  <Stars rating={bid.errander?.rating} count={bid.errander?.completed_orders} />
                </div>
                <div className="ml-auto">
                  <StatusBadge status={bid.status} />
                </div>
              </div>

              <Amount value={bid.total_amount} className="mb-1 block text-[22px] text-[#0A1628]" />
              <div className="mb-3 text-xs text-[#6C757D]">
                Goods <Amount value={bid.goods_amount} /> + Service <Amount value={bid.service_fee} />
              </div>
              {bid.note && (
                <p className="mb-3 line-clamp-2 text-xs text-[#6C757D]">“{bid.note}”</p>
              )}

              {/* Actions */}
              {isOwner && bid.status === "pending" && (
                <Button
                  className="h-10 w-full justify-center rounded-[11px] bg-[#00A86B] font-heading text-[13px] font-bold text-white hover:bg-[#008554]"
                  onClick={() => handleAcceptBid(bid.id)}
                  disabled={acceptBid.isPending}
                >
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Accept &amp; pay
                </Button>
              )}

              {isOwner && bid.status === "accepted" && (
                <Button
                  variant="success"
                  className="h-10 w-full justify-center rounded-[11px] font-heading text-[13px] font-bold"
                  onClick={() => setPaymentBid(bid)}
                >
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Pay Now
                </Button>
              )}

              {!isOwner && isErrander && (
                <Link href={`/profile/${bid.errander?.id ?? ""}`}>
                  <Button
                    variant="outline"
                    className="h-10 w-full justify-center rounded-[11px] font-heading text-[13px] font-bold"
                  >
                    View profile <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}

              {/* SLA Timer (visible to both) */}
              {delivery?.started_at && delivery?.deadline_at && (
                <div className="mt-3 border-t border-[#E9ECEF] pt-3">
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
                  <div className="mt-3 border-t border-[#E9ECEF] pt-3">
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
                          className="mt-2 w-full rounded-[9px]"
                        >
                          Raise Dispute
                        </Button>
                      </Link>
                    )}
                    {isErrander && (
                      <div className="mt-1 space-y-0.5 text-xs">
                        <p className="font-medium text-[#B24E00]">
                          <Amount value={bid.total_amount} /> held in escrow
                        </p>
                        <p className="text-[#6C757D]">
                          Released after{" "}
                          {new Date(
                            delivery.dispute_window_closes_at,
                          ).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                )}

              {/* Requester: rate & tip during the dispute window */}
              {isOwner &&
                bid.id === activeBid?.id &&
                delivery?.confirmed &&
                delivery?.dispute_window_closes_at &&
                !delivery?.requester_has_rated && (
                  <div className="mt-3 border-t border-[#E9ECEF] pt-3">
                    <RatingCard
                      bidId={bid.id}
                      erranderName={bid.errander?.name ?? "your errander"}
                      closesAt={delivery.dispute_window_closes_at}
                      requesterTipped={delivery?.requester_tipped}
                    />
                  </div>
                )}

              {/* Requester: Cancel if late threshold exceeded */}
              {isOwner &&
                delivery?.late_threshold_exceeded &&
                bid.status === "in_progress" && (
                  <div className="mt-3 border-t border-[#E9ECEF] pt-3">
                    {!showCancelConfirm ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full rounded-[9px]"
                        onClick={() => setShowCancelConfirm(true)}
                      >
                        Cancel Errand
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-[#6C757D]">
                          This errand is significantly delayed. Cancelling
                          will initiate a refund.
                        </p>
                        <input
                          type="text"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="Reason for cancellation"
                          className="h-8 w-full rounded-lg border border-[#CED4DA] bg-[#F8F9FA] px-2 text-xs outline-none focus:border-[#00A86B]"
                        />
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 flex-1 rounded-[9px] text-xs"
                            onClick={handleCancelErrand}
                            disabled={cancelling || !cancelReason.trim()}
                          >
                            {cancelling ? "..." : "Confirm Cancel"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 rounded-[9px] text-xs"
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
                <div className="mt-3 border-t border-[#E9ECEF] pt-3">
                  <p className="mb-1.5 text-xs font-medium text-[#6C757D]">
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
                      className="h-8 w-20 rounded-lg border border-[#CED4DA] bg-[#F8F9FA] px-2 text-xs outline-none focus:border-[#00A86B]"
                    />
                    <input
                      type="text"
                      value={extForm.reason}
                      onChange={(e) =>
                        setExtForm({ ...extForm, reason: e.target.value })
                      }
                      placeholder="Reason (e.g. traffic)"
                      className="h-8 flex-1 rounded-lg border border-[#CED4DA] bg-[#F8F9FA] px-2 text-xs outline-none focus:border-[#00A86B]"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-[9px] text-xs"
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
                  <div className="mt-3 border-t border-[#E9ECEF] pt-3">
                    <p className="mb-1.5 text-xs font-medium text-[#B24E00]">
                      Time Extension Requested
                    </p>
                    <p className="text-xs text-[#6C757D]">
                      +{delivery.pending_extension.additional_minutes} min —{" "}
                      {delivery.pending_extension.reason}
                    </p>
                    <div className="mt-2 flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 flex-1 rounded-[9px] bg-[#00A86B] text-xs hover:bg-[#008554]"
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
                        className="h-7 flex-1 rounded-[9px] text-xs"
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
                    variant="success"
                    className="mt-3 h-8 w-full rounded-[9px] font-heading text-xs font-bold"
                    onClick={() => handleStartErrand(bid.id)}
                    disabled={startingBidId === bid.id}
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    {startingBidId === bid.id
                      ? "Starting..."
                      : "Start Errand"}
                  </Button>
                )}

              {/* Delivery page link (both errander and requester) */}
              {(isErrander || isOwner) && bid.status === "in_progress" && (
                <Link href={`/delivery/${bid.id}`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 h-8 w-full rounded-[9px] font-heading text-xs font-bold"
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    {isErrander ? "Delivery" : "Track Delivery"}
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bid Form (erranders only) */}
      {isErrander && request.status === "open" && (
        <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
          <h2 className="mb-4 font-heading text-[15px] font-bold text-[#0A1628]">
            Submit a Bid
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-[#495057]">Goods Amount (₦)</Label>
                <Input
                  type="number"
                  value={bidForm.goods_amount}
                  onChange={(e) =>
                    setBidForm({ ...bidForm, goods_amount: e.target.value })
                  }
                  placeholder="0"
                  className="h-10 rounded-[11px] border-[#CED4DA] bg-[#F8F9FA]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-[#495057]">Service Fee (₦)</Label>
                <Input
                  type="number"
                  value={bidForm.service_fee}
                  onChange={(e) =>
                    setBidForm({ ...bidForm, service_fee: e.target.value })
                  }
                  placeholder="0"
                  className="h-10 rounded-[11px] border-[#CED4DA] bg-[#F8F9FA]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-[#495057]">Note (optional)</Label>
              <Input
                value={bidForm.note}
                onChange={(e) =>
                  setBidForm({ ...bidForm, note: e.target.value })
                }
                placeholder="Add a note to your bid..."
                className="h-10 rounded-[11px] border-[#CED4DA] bg-[#F8F9FA]"
              />
            </div>
            <Button
              onClick={handleBid}
              disabled={createBid.isPending}
              className="h-11 w-full justify-center rounded-[11px] bg-[#00A86B] font-heading text-[13px] font-bold text-white hover:bg-[#008554]"
            >
              <Send className="mr-2 h-4 w-4" />{" "}
              {createBid.isPending ? "Submitting..." : "Submit Bid"}
            </Button>
          </div>
        </div>
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
