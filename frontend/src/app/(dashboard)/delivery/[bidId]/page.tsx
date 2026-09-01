"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  KeyRound,
  CheckCircle,
  Clock,
  AlertCircle,
  Lock,
  MessageSquare,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSkeleton } from "@/components/shared/SkeletonLoader";
import { OtpInput } from "@/components/shared/OtpInput";
import { SlaTimer } from "@/components/shared/SlaTimer";
import { useSetPageHeader } from "@/components/layout/PageHeaderContext";
import { Amount, StatusBadge, Timeline, timeAgo, type TimelineItem } from "@/components/design";
import { useAuthStore } from "@/store/authStore";
import {
  useDelivery,
  useDeliveryTimeline,
  usePostDeliveryUpdateMutation,
  useConfirmDeliveryMutation,
} from "@/hooks/queries/delivery/use-delivery";
import { useConversations, useMessages } from "@/hooks/queries/chat/use-chat";
import { RatingCard } from "@/components/ratings/RatingCard";
import { DisputeWindowTimer } from "@/components/shared/DisputeWindowTimer";
import { toast } from "@/store/toastStore";
import api from "@/lib/api";
import { getApiErrorMessage } from "@/lib/error-handler";
import type { ApiResponse } from "@/types/api";

interface OtpData { otp: string; expires_in_minutes: number; expires_at: string; }
interface ConfirmData { delivery_id: string; confirmed_at: string; dispute_window_hours: number; dispute_window_closes_at: string; }

const QUICK_UPDATES = [
  { type: "heading_to_pickup" as const, label: "Headed to pickup" },
  { type: "item_purchased" as const, label: "Items picked up" },
  { type: "on_the_way" as const, label: "On the way" },
  { type: "arrived" as const, label: "Arrived at drop-off" },
];

