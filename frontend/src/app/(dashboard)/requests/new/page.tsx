"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send, Zap, AlertTriangle, CheckCircle2, XCircle, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/editor";
import { Badge } from "@/components/ui/badge";
import { LocationPicker } from "@/components/shared/LocationPicker";
import { useSetPageHeader } from "@/components/layout/PageHeaderContext";
import { Amount, Chip, Timeline } from "@/components/design";
import { useAuthStore } from "@/store/authStore";
import { useCategories } from "@/hooks/queries/requests/use-requests";
import { useUserRatings } from "@/hooks/queries/users/use-users";
import api from "@/lib/api";
import { getApiErrorMessage } from "@/lib/error-handler";
import type { ApiResponse } from "@/types/api";
import Link from "next/link";

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim();

const requestSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z
    .string()
    .refine((val) => stripHtml(val).length >= 10, "Description must be at least 10 characters")
    .refine((val) => stripHtml(val).length <= 2000, "Description is too long"),
  category_id: z.string().uuid("Select a category"),
  location: z.string().min(3, "Location is required").max(255),
  budget_hint: z.string().optional(),
  sla_minutes: z.string().optional(),
  is_urgent: z.boolean().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

const TIPS = [
  {
    title: "Set a realistic budget range",
    detail: "Errands priced fairly get 3× more bids in the first 10 minutes.",
    state: "done" as const,
  },
  {
    title: "Be specific in the details",
    detail: "Brands, quantities, and landmarks reduce back-and-forth chat.",
    state: "done" as const,
  },
  {
    title: "Add a photo if useful",
    detail: "A reference photo helps for document or specific-item pickups.",
    state: "pending" as const,
  },
];

