"use client";

import Link from "next/link";
import { Gavel, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/SkeletonLoader";
import { useMyBids } from "@/hooks/queries/bids/use-bids";
import type { MyBidListItem } from "@/types/api/bids";

export default function MyBidsPage() {
  const { data: bids = [], isLoading } = useMyBids();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-foreground">My Bids</h1>
          <p className="text-base text-muted-foreground mt-1">
            Track the status of your bids on errand requests
          </p>
        </div>
        <Link href="/feed">
          <Button size="sm">
            <Search className="w-4 h-4 mr-1.5" /> Find Requests
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : bids.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Gavel className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No bids submitted</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              You haven&apos;t placed any bids yet. Browse open requests and start bidding.
            </p>
            <Link href="/feed">
              <Button>Browse open requests</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bids.map((b: MyBidListItem) => (
            <Link key={b.id} href={`/requests/${b.request_id}`}>
              <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                <CardContent className="pt-5 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{b.request_title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Goods: ₦{b.goods_amount.toLocaleString()} + Service: ₦
                      {b.service_fee.toLocaleString()}
                    </p>
                    <p className="text-sm font-semibold">
                      Total: ₦{b.total_amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <Badge
                      variant={
                        b.status === "accepted"
                          ? "success"
                          : b.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {b.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(b.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
