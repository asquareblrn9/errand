"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import Link from "next/link";

const addressSchema = z.object({
  label: z.enum(["home", "work", "other"]),
  address_line_1: z.string().min(3, "Address is required").max(255),
  address_line_2: z.string().max(255).optional(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  is_default: z.boolean().optional(),
});

type AddressFormData = z.infer<typeof addressSchema>;

export default function NewAddressPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: { label: "home" },
  });

  const onSubmit = async (data: AddressFormData) => {
    setSaving(true);
    setError("");
    try {
      await api.post("/me/addresses", data);
      router.push("/addresses");
    } catch {
      setError("Failed to save address.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/addresses">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">New Address</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Address Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}

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
              <Input id="address_line_1" {...register("address_line_1")} placeholder="15 Marina Road" />
              {errors.address_line_1 && <p className="text-sm text-destructive">{errors.address_line_1.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_line_2">Address Line 2 (optional)</Label>
              <Input id="address_line_2" {...register("address_line_2")} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register("city")} placeholder="Lagos" />
                {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" {...register("state")} placeholder="Lagos" />
                {errors.state && <p className="text-sm text-destructive">{errors.state.message}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_default" {...register("is_default")} className="rounded" />
              <Label htmlFor="is_default" className="text-sm">Set as default address</Label>
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Address"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
