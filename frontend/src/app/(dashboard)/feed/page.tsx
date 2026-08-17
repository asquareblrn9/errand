"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MapPin, Zap, PackageSearch, SlidersHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/SkeletonLoader";
import { useFeed, useCategories } from "@/hooks/queries/requests/use-requests";
import { useSetPageHeader } from "@/components/layout/PageHeaderContext";
import { Amount, Chip, timeAgo } from "@/components/design";
import type { RequestListItem, RequestQueryParams } from "@/types/api/requests";

const BUDGET_STEPS = [
  1000, 2000, 3000, 5000, 8000, 12000, 20000,
];

export default function FeedPage() {
  useSetPageHeader("Browse requests", "Find errands near you");
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [categoryId, setCategoryId] = useState("");
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [sort, setSort] = useState<"newest" | "budget_high" | "budget_low">("newest");

  const { data: categories = [] } = useCategories();
  const params = useMemo<RequestQueryParams | undefined>(() => {
    const p: RequestQueryParams = {};
    if (categoryId) p.category_id = categoryId;
    if (budgetMax != null) p.budget_max = budgetMax;
    if (sort !== "newest") p.sort = sort;
    return Object.keys(p).length > 0 ? p : undefined;
  }, [categoryId, budgetMax, sort]);

  const { data: requests = [], isLoading } = useFeed(params);

  // Client-side search filter (from the topbar search field)
  const visible = useMemo(() => {
    if (!query.trim()) return requests;
    const q = query.trim().toLowerCase();
    return requests.filter(
      (r: RequestListItem) =>
        r.title.toLowerCase().includes(q) ||
        r.location?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q),
    );
  }, [requests, query]);

  return (
    <div className="grid items-start gap-[22px] lg:grid-cols-[240px_1fr]">
      {/* Filters */}
      <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-[15px] font-bold text-[#0A1628]">Filters</h2>
          <SlidersHorizontal className="h-4 w-4 text-[#6C757D]" />
        </div>

        <span className="mb-2 block text-xs font-bold text-[#495057]">Category</span>
        <div className="mb-4 flex flex-col gap-2 text-[13px]">
          {categories.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={categoryId === c.id}
                onChange={() => setCategoryId(categoryId === c.id ? "" : c.id)}
                className="h-4 w-4 rounded border-[#CED4DA] accent-[#00A86B]"
              />
              {c.name}
            </label>
          ))}
        </div>

        <span className="mb-2 block text-xs font-bold text-[#495057]">Budget</span>
        <select
          value={budgetMax ?? ""}
          onChange={(e) => setBudgetMax(e.target.value ? parseInt(e.target.value, 10) : null)}
          className="mb-4 h-10 w-full rounded-[11px] border border-[#CED4DA] bg-[#F8F9FA] px-3 text-[13px] text-[#0A1628] outline-none focus:border-[#00A86B]"
        >
          <option value="">Any budget</option>
          {BUDGET_STEPS.map((b) => (
            <option key={b} value={b}>
              Up to ₦{b.toLocaleString()}
            </option>
          ))}
        </select>

        {(categoryId || budgetMax != null || query) && (
          <button
            type="button"
            onClick={() => {
              setCategoryId("");
              setBudgetMax(null);
            }}
            className="text-[12.5px] font-bold text-[#00A86B] hover:text-[#008554]"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-[15px] font-bold text-[#0A1628]">
            {visible.length} request{visible.length !== 1 ? "s" : ""}
            {query ? ` matching “${query}”` : " near you"}
          </h2>
          <div className="flex gap-2">
            <Chip on={sort === "newest"} onClick={() => setSort("newest")}>
              Newest
            </Chip>
            <Chip on={sort === "budget_high"} onClick={() => setSort("budget_high")}>
              Highest pay
            </Chip>
            <Chip on={sort === "budget_low"} onClick={() => setSort("budget_low")}>
              Lowest pay
            </Chip>
          </div>
        </div>

        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : visible.length === 0 ? (
          <Card className="rounded-[20px] border-[#E9ECEF]">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <PackageSearch className="mb-4 h-12 w-12 text-[#ADB5BD]" />
              <h3 className="mb-1 text-lg font-semibold text-[#0A1628]">No open requests</h3>
              <p className="max-w-sm text-sm text-[#6C757D]">
                {query || categoryId || budgetMax != null
                  ? "Nothing matches your filters. Try widening them."
                  : "There are no open errand requests at the moment. Check back later or post your own request."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-[18px] md:grid-cols-2 2xl:grid-cols-3">
            {visible.map((r: RequestListItem) => (
              <div
                key={r.id}
                className="flex flex-col rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)] transition-shadow hover:shadow-md"
              >
                <div className="mb-2 flex items-center gap-2">
                  {r.is_urgent && (
                    <Badge className="rounded-full bg-[#FFE3E9] px-2 py-0.5 text-[10px] font-bold text-[#FF1744]">
                      <Zap className="mr-0.5 h-2.5 w-2.5" /> Urgent
                    </Badge>
                  )}
                  {r.category && (
                    <span className="text-[11px] font-semibold text-[#6C757D]">
                      {r.category.name}
                    </span>
                  )}
                </div>
                <div className="mb-2 font-heading text-[13.5px] font-bold leading-snug text-[#0A1628]">
                  {r.title}
                </div>
                <div className="mb-3 text-[11.5px] text-[#6C757D]">
                  {r.distance_km != null && `${r.distance_km}km · `}
                  {timeAgo(r.created_at)} · requester{" "}
                  {r.requester?.rating != null ? `${r.requester.rating.toFixed(1)}★` : "new"}
                </div>
                <div className="mb-3 line-clamp-1 text-[12px] text-[#6C757D]">
                  <MapPin className="mr-1 inline h-3 w-3" />
                  {r.location}
                </div>
                <div className="mt-auto flex items-center justify-between">
                  {r.budget_hint != null ? (
                    <Amount value={r.budget_hint} className="text-[15px] text-[#FF6B00]" />
                  ) : (
                    <span className="rounded-full bg-[#E9ECEF] px-2.5 py-1 text-[11px] font-bold text-[#495057]">
                      Open to bids
                    </span>
                  )}
                  <Link href={`/requests/${r.id}`}>
                    <Button
                      className="h-8 rounded-[9px] bg-[#00A86B] px-3 font-heading text-xs font-bold text-white hover:bg-[#008554]"
                    >
                      Bid
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
