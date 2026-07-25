"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Send, Zap, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/editor";
import { Badge } from "@/components/ui/badge";
import { LocationPicker } from "@/components/shared/LocationPicker";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
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

export default function NewRequestPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [locationData, setLocationData] = useState({ address: "", latitude: 0, longitude: 0 });

  const canPost = Boolean(
    user?.email_verified &&
    (user?.kyc_tier ?? 0) >= 1 &&
    user?.status === "active",
  );

  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
  });

  useEffect(() => {
    api.get<ApiResponse<{ id: string; name: string }[]>>("/categories")
      .then(({ data }) => setCategories(data.data));
  }, []);

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
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create request.");
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/feed">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-[32px] font-bold text-foreground">New Request</h1>
          <p className="text-base text-muted-foreground mt-1">
            Post a new errand request for runners to bid on
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Request Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                {error}
              </div>
            )}

            {!canPost && (
              <div className="p-4 rounded-xl bg-[#F97316]/10 border border-[#F97316]/20 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#F97316]" />
                  <p className="text-sm font-semibold text-[#F97316]">Verification Required</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Complete all steps below to start posting errand requests.
                </p>
                <div className="space-y-2">
                  {/* Email */}
                  <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background/50">
                    <div className="flex items-center gap-2 text-sm">
                      {user?.email_verified ? (
                        <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-[#F97316]" />
                      )}
                      <span className={user?.email_verified ? "text-foreground" : ""}>Verified email</span>
                    </div>
                    {!user?.email_verified && (
                      <Link href="/settings?tab=security">
                        <Button variant="outline" size="sm">Verify</Button>
                      </Link>
                    )}
                  </div>
                  {/* KYC */}
                  <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background/50">
                    <div className="flex items-center gap-2 text-sm">
                      {(user?.kyc_tier ?? 0) >= 1 ? (
                        <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-[#F97316]" />
                      )}
                      <span>Completed KYC verification</span>
                    </div>
                    {(user?.kyc_tier ?? 0) < 1 && (
                      <Link href="/verification">
                        <Button variant="outline" size="sm">Complete KYC</Button>
                      </Link>
                    )}
                  </div>
                  {/* Account status — only shown when not active */}
                  {user?.status !== "active" && (
                    <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-background/50 text-sm">
                      <XCircle className="w-4 h-4 text-[#EF4444]" />
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
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register("title")} placeholder="e.g. Buy groceries from Shoprite" />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
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
              {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category_id">Category</Label>
              <select
                id="category_id"
                {...register("category_id")}
                className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm transition-all duration-200 outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
              >
                <option value="">Select a category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.category_id && <p className="text-sm text-destructive">{errors.category_id.message}</p>}
            </div>

            <LocationPicker
              value={locationData.address}
              onChange={(data) => {
                setLocationData(data);
                setValue("location", data.address, { shouldValidate: true });
              }}
              error={errors.location?.message}
            />
            <input type="hidden" {...register("location")} value={locationData.address} />

            <div className="space-y-2">
              <Label htmlFor="budget_hint">Budget Hint (₦, optional)</Label>
              <Input id="budget_hint" type="number" {...register("budget_hint")} placeholder="5000" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sla_minutes">Delivery Timeframe (optional)</Label>
              <select
                id="sla_minutes"
                {...register("sla_minutes")}
                className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm transition-all duration-200 outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
              >
                <option value="">Use default (2 hours)</option>
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

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_urgent"
                {...register("is_urgent")}
                className="h-4 w-4 rounded border-input text-primary transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none"
              />
              <Label htmlFor="is_urgent" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                <Zap className="w-3.5 h-3.5 text-[#F97316]" /> Urgent (+₦1,500 fee)
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={saving || !canPost} size="lg">
              <Send className="w-4 h-4 mr-2" /> {saving ? "Posting..." : "Post Request"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