export default function NewRequestPage() {
  useSetPageHeader("Post an errand", "Create a new errand request");
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: categories = [] } = useCategories();
  const { data: ratings } = useUserRatings(user?.id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [locationData, setLocationData] = useState({ address: "", latitude: 0, longitude: 0 });

  const canPost = Boolean(
    user?.email_verified &&
    (user?.kyc_tier ?? 0) >= 1 &&
    user?.status === "active",
  );

  const { register, handleSubmit, setValue, watch, control, formState: { errors } } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
  });

  const watched = watch();

  const onSubmit = async (data: RequestFormData) => {
    setSaving(true); setError("");
    try {
      const payload = {
        ...data,
        budget_hint: data.budget_hint ? parseFloat(data.budget_hint) : null,
        sla_minutes: data.sla_minutes ? parseInt(data.sla_minutes, 10) : null,
        latitude: locationData.latitude || 6.5244,
        longitude: locationData.longitude || 3.3792,
      };
      const { data: res } = await api.post<ApiResponse<{ id: string }>>("/requests", payload);
      router.push(`/requests/${res.data.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create request."));
    } finally { setSaving(false); }
  };

  const avgRating = ratings?.meta?.average_rating as number | undefined;

  return (
    <div className="grid items-start gap-[18px] xl:grid-cols-[2fr_1fr]">
      {/* ── Form ─────────────────────────────────────────── */}
      <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-[11px] border border-[#FF1744]/20 bg-[#FF1744]/10 p-3 text-sm text-[#FF1744]">
              {error}
            </div>
          )}

          {!canPost && (
            <div className="space-y-3 rounded-[14px] border border-[#FF6B00]/20 bg-[#FFF1E6] p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-[#B24E00]" />
                <p className="text-sm font-semibold text-[#B24E00]">Verification Required</p>
              </div>
              <p className="text-sm text-[#6C757D]">
                Complete all steps below to start posting errand requests.
              </p>
              <div className="space-y-2">
                {/* Email */}
                <div className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    {user?.email_verified ? (
                      <CheckCircle2 className="h-4 w-4 text-[#00A86B]" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-[#B24E00]" />
                    )}
                    <span className={user?.email_verified ? "text-[#0A1628]" : ""}>Verified email</span>
                  </div>
                  {!user?.email_verified && (
                    <Link href="/settings?tab=security">
                      <Button variant="outline" size="sm" className="h-7 rounded-[9px] text-xs">Verify</Button>
                    </Link>
                  )}
                </div>
                {/* KYC */}
                <div className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    {(user?.kyc_tier ?? 0) >= 1 ? (
                      <CheckCircle2 className="h-4 w-4 text-[#00A86B]" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-[#B24E00]" />
                    )}
                    <span>Completed KYC verification</span>
                  </div>
                  {(user?.kyc_tier ?? 0) < 1 && (
                    <Link href="/verification">
                      <Button variant="outline" size="sm" className="h-7 rounded-[9px] text-xs">Complete KYC</Button>
                    </Link>
                  )}
                </div>
                {/* Account status — only shown when not active */}
                {user?.status !== "active" && (
                  <div className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-1.5 text-sm">
                    <XCircle className="h-4 w-4 text-[#FF1744]" />
                    <span>
                      {user?.status === "banned"
                        ? "Account banned — contact support"
                        : "Account suspended — contact support"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title" className="text-xs font-bold text-[#495057]">What do you need done?</Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="e.g. Pick up groceries from Shoprite"
              className="h-11 rounded-[11px] border-[#CED4DA] bg-[#F8F9FA]"
            />
            {errors.title && <p className="text-sm text-[#FF1744]">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-[#495057]">Category</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  on={watched.category_id === c.id}
                  onClick={() => setValue("category_id", c.id, { shouldValidate: true })}
                >
                  {c.name}
                </Chip>
              ))}
            </div>
            {errors.category_id && <p className="text-sm text-[#FF1744]">{errors.category_id.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs font-bold text-[#495057]">Details for the errander</Label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <RichTextEditor
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Describe what you need..."
                  disabled={!canPost}
                  hasError={!!errors.description}
                />
              )}
            />
            {errors.description && <p className="text-sm text-[#FF1744]">{errors.description.message}</p>}
          </div>

          <div className="grid gap-3.5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="budget_hint" className="text-xs font-bold text-[#495057]">Budget (₦)</Label>
              <Input
                id="budget_hint"
                type="number"
                {...register("budget_hint")}
                placeholder="5000"
                className="h-11 rounded-[11px] border-[#CED4DA] bg-[#F8F9FA]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sla_minutes" className="text-xs font-bold text-[#495057]">Needed by</Label>
              <select
                id="sla_minutes"
                {...register("sla_minutes")}
                className="h-11 w-full rounded-[11px] border border-[#CED4DA] bg-[#F8F9FA] px-3 text-sm text-[#0A1628] outline-none focus:border-[#00A86B]"
              >
                <option value="">Today (2 hours)</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="180">3 hours</option>
                <option value="360">6 hours</option>
                <option value="720">12 hours</option>
                <option value="1440">1 day</option>
                <option value="2880">2 days</option>
                <option value="4320">3 days</option>
                <option value="10080">7 days</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-[#495057]">Urgency</Label>
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-[11px] border border-[#CED4DA] bg-[#F8F9FA] px-3 text-sm">
                <input
                  type="checkbox"
                  {...register("is_urgent")}
                  className="h-4 w-4 rounded border-[#CED4DA] accent-[#00A86B]"
                />
                <Zap className="h-3.5 w-3.5 text-[#FF6B00]" />
                <span className="text-xs font-medium">Urgent (+₦1,500 fee)</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-[#495057]">Pickup &amp; drop-off</Label>
            <div className="rounded-[14px] border border-[#E9ECEF] p-3.5">
              <div className="mb-3 flex items-center gap-2.5 border-b border-[#E9ECEF] pb-3">
                <MapPin className="h-4 w-4 shrink-0 text-[#00A86B]" />
                <span className="text-[13px] text-[#6C757D]">
                  {user?.residential_address
                    ? `Pickup from ${user.residential_address} (your address)`
                    : "Pickup from your saved address"}
                </span>
              </div>
              <LocationPicker
                value={locationData.address}
                onChange={(data) => {
                  setLocationData(data);
                  setValue("location", data.address, { shouldValidate: true });
                }}
                error={errors.location?.message}
                label="Drop-off location"
              />
            </div>
            <input type="hidden" {...register("location")} value={locationData.address} />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={saving || !canPost}
            className="h-12 w-full justify-center rounded-[11px] bg-[#00A86B] font-heading text-[13px] font-bold text-white hover:bg-[#008554]"
          >
            <Send className="mr-2 h-4 w-4" />
            {saving ? "Posting..." : "Post errand & notify nearby erranders"}
          </Button>
        </form>
      </div>

      {/* ── Right rail: live preview + tips ──────────────── */}
      <div className="space-y-[18px]">
        <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-[15px] font-bold text-[#0A1628]">Live preview</h2>
            <Badge className="rounded-full bg-[#E9ECEF] px-2.5 py-1 text-[11px] font-bold text-[#495057]">
              How erranders see it
            </Badge>
          </div>
          <div className="rounded-[14px] border border-[#E9ECEF] p-3.5">
            <div className="mb-1.5 flex items-start justify-between gap-3">
              <strong className="font-heading text-[13.5px] text-[#0A1628]">
                {watched.title?.trim() || "Your errand title"}
              </strong>
              {watched.budget_hint ? (
                <Amount value={parseFloat(watched.budget_hint)} className="shrink-0 text-[13px] text-[#FF6B00]" />
              ) : (
                <span className="shrink-0 text-[13px] text-[#FF6B00]">₦ budget</span>
              )}
            </div>
            <div className="mb-2.5 text-[11.5px] text-[#6C757D]">
              {locationData.address || watched.location || "Your drop-off location"} · posted just now
            </div>
            {avgRating != null && avgRating > 0 ? (
              <div className="text-xs">
                <span className="tracking-[1px] text-[#FF6B00]">★★★★★</span>{" "}
                <span className="font-semibold text-[#495057]">{avgRating.toFixed(1)} requester rating</span>
              </div>
            ) : (
              <div className="text-xs text-[#6C757D]">New requester</div>
            )}
          </div>
        </div>

        <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
          <h2 className="mb-4 font-heading text-[15px] font-bold text-[#0A1628]">
            Tips for faster bids
          </h2>
          <Timeline items={TIPS} />
        </div>
      </div>
    </div>
  );
}
