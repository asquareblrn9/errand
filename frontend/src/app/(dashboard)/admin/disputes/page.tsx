"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { AdminDataTable } from "@/components/shared/AdminDataTable";
import { AdminBreadcrumb } from "@/components/shared/AdminBreadcrumb";
import api from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  dispute_opened: "destructive", under_review: "warning", admin_decision: "default",
  full_refund: "secondary", partial_refund: "secondary", funds_released: "success", completed: "success",
};

export default function AdminDisputesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "disputes", page, status],
    queryFn: async () => {
      const params = new URLSearchParams({ per_page: "20", page: String(page) });
      if (status) params.set("status", status);
      const res = await api.get(`/admin/disputes?${params}`);
      return (res.data as any).data as any[];
    },
  });

  const disputes = data ?? [];

  return (
    <div className="max-w-6xl space-y-4">
      <AdminBreadcrumb items={[{ label: "Jobs" }, { label: "Disputes" }]} />
      <AdminDataTable
        title="Disputes"
        description="All dispute cases across the platform"
        columns={[
          { key: "reason", label: "Reason", render: (v: string) => <span className="font-medium">{v?.slice(0, 40)}{v?.length > 40 ? "..." : ""}</span> },
          { key: "raiser", label: "Requester", render: (_: any, row: any) => row.raiser?.name ?? "—" },
          { key: "errander", label: "Errander", render: (_: any, row: any) => row.errander?.name ?? "—" },
          { key: "status", label: "Status", render: (v: string) => <Badge variant={STATUS_COLORS[v] as any || "outline"}>{v?.replace(/_/g, " ")}</Badge> },
          { key: "resolution_note", label: "Resolution", render: (v: string) => v ? <span className="text-xs">{v?.slice(0, 50)}...</span> : "—" },
          { key: "created_at", label: "Opened", render: (v: string) => new Date(v).toLocaleDateString() },
        ]}
        data={disputes} isLoading={isLoading} error={error as Error | null}
        searchValue="" onSearchChange={() => {}}
        emptyMessage="No disputes found"
      />
    </div>
  );
}