export default function DeliveryPage() {
  const { bidId } = useParams<{ bidId: string }>();
  const { user } = useAuthStore();
  const [otp, setOtp] = useState<OtpData | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmData | null>(null);
  const [inputOtp, setInputOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Tick once a second so the timeline escrow label flips when the window closes
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isErrander = user?.role === "errander";
  const { data: delivery, isLoading } = useDelivery(bidId as string);
  const { data: timeline } = useDeliveryTimeline(bidId as string);
  const { data: conversations } = useConversations();

  useSetPageHeader(
    "Active errand",
    isErrander ? "Complete and submit your current errand" : "Track your errand in real time",
  );

  // Chat preview — find the conversation for this request
  const conversation = conversations?.find(
    (c) => c.request_id === delivery?.request?.id,
  );
  const { data: messages } = useMessages(conversation?.id ?? "");

  const postUpdate = usePostDeliveryUpdateMutation(bidId as string);
  const confirmDelivery = useConfirmDeliveryMutation(bidId as string);

  const handleGenerateOtp = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.post<ApiResponse<OtpData>>(`/deliveries/${bidId}/generate-otp`);
      setOtp(data.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to generate OTP"));
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    setLoading(true); setError("");
    try {
      const result = await confirmDelivery.mutateAsync({ otp: inputOtp });
      setConfirmResult(result);
    } catch (err) {
      setError(getApiErrorMessage(err, "Invalid OTP"));
    } finally { setLoading(false); }
  };

  const handleQuickUpdate = async (type: string, message: string) => {
    try {
      await postUpdate.mutateAsync({ type: type as never, message });
      toast.success("Update sent", "The requester can see your progress.");
    } catch (err) {
      toast.error("Error", getApiErrorMessage(err, "Could not post update."));
    }
  };

  if (isLoading) return <FormSkeleton fields={3} />;

  if (confirmResult) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-8 text-center shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-[#00A86B]" />
          <h2 className="mb-2 font-heading text-xl font-bold text-[#0A1628]">
            Delivery Confirmed!
          </h2>
          <p className="mb-4 text-[#6C757D]">
            Dispute window: {confirmResult.dispute_window_hours} hours
          </p>
          <p className="text-sm text-[#6C757D]">
            Window closes: {new Date(confirmResult.dispute_window_closes_at).toLocaleString()}
          </p>
        </div>

        {/* RatingCard renders null on its own once the dispute window passes */}
        {!isErrander && !delivery?.requester_has_rated && (
          <RatingCard
            bidId={bidId as string}
            erranderName={delivery?.errander?.name ?? "your errander"}
            closesAt={confirmResult.dispute_window_closes_at}
            requesterTipped={delivery?.requester_tipped}
          />
        )}
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-10 text-center shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
        <p className="text-[#6C757D]">This delivery is no longer available.</p>
      </div>
    );
  }

  const total = delivery.bid?.total_amount ?? 0;
  const otpGenerated = !!delivery.otp_generated_at;

  // Build timeline items from real delivery state
  const buildTimeline = (): TimelineItem[] => {
    const items: TimelineItem[] = [];
    if (delivery.started_at) {
      items.push({
        title: isErrander ? "Errand started" : "Errand started by errander",
        date: new Date(delivery.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        state: "done",
      });
    }
    (timeline?.updates ?? []).forEach((u) => {
      items.push({
        title: u.message,
        date: new Date(u.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        state: "done",
      });
    });
    if (otpGenerated && !delivery.confirmed) {
      items.push({
        title: isErrander ? "Delivery code generated" : "Errander marked this errand complete",
        date: delivery.otp_generated_at ? new Date(delivery.otp_generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
        state: "now",
      });
    }
    if (delivery.confirmed) {
      const windowOpen =
        !!delivery.dispute_window_closes_at &&
        new Date(delivery.dispute_window_closes_at).getTime() > clock;
      items.push({
        title: windowOpen
          ? "Confirmed — funds held in escrow"
          : "Confirmed — payment released",
        date: delivery.confirmed_at ? new Date(delivery.confirmed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
        state: "done",
      });
    } else if (!otpGenerated) {
      items.push({
        title: isErrander ? "On the way to drop-off" : "Confirm with code & release payment",
        date: "Pending",
        state: items.length === 1 && !timeline?.updates?.length ? "now" : "pending",
      });
    }
    return items;
  };

  const timelineItems = buildTimeline();

  return (
    <div className="space-y-[22px]">
      {error && (
        <div className="flex items-center gap-2 rounded-[11px] border border-[#FF1744]/20 bg-[#FF1744]/10 p-3 text-sm text-[#FF1744]">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid items-start gap-[18px] xl:grid-cols-[2fr_1fr]">
        {/* ── Left column ─────────────────────────────────── */}
        <div className="space-y-[18px]">
          {/* Header card */}
          <div className="flex items-center justify-between rounded-[20px] border border-[#E9ECEF] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
            <h2 className="font-heading text-[15px] font-bold text-[#0A1628]">
              {delivery.request?.title ?? "Errand"}
            </h2>
            <StatusBadge
              status={delivery.request?.status ?? delivery.bid?.status ?? "in_progress"}
              label={(delivery.request?.status ?? delivery.bid?.status ?? "in_progress").replace(/_/g, " ")}
            />
          </div>

          {/* SLA + progress timeline */}
          <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
            {delivery.started_at && delivery.deadline_at && (
              <div className="mb-4">
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
            <span className="mb-2 block text-xs font-bold text-[#495057]">
              {isErrander ? "Progress checklist" : "Errand timeline"}
            </span>
            <Timeline items={timelineItems} className="mt-2" />
          </div>

          {/* Errander: quick status updates */}
          {isErrander && !delivery.confirmed && (
            <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
              <span className="mb-2 block text-xs font-bold text-[#495057]">
                Post a progress update
              </span>
              <div className="flex flex-wrap gap-2">
                {QUICK_UPDATES.map((u) => (
                  <button
                    key={u.type}
                    type="button"
                    disabled={postUpdate.isPending}
                    onClick={() => handleQuickUpdate(u.type, u.label)}
                    className="rounded-full border border-[#CED4DA] bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#0A1628] transition-colors hover:border-[#00A86B] hover:text-[#008554] disabled:opacity-50"
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Submit for completion (errander) ─────────── */}
          {isErrander && !delivery.confirmed && (
            <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
              <h2 className="mb-3 font-heading text-[15px] font-bold text-[#0A1628]">
                Submit for completion
              </h2>
              {!otp ? (
                <>
                  <p className="mb-4 flex gap-2 text-[12.5px] text-[#495057]">
                    <Lock className="h-4 w-4 shrink-0 text-[#00A86B]" />
                    A confirmation code goes to {delivery.request?.requester?.name ?? "the requester"} —
                    they enter it to release your <Amount value={total} />.
                  </p>
                  <Button
                    onClick={handleGenerateOtp}
                    disabled={loading}
                    className="h-11 w-full justify-center rounded-[11px] bg-[#00A86B] font-heading text-[13px] font-bold text-white hover:bg-[#008554]"
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    {loading ? "Generating..." : "Generate delivery code"}
                  </Button>
                </>
              ) : (
                <div className="text-center">
                  <KeyRound className="mx-auto mb-3 h-8 w-8 text-[#00A86B]" />
                  <p className="mb-2 text-sm text-[#6C757D]">
                    Share this code with {delivery.request?.requester?.name ?? "the requester"}
                  </p>
                  <div className="mb-4 font-mono text-4xl font-bold tracking-[0.5em] text-[#0A1628]">
                    {otp.otp}
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-[#6C757D]">
                    <Clock className="h-4 w-4" />
                    <span>Expires in {otp.expires_in_minutes} minutes</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Confirm & release (requester) ─────────────── */}
          {!isErrander && !confirmResult && !delivery.confirmed && (
            <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
              {otpGenerated ? (
                <div className="mb-3.5 inline-flex items-center gap-1.5 rounded-full bg-[#E6F9F0] px-3 py-1.5 text-[12px] font-bold text-[#00633F]">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {delivery.errander?.name ?? "Errander"} marked this errand complete
                </div>
              ) : (
                <div className="mb-3.5 inline-flex items-center gap-1.5 rounded-full bg-[#E8F0FF] px-3 py-1.5 text-[12px] font-bold text-[#1D4FB8]">
                  <Clock className="h-3.5 w-3.5" />
                  Waiting for {delivery.errander?.name ?? "the errander"} to arrive
                </div>
              )}
              <div className="mb-4 text-[13.5px] text-[#495057]">
                Enter the confirmation code you received to release the{" "}
                <Amount value={total} /> held in escrow.
              </div>
              <OtpInput value={inputOtp} onChange={setInputOtp} disabled={loading} error={error} />
              <Button
                onClick={handleConfirm}
                disabled={loading || inputOtp.length !== 6}
                className="mt-4 h-12 w-full justify-center rounded-[11px] bg-[#00A86B] font-heading text-[13px] font-bold text-white hover:bg-[#008554]"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirm &amp; release <span className="ml-1 font-mono">₦{total.toLocaleString()}</span>
              </Button>
            </div>
          )}

          {/* Requester: escrow protection */}
          {!isErrander && !delivery.confirmed && (
            <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
              <h2 className="mb-2.5 font-heading text-[15px] font-bold text-[#0A1628]">
                Escrow protection
              </h2>
              <div className="flex gap-2.5 text-[12.5px] text-[#495057]">
                <Lock className="h-4 w-4 shrink-0 text-[#00A86B]" />
                <span>
                  <Amount value={total} /> is held safely and only releases to{" "}
                  {delivery.errander?.name ?? "the errander"} once you confirm with the
                  code sent to your phone.
                </span>
              </div>
            </div>
          )}

          {/* ── Dispute window (confirmed — both roles) ────── */}
          {delivery.confirmed && delivery.dispute_window_closes_at && (
            <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
              <h2 className="mb-2.5 font-heading text-[15px] font-bold text-[#0A1628]">
                Dispute window
              </h2>
              <DisputeWindowTimer
                closesAt={delivery.dispute_window_closes_at}
              />
              {(() => {
                const windowOpen =
                  new Date(delivery.dispute_window_closes_at as string).getTime() > clock;
                if (!windowOpen) {
                  return (
                    <div className="mt-3 border-t border-[#E9ECEF] pt-3 text-xs">
                      {isErrander ? (
                        <p className="font-medium text-[#008554]">
                          Escrow released — funds credited to your wallet.
                        </p>
                      ) : (
                        <p className="text-[#6C757D]">
                          Dispute window closed — payment released to the errander.
                        </p>
                      )}
                    </div>
                  );
                }
                if (!isErrander) {
                  return (
                    <div className="mt-3 border-t border-[#E9ECEF] pt-3">
                      <Link
                        href={`/disputes/new?delivery_id=${delivery.id}&bid_id=${delivery.bid_id}&request_id=${delivery.request?.id ?? ""}`}
                      >
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full rounded-[9px]"
                        >
                          Raise Dispute
                        </Button>
                      </Link>
                      {!delivery.requester_has_rated && (
                        <div className="mt-3">
                          <RatingCard
                            bidId={bidId as string}
                            erranderName={delivery.errander?.name ?? "your errander"}
                            closesAt={delivery.dispute_window_closes_at}
                            requesterTipped={delivery.requester_tipped}
                          />
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <div className="mt-3 space-y-0.5 border-t border-[#E9ECEF] pt-3 text-xs">
                    <p className="font-medium text-[#B24E00]">
                      <Amount value={total} /> held in escrow
                    </p>
                    <p className="text-[#6C757D]">
                      Released after{" "}
                      {new Date(delivery.dispute_window_closes_at).toLocaleString()}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── Right column ───────────────────────────────── */}
        <div className="space-y-[18px]">
          {/* Other-party card */}
          <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#E6F9F0] font-heading text-[14px] font-bold text-[#00633F]">
                {(isErrander
                  ? delivery.request?.requester?.name
                  : delivery.errander?.name
                )
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) ?? "—"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-heading text-[14.5px] font-bold text-[#0A1628]">
                  {isErrander
                    ? delivery.request?.requester?.name ?? "Requester"
                    : delivery.errander?.name ?? "Errander"}
                </div>
                <div className="text-xs text-[#6C757D]">
                  {isErrander
                    ? `Requester · ${delivery.request?.location ?? ""}`
                    : delivery.confirmed
                      ? "Errand complete"
                      : otpGenerated
                        ? "Waiting for your confirmation"
                        : `On the way to your address${delivery.minutes_remaining ? ` · ETA ${delivery.minutes_remaining} min` : ""}`}
                </div>
              </div>
              {conversation && (
                <Link href={`/chat/${conversation.id}`}>
                  <button
                    className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-[#E9ECEF] bg-[#F8F9FA] text-[#495057] transition-colors hover:bg-[#E9ECEF]"
                    aria-label="Open chat"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                </Link>
              )}
            </div>
          </div>

          {/* Inline chat preview (errander) */}
          {isErrander && conversation && (
            <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-heading text-[15px] font-bold text-[#0A1628]">Chat</h2>
                <Link
                  href={`/chat/${conversation.id}`}
                  className="flex items-center gap-1 text-[12.5px] font-bold text-[#00A86B] hover:text-[#008554]"
                >
                  Open full chat <Send className="h-3 w-3" />
                </Link>
              </div>
              <div className="flex flex-col gap-2.5 rounded-[14px] bg-[#F8F9FA] p-3.5">
                {(messages ?? []).slice(-4).map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`max-w-[80%] rounded-xl px-3 py-2 text-[12.5px] ${
                        isMine
                          ? "self-end rounded-br-[2px] bg-[#0A1628] text-white"
                          : "self-start rounded-bl-[2px] border border-[#E9ECEF] bg-white text-[#0A1628]"
                      }`}
                    >
                      {msg.content}
                      <span
                        className={`mt-0.5 block text-[10px] ${
                          isMine ? "text-white/60" : "text-[#ADB5BD]"
                        }`}
                      >
                        {timeAgo(msg.created_at)}
                      </span>
                    </div>
                  );
                })}
                {(messages ?? []).length === 0 && (
                  <p className="py-2 text-center text-[12px] text-[#ADB5BD]">
                    No messages yet — say hi!
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
