"use client";

import { useEffect, useState } from "react";
import type { AxiosError } from "axios";
import { Star, CheckCircle2, Gift, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DisputeWindowTimer } from "@/components/shared/DisputeWindowTimer";
import { useCreateRatingMutation, useSendTipMutation } from "@/hooks/queries/ratings/use-ratings";
import { useWallet } from "@/hooks/queries/wallet/use-wallet";
import { toast } from "@/store/toastStore";
import { cn } from "@/lib/utils";
import type { ApiErrorResponse } from "@/types/api/common";

// ── Types ────────────────────────────────────────────────────

const TIP_PRESETS = [200, 500, 1000];

interface RatingCardProps {
  bidId: string;
  erranderName: string;
  closesAt: string;
  requesterTipped?: boolean;
  className?: string;
}

// ── Component ────────────────────────────────────────────────

export function RatingCard({
  bidId,
  erranderName,
  closesAt,
  requesterTipped = false,
  className,
}: RatingCardProps) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [tip, setTip] = useState<number | "custom" | null>(null);
  const [customTip, setCustomTip] = useState("");
  const [stage, setStage] = useState<"rate" | "rated" | "retired">("rate");
  const [tipDialogOpen, setTipDialogOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState("");
  const [tipped, setTipped] = useState(requesterTipped);
  const [now, setNow] = useState(() => Date.now());

  const createRating = useCreateRatingMutation(bidId);
  const sendTip = useSendTipMutation(bidId);
  const { data: wallet } = useWallet();

  // Auto-retire the card when the dispute window passes
  useEffect(() => {
    const closes = new Date(closesAt).getTime();
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= closes) {
        setStage("retired");
        return true;
      }
      return false;
    };
    if (tick()) return;
    const interval = setInterval(() => {
      if (tick()) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [closesAt]);

  const tipValue = tip === "custom" ? parseFloat(customTip) : tip ?? 0;

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.warning("Select a rating", "Tap a star to rate the errander.");
      return;
    }

    const payload = {
      bid_id: bidId,
      rating,
      review: review.trim() || undefined,
      tip: tipValue > 0 ? tipValue : undefined,
    };

    try {
      await createRating.mutateAsync(payload);
      toast.success("Rating sent", `Thanks! You rated ${erranderName} ${rating} star${rating > 1 ? "s" : ""}.`);
      setStage("rated");
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse & { code?: string }>;
      const code = axiosError.response?.data?.code;

      if (code === "already_tipped" && tipValue > 0) {
        // The tip went through earlier — resubmit the rating without it
        try {
          await createRating.mutateAsync({ bid_id: bidId, rating, review: review.trim() || undefined });
          toast.success("Rating sent", `Thanks! You rated ${erranderName} ${rating} star${rating > 1 ? "s" : ""}.`);
          setStage("rated");
          return;
        } catch {
          // fall through to generic error below
        }
      }

      if (code === "rating_window_closed") {
        toast.warning("Rating window closed", "Ratings are only available during the dispute window.");
        setStage("retired");
        return;
      }

      if (code === "already_rated") {
        setStage("rated");
        return;
      }

      if (code === "insufficient_funds") {
        toast.error("Insufficient balance", axiosError.response?.data?.message ?? "Top up your wallet to send this tip.");
        return;
      }

      toast.error("Could not submit rating", axiosError.response?.data?.message ?? "Please try again.");
    }
  };

  const handleSendTip = async () => {
    const amount = parseFloat(tipAmount);
    if (!amount || amount < 1) {
      toast.warning("Enter an amount", "Tip amount must be at least ₦1.");
      return;
    }
    try {
      await sendTip.mutateAsync({ amount });
      toast.success("Tip sent", `₦${amount.toLocaleString()} sent to ${erranderName}.`);
      setTipped(true);
      setTipDialogOpen(false);
      setTipAmount("");
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse & { code?: string }>;
      const code = axiosError.response?.data?.code;
      if (code === "already_tipped") {
        toast.warning("Already tipped", "You have already tipped this errand.");
        setTipped(true);
        setTipDialogOpen(false);
        return;
      }
      if (code === "tip_window_closed") {
        toast.warning("Tip window closed", "Tips are only available during the dispute window.");
        setTipDialogOpen(false);
        return;
      }
      toast.error("Could not send tip", axiosError.response?.data?.message ?? "Please try again.");
    }
  };

  if (stage === "retired" || now >= new Date(closesAt).getTime()) {
    return null;
  }

  if (stage === "rated") {
    return (
      <div className={cn("flex items-center gap-3 rounded-[14px] border border-[#E6F9F0] bg-[#F4FBF8] p-4", className)}>
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[#00A86B]" />
        <div className="flex-1">
          <p className="font-heading text-[13px] font-bold text-[#0A1628]">
            You rated {erranderName} {rating} star{rating > 1 ? "s" : ""}
          </p>
          <p className="text-xs text-[#6C757D]">Thanks for your feedback.</p>
        </div>
        {!tipped && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTipDialogOpen(true)}
            className="rounded-[9px] font-heading text-xs font-bold"
          >
            <Gift className="mr-1.5 h-3.5 w-3.5" /> Send tip
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-[14px] border border-[#E9ECEF] bg-white p-4", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-heading text-[14px] font-bold text-[#0A1628]">
          Rate {erranderName}
        </h3>
        <DisputeWindowTimer closesAt={closesAt} className="text-[11px]" />
      </div>

      {/* Star picker */}
      <div className="mb-3 flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
            onClick={() => setRating(star)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                "h-7 w-7",
                star <= rating ? "fill-[#FF6B00] text-[#FF6B00]" : "fill-[#E9ECEF] text-[#E9ECEF]",
              )}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-1 text-xs font-bold text-[#B24E00]">{rating}/5</span>
        )}
      </div>

      {/* Review */}
      <Textarea
        value={review}
        onChange={(e) => setReview(e.target.value)}
        placeholder="Add a comment (optional)"
        maxLength={500}
        rows={2}
        className="mb-3 resize-none rounded-[11px]"
      />

      {/* Tip chips */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {TIP_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setTip(tip === preset ? null : preset)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
              tip === preset
                ? "border-[#00A86B] bg-[#00A86B] text-white"
                : "border-[#CED4DA] bg-white text-[#0A1628] hover:border-[#00A86B]",
            )}
          >
            ₦{preset.toLocaleString()}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTip(tip === "custom" ? null : "custom")}
          className={cn(
            "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
            tip === "custom"
              ? "border-[#00A86B] bg-[#00A86B] text-white"
              : "border-[#CED4DA] bg-white text-[#0A1628] hover:border-[#00A86B]",
          )}
        >
          Custom
        </button>
        <button
          type="button"
          onClick={() => setTip(null)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
            tip === null
              ? "border-[#00A86B] bg-[#00A86B] text-white"
              : "border-[#CED4DA] bg-white text-[#0A1628] hover:border-[#00A86B]",
          )}
        >
          No tip
        </button>
      </div>
      {tip === "custom" && (
        <Input
          type="number"
          value={customTip}
          onChange={(e) => setCustomTip(e.target.value)}
          placeholder="Tip amount (₦)"
          min={1}
          max={100000}
          className="mb-3 rounded-[11px]"
        />
      )}

      <div className="flex items-center gap-2">
        <Button
          onClick={handleSubmit}
          disabled={createRating.isPending}
          className="flex-1 rounded-[11px] bg-[#00A86B] font-heading text-[13px] font-bold text-white hover:bg-[#008554]"
        >
          {createRating.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
            </>
          ) : (
            "Submit rating"
          )}
        </Button>
        {!tipped && (
          <Button
            variant="outline"
            onClick={() => setTipDialogOpen(true)}
            className="rounded-[11px] font-heading text-[13px] font-bold"
          >
            <Gift className="mr-1.5 h-4 w-4" /> Send tip
          </Button>
        )}
      </div>

      {/* Tip dialog */}
      <Dialog open={tipDialogOpen} onOpenChange={setTipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a tip to {erranderName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input
                type="number"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                placeholder="1000"
                min={1}
                max={100000}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Wallet balance:{" "}
              <span className="font-semibold text-foreground">
                ₦{(wallet?.available_balance ?? 0).toLocaleString()}
              </span>
            </p>
            <Button
              className="w-full"
              disabled={sendTip.isPending || !tipAmount || parseFloat(tipAmount) < 1}
              onClick={handleSendTip}
            >
              {sendTip.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                "Send tip"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
