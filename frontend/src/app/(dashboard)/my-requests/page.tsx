"use client";

import Link from "next/link";
import { ClipboardList, PlusCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/SkeletonLoader";
import { useMyRequests } from "@/hooks/queries/requests/use-requests";
import type { MyRequestListItem } from "@/types/api/requests";

export default function MyRequestsPage() {
  const { data: requests = [], isLoading } = useMyRequests();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-foreground">My Requests</h1>
          <p className="text-base text-muted-foreground mt-1">
            Track and manage your errand requests
          </p>
        </div>
        <Link href="/requests/new">
          <Button size="sm">
            <PlusCircle className="w-4 h-4 mr-1.5" /> New Request
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No requests yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              You haven&apos;t posted any errand requests yet. Get started by creating your first one.
            </p>
            <Link href="/requests/new">
              <Button>Post your first request</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r: MyRequestListItem) => (
            <Link key={r.id} href={`/requests/${r.id}`}>
              <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                <CardContent className="pt-5 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{r.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {r.category?.name} • {r.location}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <Badge variant="secondary">{r.status}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(r.created_at).toLocaleDateString()}
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
