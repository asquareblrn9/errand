"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { AdminDataTable } from "@/components/shared/AdminDataTable";
import { AdminBreadcrumb } from "@/components/shared/AdminBreadcrumb";
import api from "@/lib/api";

export default function AdminPaymentsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "payments", page, status],
    queryFn: async () => {
      const params = new URLSearchParams({ per_page: "25", page: String(page) });
      if (status) params.set("status", status);
      const res = await api.get(`/admin/payments?${params}`);
      return (res.data as any).data as any[];
    },
  });

  const payments = data ?? [];

  return (
    <div className="max-w-6xl space-y-4">
      <AdminBreadcrumb items={[{ label: "Financial" }, { label: "Payments" }]} />
      <AdminDataTable
        title="Payments"
        description="All bid payments made by requesters"
        columns={[
          { key: "provider_ref", label: "Ref", render: (v: string) => <span className="font-mono text-xs">{v?.slice(0, 12)}...</span> },
          { key: "user", label: "Payer", render: (_: any, row: any) => row.user?.name ?? "—" },
          { key: "amount", label: "Amount", render: (v: number) => `₦${v?.toLocaleString() ?? "0"}` },
          { key: "provider", label: "Provider", render: (v: string) => <Badge variant="outline" className="capitalize">{v}</Badge> },
          { key: "payment_method", label: "Method", render: (v: string) => <span className="capitalize">{v}</span> },
          { key: "status", label: "Status", render: (v: string) => <Badge variant={v === "successful" ? "success" : v === "failed" ? "destructive" : "warning"}>{v}</Badge> },
          { key: "paid_at", label: "Paid", render: (v: string) => v ? new Date(v).toLocaleDateString() : "—" },
        ]}
        data={payments} isLoading={isLoading} error={error as Error | null}
        searchValue="" onSearchChange={() => {}}
        searchPlaceholder="Search payments..."
        emptyMessage="No payments found"
        statusFilter={
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-10 rounded-xl border border-input bg-transparent px-3 py-2 text-sm">
            <option value="">All</option>
            <option value="successful">Successful</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        }
      />
    </div>
  );
}
