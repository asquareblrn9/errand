"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";
import Link from "next/link";

const addressSchema = z.object({
  label: z.enum(["home", "work", "other"]),
  address_line_1: z.string().min(3).max(255),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  is_default: z.boolean().optional(),
});

type AddressFormData = z.infer<typeof addressSchema>;

export default function EditAddressPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
  });

  useEffect(() => {
    api.get<ApiResponse<AddressFormData & { id: string }>>(`/me/addresses/${id}`)
      .then(({ data }) => reset(data.data))
      .finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: AddressFormData) => {
    setSaving(true);
    await api.put(`/me/addresses/${id}`, data);
    router.push("/addresses");
  };

  if (loading) return <Skeleton className="h-64 max-w-lg" />;

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/addresses"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <h1 className="text-2xl font-bold">Edit Address</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Address Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <select id="label" {...register("label")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="home">Home</option>
                <option value="work">Work</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_line_1">Address Line 1</Label>
              <Input id="address_line_1" {...register("address_line_1")} />
              {errors.address_line_1 && <p className="text-sm text-destructive">{errors.address_line_1.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register("city")} />
                {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" {...register("state")} />
                {errors.state && <p className="text-sm text-destructive">{errors.state.message}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_default" {...register("is_default")} className="rounded" />
              <Label htmlFor="is_default" className="text-sm">Set as default</Label>
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              <Save className="w-4 h-4 mr-2" /> Update Address
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
