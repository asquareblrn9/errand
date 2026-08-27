"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormSkeleton } from "@/components/shared/SkeletonLoader";
import { useSetPageHeader } from "@/components/layout/PageHeaderContext";
import { useCreateDisputeMutation } from "@/hooks/queries/disputes/use-disputes";
import {
  createDisputeSchema,
  type CreateDisputeFormData,
} from "@/schemas/dispute.schema";
import { getApiErrorMessage } from "@/lib/error-handler";
import { toast } from "@/store/toastStore";
import Link from "next/link";

const REASON_SUGGESTIONS = [
  "Item not received",
  "Item damaged or wrong",
  "Errander unresponsive",
  "Payment issue",
];

function NewDisputeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deliveryId = searchParams.get("delivery_id");
  const requestId = searchParams.get("request_id");

  useSetPageHeader("Raise a dispute", "Tell us what went wrong with this errand");

  const createDispute = useCreateDisputeMutation();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateDisputeFormData>({
    resolver: zodResolver(createDisputeSchema),
    defaultValues: { delivery_id: deliveryId ?? "", reason: "", description: "" },
  });

  const reason = watch("reason");
  const description = watch("description") ?? "";

  const onSubmit = async (values: CreateDisputeFormData) => {
    if (!deliveryId) return;
    try {
      const res = await createDispute.mutateAsync({
        delivery_id: deliveryId,
        reason: values.reason,
        description: values.description,
      });
      const disputeId = res?.data?.data?.id as string | undefined;
      toast.success(
        "Dispute opened",
        "An admin will review it within 24 hours. Your funds stay in escrow.",
      );
      router.push(disputeId ? `/disputes/${disputeId}` : "/disputes");
    } catch (err) {
      toast.error("Could not open dispute", getApiErrorMessage(err, "Please try again."));
    }
  };

  // Opened directly without an errand context — the dispute form needs a delivery
  if (!deliveryId) {
    return (
      <div className="mx-auto max-w-lg rounded-[20px] border border-[#E9ECEF] bg-white p-8 text-center shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-[#FF6B00]" />
        <h2 className="mb-2 font-heading text-[17px] font-bold text-[#0A1628]">
          No errand selected
        </h2>
        <p className="mb-5 text-sm text-[#6C757D]">
          Open a dispute from the errand page while the dispute window is
          active — that tells us which errand the issue is about.
        </p>
        <div className="flex justify-center gap-2">
          <Link href="/my-requests">
            <Button className="rounded-[11px] bg-[#00A86B] font-heading text-[13px] font-bold text-white hover:bg-[#008554]">
              Go to my errands
            </Button>
          </Link>
          <Link href="/disputes">
            <Button variant="outline" className="rounded-[11px] font-heading text-[13px] font-bold">
              My disputes
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-[18px]">
      <div className="flex items-center gap-3">
        <Link href={requestId ? `/requests/${requestId}` : "/disputes"}>
          <Button variant="ghost" size="icon" className="rounded-[11px]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading text-[20px] font-bold text-[#0A1628]">
            Raise a dispute
          </h1>
          <p className="text-[12.5px] text-[#6C757D]">
            Your payment stays in escrow until an admin resolves it
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]"
      >
        {/* Reason */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-[#495057]">Reason</Label>
          <Input
            {...register("reason")}
            placeholder="e.g. Item not received"
            maxLength={200}
            className="h-10 rounded-[11px] border-[#CED4DA] bg-[#F8F9FA]"
          />
          <div className="flex flex-wrap gap-2">
            {REASON_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setValue("reason", s, { shouldValidate: true })}
                className={
                  reason === s
                    ? "rounded-full border border-[#00A86B] bg-[#00A86B] px-3 py-1 text-[12px] font-semibold text-white transition-colors"
                    : "rounded-full border border-[#CED4DA] bg-white px-3 py-1 text-[12px] font-semibold text-[#0A1628] transition-colors hover:border-[#00A86B]"
                }
              >
                {s}
              </button>
            ))}
          </div>
          {errors.reason && (
            <p className="text-xs text-[#FF1744]">{errors.reason.message}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold text-[#495057]">
              Description
            </Label>
            <span className="text-[11px] text-[#ADB5BD]">
              {description.length}/2000
            </span>
          </div>
          <Textarea
            {...register("description")}
            rows={6}
            maxLength={2000}
            placeholder="What went wrong? Include details like dates, what you received vs what you ordered, and any messages with the errander."
            className="resize-none rounded-[11px]"
          />
          {errors.description && (
            <p className="text-xs text-[#FF1744]">{errors.description.message}</p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={createDispute.isPending}
          className="h-11 w-full justify-center rounded-[11px] bg-[#00A86B] font-heading text-[13px] font-bold text-white hover:bg-[#008554]"
        >
          {createDispute.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening dispute…
            </>
          ) : (
            <>
              <ShieldAlert className="mr-2 h-4 w-4" /> Open Dispute
            </>
          )}
        </Button>

        <p className="text-center text-[11.5px] text-[#6C757D]">
          An admin will review your dispute within 24 hours. The errander will
          get a chance to respond with their side of the story.
        </p>
      </form>
    </div>
  );
}

export default function NewDisputePage() {
  return (
    <Suspense fallback={<FormSkeleton fields={3} />}>
      <NewDisputeContent />
    </Suspense>
  );
}
