"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { MapPin, Clock, User, ArrowLeft, CheckCircle, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSkeleton } from "@/components/shared/SkeletonLoader";
import { useAuthStore } from "@/store/authStore";
import { useRequest } from "@/hooks/queries/requests/use-requests";
import { useCreateBidMutation, useAcceptBidMutation } from "@/hooks/queries/bids/use-bids";
import { toast } from "@/store/toastStore";
import { handleApiError } from "@/lib/error-handler";
import type { RequestData, BidSummary } from "@/types/api/requests";
import Link from "next/link";

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { data: request, isLoading } = useRequest(id);
  const createBid = useCreateBidMutation(id);
  const acceptBid = useAcceptBidMutation();

  const [bidForm, setBidForm] = useState({
    goods_amount: "",
    service_fee: "",
    note: "",
  });

  const handleBid = async () => {
    try {
      await createBid.mutateAsync({
        goods_amount: parseFloat(bidForm.goods_amount),
        service_fee: parseFloat(bidForm.service_fee),
        note: bidForm.note || undefined,
      });
      toast.success("Bid submitted", "Your bid has been placed.");
      setBidForm({ goods_amount: "", service_fee: "", note: "" });
    } catch (err) {
      handleApiError(err, "Failed to submit bid.");
    }
  };

  const handleAcceptBid = async (bidId: string) => {
    try {
      await acceptBid.mutateAsync(bidId);
      toast.success("Bid accepted", "You can now chat with the errander.");
    } catch (err) {
      handleApiError(err, "Failed to accept bid.");
    }
  };

  if (isLoading) return <FormSkeleton fields={3} />;
  if (!request) return <p className="text-muted-foreground">Request not found.</p>;

  const isOwner = user?.id === request.requester?.id;
  const isErrander = user?.role === "errander";

  return (
    <div className="max-w-2xl space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Link href="/feed">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-[32px] font-bold text-foreground truncate">{request.title}</h1>
        </div>
        <Badge variant="secondary">{request.status}</Badge>
        {request.is_urgent && <Badge variant="destructive">Urgent</Badge>}
      </div>

      {/* Request Info */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <p className="text-base">{request.description}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />{request.location}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />{request.requester?.name}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {new Date(request.created_at).toLocaleDateString()}
            </span>
          </div>
          {request.budget_hint && (
            <p className="text-sm font-medium">
              Budget: ₦{request.budget_hint.toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bids Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Bids ({request.bids?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {request.bids?.map((bid: BidSummary) => (
            <div
              key={bid.id}
              className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-muted/30 transition-colors"
            >
              <div>
                <p className="font-semibold">{bid.errander?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {bid.errander?.completed_orders} orders completed
                </p>
                <p className="text-sm mt-1">
                  Goods: ₦{bid.goods_amount.toLocaleString()} + Service: ₦
                  {bid.service_fee.toLocaleString()}
                </p>
                <p className="text-sm font-semibold">
                  Total: ₦{bid.total_amount.toLocaleString()}
                </p>
                {bid.note && (
                  <p className="text-xs text-muted-foreground mt-1">{bid.note}</p>
                )}
              </div>
              <div className="text-right">
                <Badge
                  variant={bid.status === "accepted" ? "success" : "secondary"}
                >
                  {bid.status}
                </Badge>
                {isOwner && bid.status === "pending" && (
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => handleAcceptBid(bid.id)}
                    disabled={acceptBid.isPending}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" /> Accept
                  </Button>
                )}
                {isOwner && bid.status === "accepted" && request.status === "assigned" && (
                  <Link href={`/requests/${request.id}/pay?bid_id=${bid.id}`}>
                    <Button size="sm" className="mt-2" variant="success">
                      <CheckCircle className="w-3 h-3 mr-1" /> Pay Now
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
          {(!request.bids || request.bids.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No bids yet. Be the first to bid!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bid Form (erranders only) */}
      {isErrander && request.status === "open" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Submit a Bid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Goods Amount (₦)</Label>
                <Input
                  type="number"
                  value={bidForm.goods_amount}
                  onChange={(e) =>
                    setBidForm({ ...bidForm, goods_amount: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Service Fee (₦)</Label>
                <Input
                  type="number"
                  value={bidForm.service_fee}
                  onChange={(e) =>
                    setBidForm({ ...bidForm, service_fee: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input
                value={bidForm.note}
                onChange={(e) =>
                  setBidForm({ ...bidForm, note: e.target.value })
                }
                placeholder="Add a note to your bid..."
              />
            </div>
            <Button
              onClick={handleBid}
              disabled={createBid.isPending}
              className="w-full"
            >
              <Send className="w-4 h-4 mr-2" />{" "}
              {createBid.isPending ? "Submitting..." : "Submit Bid"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
