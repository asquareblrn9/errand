"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Shield, Wallet, Calendar, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProfileSkeleton } from "@/components/shared/SkeletonLoader";
import { useAdminUser, useSuspendUserMutation, useActivateUserMutation, useBanUserMutation } from "@/hooks/queries/admin/use-admin";
import { toast } from "@/store/toastStore";
import { handleApiError } from "@/lib/error-handler";

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading } = useAdminUser(id);
  const suspendMutation = useSuspendUserMutation();
  const activateMutation = useActivateUserMutation();
  const banMutation = useBanUserMutation();

  const [confirmAction, setConfirmAction] = useState<"suspend" | "activate" | "ban" | null>(null);

  const handleAction = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction === "suspend") await suspendMutation.mutateAsync(id);
      else if (confirmAction === "activate") await activateMutation.mutateAsync(id);
      else await banMutation.mutateAsync({ id });
      toast.success(`User ${confirmAction}${confirmAction === "ban" ? "ned" : "d"}`);
      setConfirmAction(null);
    } catch (err) {
      handleApiError(err, `Failed to ${confirmAction} user.`);
    }
  };

  const isMutating = suspendMutation.isPending || activateMutation.isPending || banMutation.isPending;

  if (isLoading) return <ProfileSkeleton />;
  if (!user) return <p className="text-muted-foreground py-12 text-center">User not found.</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/users">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-[32px] font-bold text-foreground">{user.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={user.status === "active" ? "success" : user.status === "suspended" ? "warning" : "destructive"}>
              {user.status}
            </Badge>
            <Badge variant="outline" className="capitalize">{user.role}</Badge>
            <span className="text-sm text-muted-foreground">Tier {user.kyc_tier}</span>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <Badge variant={user.email_verified ? "success" : "warning"} className="text-xs ml-auto">
                {user.email_verified ? "Verified" : "Unverified"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{user.phone || "—"}</p>
              </div>
              <Badge variant={user.phone_verified ? "success" : "warning"} className="text-xs ml-auto">
                {user.phone_verified ? "Verified" : "Unverified"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">2FA</p>
                <p className="font-medium">{user.two_factor_enabled ? "Enabled" : "Disabled"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Joined</p>
                <p className="font-medium">{new Date(user.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wallet */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Wallet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="text-xl font-bold">₦{user.wallet?.balance.toLocaleString() ?? "0"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Locked</p>
              <p className="text-xl font-bold text-[#F97316]">₦{user.wallet?.locked.toLocaleString() ?? "0"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Orders</p>
              <p className="text-xl font-bold">{user.completed_orders}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Admin Actions</CardTitle>
          <CardDescription>These actions take effect immediately</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          {user.status === "active" && (
            <Button variant="outline" onClick={() => setConfirmAction("suspend")} disabled={isMutating}>
              Suspend User
            </Button>
          )}
          {user.status === "suspended" && (
            <Button variant="outline" onClick={() => setConfirmAction("activate")} disabled={isMutating}>
              Activate User
            </Button>
          )}
          {user.status !== "banned" && (
            <Button variant="destructive" onClick={() => setConfirmAction("ban")} disabled={isMutating}>
              Ban User
            </Button>
          )}
          <Link href={`/admin/kyc/${user.id}`}>
            <Button variant="outline">
              <Shield className="w-4 h-4 mr-2" /> View KYC
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#F97316]" />
              Confirm {confirmAction}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to <strong>{confirmAction}</strong>{" "}
            <strong>{user.name}</strong>?
            {confirmAction === "ban" && " This will revoke all active sessions and prevent future login."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction === "ban" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={isMutating}
            >
              Confirm {confirmAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
