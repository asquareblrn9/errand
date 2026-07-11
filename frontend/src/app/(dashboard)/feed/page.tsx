"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Clock, Zap, PackageSearch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/shared/SkeletonLoader";
import { useFeed, useCategories } from "@/hooks/queries/requests/use-requests";
import type { RequestListItem } from "@/types/api/requests";

export default function FeedPage() {
  const [categoryId, setCategoryId] = useState("");
  const { data: categories = [] } = useCategories();
  const { data: requests = [], isLoading } = useFeed(
    categoryId ? { category_id: categoryId } : undefined,
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold text-foreground">Browse Requests</h1>
          <p className="text-base text-muted-foreground mt-1">
            Find open errand requests near you
          </p>
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-10 w-full sm:w-48 rounded-xl border border-input bg-background px-3 py-2 text-sm transition-all duration-200 outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <PackageSearch className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No open requests</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              There are no open errand requests at the moment. Check back later or post your own request.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r: RequestListItem) => (
            <Link key={r.id} href={`/requests/${r.id}`}>
              <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        {r.is_urgent && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <Zap className="w-3 h-3" /> Urgent
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {r.category?.name}
                        </span>
                      </div>
                      <h3 className="font-semibold truncate">{r.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {r.description}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{r.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                        {r.budget_hint && (
                          <span className="font-medium text-foreground">
                            ₦{r.budget_hint.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm flex-shrink-0">
                      <div className="text-xs text-muted-foreground mb-1">
                        {r.bids_count} bid{r.bids_count !== 1 ? "s" : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        by {r.requester?.name}
                      </div>
                    </div>
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
