"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bell, Send, Mail, Smartphone, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AdminBreadcrumb } from "@/components/shared/AdminBreadcrumb";
import api from "@/lib/api";
import { toast } from "@/store/toastStore";

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<"push" | "email" | "both">("both");
  const [target, setTarget] = useState<"all" | "requesters" | "erranders" | "individual">("all");
  const [userId, setUserId] = useState("");

  const sendMutation = useMutation({
    mutationFn: async () => {
      await api.post("/admin/notifications/send", { title, message, channel, target, user_id: target === "individual" ? userId : undefined });
    },
    onSuccess: (_, __, ___) => {
      const res = sendMutation.data as any;
      toast.success("Sent", `Notification sent to ${res?.data?.sent ?? "?"} users.`);
      setTitle(""); setMessage(""); setUserId("");
    },
    onError: (err: any) => toast.error("Error", err?.response?.data?.message || "Failed to send"),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <AdminBreadcrumb items={[{ label: "System" }, { label: "Notifications" }]} />
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Broadcast Notifications</h1>
        <p className="text-base text-muted-foreground mt-1">Send push or email announcements to platform users</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Compose Message</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Channel</Label>
            <div className="flex gap-2">
              {(["push", "email", "both"] as const).map((c) => (
                <button key={c} type="button" onClick={() => setChannel(c)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${channel === c ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}>
                  {c === "push" && <Smartphone className="w-3.5 h-3.5 inline mr-1" />}
                  {c === "email" && <Mail className="w-3.5 h-3.5 inline mr-1" />}
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Target Audience</Label>
            <div className="flex gap-2 flex-wrap">
              {(["all", "requesters", "erranders", "individual"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTarget(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${target === t ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {target === "individual" && (
            <div className="space-y-2">
              <Label>User ID</Label>
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Enter user UUID..." />
            </div>
          )}

          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title..." maxLength={200} />
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Notification body..." maxLength={1000} />
          </div>

          <Button className="w-full" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending || !title || !message}>
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {sendMutation.isPending ? "Sending..." : "Send Broadcast"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
