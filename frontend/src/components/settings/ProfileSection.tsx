"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import type { ApiResponse, UserData } from "@/types/api";

export function ProfileSection() {
  const { user, setUser, token } = useAuthStore();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!user) return null;

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { data } = await api.put<ApiResponse<UserData>>("/me", { name, email, phone });
      setUser(data.data);
      setMessage({ type: "success", text: "Profile updated successfully." });
    } catch {
      setMessage({ type: "error", text: "Failed to update profile." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Update your personal information.
        </p>
      </div>

      {message && (
        <div
          className={`p-3 text-sm rounded-xl ${
            message.type === "success"
              ? "bg-primary/10 text-primary border border-primary/20"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-name">Full Name</Label>
          <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-email">Email</Label>
          <Input
            id="settings-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              // Show warning if email changed
              if (e.target.value !== user.email) {
                setMessage({ type: "error", text: "Changing your email will require re-verification." });
              } else {
                setMessage(null);
              }
            }}
          />
          <div className="flex items-center gap-2">
            {user.email_verified ? (
              <Badge variant="success" className="text-xs">Verified</Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">Not Verified</Badge>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-phone">Phone</Label>
          <Input
            id="settings-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <div className="flex items-center gap-2">
            {user.phone_verified ? (
              <Badge variant="success" className="text-xs">Verified</Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">Not Verified</Badge>
            )}
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
