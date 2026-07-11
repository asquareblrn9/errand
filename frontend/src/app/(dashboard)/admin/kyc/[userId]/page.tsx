"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Camera,
  Shield,
  Users,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useAdminKycDetail,
  useAdminKycApprove,
  useAdminKycReject,
  useAdminKycResubmission,
} from "@/hooks/queries/kyc/use-kyc";
import { ProfileSkeleton } from "@/components/shared/SkeletonLoader";
import { toast } from "@/store/toastStore";
import type { RejectionCategory } from "@/types/api/kyc";

const REJECTION_CATEGORIES: { value: RejectionCategory; label: string }[] = [
  { value: "blurry_document", label: "Blurry Document" },
  { value: "id_mismatch", label: "ID Mismatch" },
  { value: "invalid_info", label: "Invalid Information" },
  { value: "expired_document", label: "Expired Document" },
  { value: "other", label: "Other" },
];

export default function AdminKycDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { data, isLoading } = useAdminKycDetail(userId);
  const approveMutation = useAdminKycApprove();
  const rejectMutation = useAdminKycReject();
  const resubmissionMutation = useAdminKycResubmission();

  const [activeVerification, setActiveVerification] = useState<string | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | "resubmit" | null>(null);
  const [notes, setNotes] = useState("");
  const [rejectCategory, setRejectCategory] = useState<RejectionCategory>("blurry_document");
  const [rejectReason, setRejectReason] = useState("");

  if (isLoading) return <ProfileSkeleton />;
  if (!data) return <p className="text-muted-foreground">User not found.</p>;

  const { user, kyc_status } = data;

  const handleAction = async () => {
    if (!activeVerification || !action) return;

    try {
      if (action === "approve") {
        await approveMutation.mutateAsync({ verificationId: activeVerification, notes: notes || undefined });
        toast.success("Approved", "Verification has been approved.");
      } else if (action === "reject") {
        await rejectMutation.mutateAsync({
          verificationId: activeVerification,
          reason: rejectReason,
          category: rejectCategory,
          notes: notes || undefined,
        });
        toast.success("Rejected", "Verification has been rejected.");
      } else if (action === "resubmit") {
        await resubmissionMutation.mutateAsync({
          verificationId: activeVerification,
          reason: rejectReason,
          category: rejectCategory,
          notes: notes || undefined,
        });
        toast.success("Resubmission requested", "User has been asked to resubmit.");
      }
      setAction(null);
      setActiveVerification(null);
      setNotes("");
      setRejectReason("");
    } catch {
      toast.error("Error", "Failed to perform action.");
    }
  };

  const openDialog = (verificationId: string, act: "approve" | "reject" | "resubmit") => {
    setActiveVerification(verificationId);
    setAction(act);
    setNotes("");
    setRejectReason("");
    setRejectCategory("blurry_document");
  };

  const isSubmitting = approveMutation.isPending || rejectMutation.isPending || resubmissionMutation.isPending;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/kyc">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-[32px] font-bold text-foreground">{user.name}</h1>
          <p className="text-base text-muted-foreground mt-1">KYC Review</p>
        </div>
      </div>

      {/* User Profile Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">User Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium">{user.first_name} {user.last_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{user.email}</span>
              <Badge variant={user.email_verified ? "success" : "warning"} className="text-xs">
                {user.email_verified ? "Verified" : "Unverified"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Phone:</span>
              <span className="font-medium">{user.phone || "—"}</span>
              <Badge variant={user.phone_verified ? "success" : "warning"} className="text-xs">
                {user.phone_verified ? "Verified" : "Unverified"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Address:</span>
              <span className="font-medium truncate">{user.residential_address || "—"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Items */}
      {kyc_status.verifications.map((v) => (
        <Card key={v.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold capitalize">
                {v.type.replace("_", " ")} Verification
              </CardTitle>
              <Badge
                variant={
                  v.status === "approved" ? "success"
                  : v.status === "rejected" ? "destructive"
                  : v.status === "pending_review" || v.status === "under_review" || v.status === "requires_resubmission"
                    ? "warning"
                    : "secondary"
                }
              >
                {v.status.replace("_", " ")}
              </Badge>
            </div>
            {v.rejection_reason && (
              <CardDescription className="text-[#EF4444]">
                Rejected: {v.rejection_reason}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Documents */}
            {v.documents.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {v.documents.map((doc) => (
                  <div key={doc.id}>
                    {doc.front_image_url && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Front Image</p>
                        <img
                          src={doc.front_image_url}
                          alt="Document front"
                          className="w-full h-48 object-cover rounded-xl border border-border"
                        />
                      </div>
                    )}
                    {doc.back_image_url && (
                      <div className="space-y-1 mt-2">
                        <p className="text-xs text-muted-foreground">Back Image</p>
                        <img
                          src={doc.back_image_url}
                          alt="Document back"
                          className="w-full h-48 object-cover rounded-xl border border-border"
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {doc.document_type} — {doc.document_number}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Bank Account */}
            {v.bank_account && (
              <div className="bg-muted rounded-xl p-3 text-sm space-y-1">
                <p><strong>Bank:</strong> {v.bank_account.bank_name}</p>
                <p><strong>Account:</strong> {v.bank_account.account_number}</p>
                <p><strong>Name:</strong> {v.bank_account.account_name}</p>
              </div>
            )}

            {/* Emergency Contact */}
            {v.emergency_contact && (
              <div className="bg-muted rounded-xl p-3 text-sm space-y-1">
                <p><strong>Contact:</strong> {v.emergency_contact.full_name}</p>
                <p><strong>Phone:</strong> {v.emergency_contact.phone_number}</p>
                <p><strong>Relationship:</strong> {v.emergency_contact.relationship}</p>
              </div>
            )}

            {/* Review Actions */}
            {v.status === "pending_review" && (
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => openDialog(v.id, "approve")}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => openDialog(v.id, "reject")}
                >
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openDialog(v.id, "resubmit")}
                >
                  <RefreshCw className="w-4 h-4 mr-1" /> Request Resubmission
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Review Dialog */}
      <Dialog open={!!action} onOpenChange={() => setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" ? "Approve Verification"
              : action === "reject" ? "Reject Verification"
              : "Request Resubmission"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(action === "reject" || action === "resubmit") && (
              <>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select
                    value={rejectCategory}
                    onChange={(e) => setRejectCategory(e.target.value as RejectionCategory)}
                    className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm transition-all duration-200 outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
                  >
                    {REJECTION_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Reason *</Label>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Explain why this verification is being rejected..."
                    rows={3}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add internal review notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={isSubmitting || ((action === "reject" || action === "resubmit") && !rejectReason)}
              variant={action === "reject" ? "destructive" : action === "approve" ? "success" : "default"}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {action === "approve" ? "Approve"
              : action === "reject" ? "Reject"
              : "Request Resubmission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
