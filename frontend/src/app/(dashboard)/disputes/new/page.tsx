"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, ShieldAlert, Upload, X } from "lucide-react";
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

const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_MB = 5;
const ALLOWED_EVIDENCE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
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

  // ── Evidence uploads ──────────────────────────────────────
  const [evidence, setEvidence] = useState<{ file: File; url: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const evidenceRef = useRef(evidence);
  evidenceRef.current = evidence;

  // Revoke object URLs when the page unmounts
  useEffect(() => {
    return () => {
      evidenceRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  const handleEvidenceFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remaining = MAX_EVIDENCE_FILES - evidence.length;
    if (remaining <= 0) {
      toast.warning("Too many files", `You can attach up to ${MAX_EVIDENCE_FILES} files.`);
      return;
    }

    const next: { file: File; url: string }[] = [];
    for (const file of Array.from(files).slice(0, remaining)) {
      if (!ALLOWED_EVIDENCE_TYPES.includes(file.type)) {
        toast.warning("Unsupported file", `${file.name} must be a JPG, PNG, WebP image or MP4/MOV video.`);
        continue;
      }
      if (file.size > MAX_EVIDENCE_MB * 1024 * 1024) {
        toast.warning("File too large", `${file.name} is bigger than ${MAX_EVIDENCE_MB}MB.`);
        continue;
      }
      next.push({ file, url: URL.createObjectURL(file) });
    }

    if (next.length > 0) {
      setEvidence((prev) => [...prev, ...next]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeEvidence = (url: string) => {
    setEvidence((prev) => {
      const removed = prev.find((item) => item.url === url);
      if (removed) URL.revokeObjectURL(removed.url);
      return prev.filter((item) => item.url !== url);
    });
  };

  const onSubmit = async (values: CreateDisputeFormData) => {
    if (!deliveryId) return;
    try {
      const res = await createDispute.mutateAsync({
        payload: {
          delivery_id: deliveryId,
          reason: values.reason,
          description: values.description,
        },
        evidence: evidence.map((item) => item.file),
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

        {/* Evidence (images / videos) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold text-[#495057]">
              Evidence (optional)
            </Label>
            <span className="text-[11px] text-[#ADB5BD]">
              {evidence.length}/{MAX_EVIDENCE_FILES} files
            </span>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-[14px] border-2 border-dashed border-[#CED4DA] bg-[#F8F9FA] px-4 py-5 text-center transition-colors hover:border-[#00A86B]"
          >
            <Upload className="h-5 w-5 text-[#6C757D]" />
            <span className="text-[12.5px] font-semibold text-[#0A1628]">
              Add photos or videos
            </span>
            <span className="text-[11px] text-[#6C757D]">
              JPG, PNG, WebP, MP4 or MOV · up to {MAX_EVIDENCE_MB}MB each
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EVIDENCE_TYPES.join(",")}
            multiple
            className="hidden"
            onChange={(e) => handleEvidenceFiles(e.target.files)}
          />
          {evidence.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {evidence.map((item) => (
                <div
                  key={item.url}
                  className="group relative aspect-square overflow-hidden rounded-[11px] border border-[#E9ECEF] bg-[#F8F9FA]"
                >
                  {item.file.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt={item.file.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <video
                      src={item.url}
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${item.file.name}`}
                    onClick={() => removeEvidence(item.url)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
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
