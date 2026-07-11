"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Shield, Mail, Phone, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";
import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";
import type { UserData } from "@/types/user";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, "Enter a valid phone number"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: { name: user?.name ?? "", phone: user?.phone ?? "" },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setSaving(true);
    setSaved(false);
    try {
      const { data: res } = await api.put<ApiResponse<UserData>>("/me", data);
      setUser(res.data);
      setSaved(true);
      toast.success("Profile updated", "Your profile has been saved.");
    } catch {
      toast.error("Update failed", "Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Profile Settings</h1>
        <p className="text-base text-muted-foreground mt-1">
          Manage your personal information and account details
        </p>
      </div>

      {/* Avatar */}
      <Card>
        <CardContent className="pt-5">
          <AvatarUpload />
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Personal Information</CardTitle>
          <CardDescription>Update your name and phone number</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" {...register("phone")} />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>
            {saved && (
              <p className="text-sm text-[#10B981] font-medium">Profile updated successfully.</p>
            )}
            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Mail className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <Badge variant={user?.email_verified ? "success" : "warning"}>
                {user?.email_verified ? "Verified" : "Unverified"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Phone className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{user?.phone || "Not set"}</p>
              </div>
              <Badge variant={user?.phone_verified ? "success" : "warning"}>
                {user?.phone_verified ? "Verified" : "Unverified"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Shield className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">KYC Tier</p>
                <p className="font-medium">Tier {user?.kyc_tier ?? 0}</p>
              </div>
              <Badge variant={user && user.kyc_tier >= 1 ? "success" : "secondary"}>
                {user && user.kyc_tier >= 1 ? "Verified" : "Unverified"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Member Since</p>
                <p className="font-medium">{user?.member_since}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
