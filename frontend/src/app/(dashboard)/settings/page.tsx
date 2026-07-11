"use client";

import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmailVerificationSection } from "@/components/settings/EmailVerificationSection";
import { PhoneVerificationSection } from "@/components/settings/PhoneVerificationSection";
import { TwoFactorSection } from "@/components/settings/TwoFactorSection";
import { SessionsSection } from "@/components/settings/SessionsSection";
import { ProfileSection } from "@/components/settings/ProfileSection";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "profile";

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Settings</h1>
        <p className="text-base text-muted-foreground mt-1">
          Manage your account, security, and active sessions.
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList variant="line" className="w-full border-b border-border pb-0">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSection />
        </TabsContent>

        <TabsContent value="security">
          <div className="space-y-6">
            <EmailVerificationSection />
            <PhoneVerificationSection />
            <TwoFactorSection />
          </div>
        </TabsContent>

        <TabsContent value="sessions">
          <SessionsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
