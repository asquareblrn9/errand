"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Send, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";
import Link from "next/link";

const requestSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000),
  category_id: z.string().uuid("Select a category"),
  location: z.string().min(3, "Location is required").max(255),
  budget_hint: z.string().optional(),
  is_urgent: z.boolean().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

export default function NewRequestPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<RequestFormData>({
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
        latitude: 6.5244, longitude: 3.3792, // Default Lagos coords
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

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register("title")} placeholder="e.g. Buy groceries from Shoprite" />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register("description")} rows={4} placeholder="Describe what you need..." />
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

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" {...register("location")} placeholder="Ikeja, Lagos" />
              {errors.location && <p className="text-sm text-destructive">{errors.location.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget_hint">Budget Hint (₦, optional)</Label>
              <Input id="budget_hint" type="number" {...register("budget_hint")} placeholder="5000" />
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

            <Button type="submit" className="w-full" disabled={saving} size="lg">
              <Send className="w-4 h-4 mr-2" /> {saving ? "Posting..." : "Post Request"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
