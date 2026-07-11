"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, User, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useKycStatus, useUpdateKycProfile } from "@/hooks/queries/kyc/use-kyc";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";
import Link from "next/link";
import type { Gender } from "@/types/api/kyc";

const profileSchema = z.object({
  first_name: z.string().min(1, "Required"),
  last_name: z.string().min(1, "Required"),
  middle_name: z.string().optional(),
  date_of_birth: z.string().min(1, "Required"),
  gender: z.enum(["male", "female", "other"]),
  residential_address: z.string().min(5, "Enter full address"),
  state: z.string().min(1, "Required"),
  lga: z.string().min(1, "Required"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

export default function KycProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const { data: kyc } = useKycStatus();
  const updateProfile = useUpdateKycProfile();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Pre-fill form with existing user data from the database
  const defaultValues = useMemo(() => ({
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    middle_name: user?.middle_name ?? "",
    date_of_birth: user?.date_of_birth ?? "",
    gender: (user?.gender as Gender) ?? ("" as Gender),
    residential_address: user?.residential_address ?? "",
    state: user?.state ?? "",
    lga: user?.lga ?? "",
  }), [user]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: defaultValues,
  });

  const onSubmit = async (data: ProfileFormData) => {
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile.mutateAsync(data);
      // Refresh the auth store user so the form data stays in sync
      await fetchUser();
      setSaved(true);
      toast.success("Profile updated", "Your personal information has been saved.");
    } catch {
      toast.error("Error", "Failed to save profile information.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/verification">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-[32px] font-bold text-foreground">Personal Information</h1>
          <p className="text-base text-muted-foreground mt-1">
            Provide your legal name, date of birth, and residential address for KYC verification.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {saved && (
              <div className="p-3 text-sm rounded-xl bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
                Profile information saved successfully.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input id="first_name" {...register("first_name")} placeholder="Oluwaseun" />
              {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input id="last_name" {...register("last_name")} placeholder="Adeyemi" />
              {errors.last_name && <p className="text-sm text-destructive">{errors.last_name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="middle_name">Middle Name (Optional)</Label>
              <Input id="middle_name" {...register("middle_name")} placeholder="Oluwafemi" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth *</Label>
              <Input id="date_of_birth" type="date" {...register("date_of_birth")} />
              {errors.date_of_birth && <p className="text-sm text-destructive">{errors.date_of_birth.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <select
                id="gender"
                {...register("gender")}
                className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm transition-all duration-200 outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
              >
                <option value="">Select gender</option>
                {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
              {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="residential_address">Residential Address *</Label>
              <Input
                id="residential_address"
                {...register("residential_address")}
                placeholder="15 Adeola Odeku Street, Victoria Island"
              />
              {errors.residential_address && (
                <p className="text-sm text-destructive">{errors.residential_address.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <select
                id="state"
                {...register("state")}
                className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm transition-all duration-200 outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
              >
                <option value="">Select state</option>
                {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.state && <p className="text-sm text-destructive">{errors.state.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lga">LGA *</Label>
              <Input id="lga" {...register("lga")} placeholder="Eti-Osa" />
              {errors.lga && <p className="text-sm text-destructive">{errors.lga.message}</p>}
            </div>

            <Button type="submit" disabled={saving} className="w-full" size="lg">
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
              ) : (
                <>Save & Continue <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
