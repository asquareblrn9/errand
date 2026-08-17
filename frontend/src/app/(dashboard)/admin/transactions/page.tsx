"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { AdminDataTable } from "@/components/shared/AdminDataTable";
import { AdminBreadcrumb } from "@/components/shared/AdminBreadcrumb";
import api from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  completed: "success", pending: "warning", failed: "destructive",
};

const TYPE_COLORS: Record<string, string> = {
  deposit: "success", payout: "default", withdrawal: "destructive",
  payment: "secondary", lock: "outline", unlock: "outline",
};

export default function AdminTransactionsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "transactions", search, page, status],
    queryFn: async () => {
      const params = new URLSearchParams({ per_page: "25", page: String(page) });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const res = await api.get(`/admin/transactions?${params}`);
      return (res.data as any).data as any[];
    },
  });

  const transactions = data ?? [];

  return (
    <div className="max-w-6xl space-y-4">
      <AdminBreadcrumb items={[{ label: "Financial" }, { label: "Transactions" }]} />
      <AdminDataTable
        title="Transactions"
        description="Wallet transactions across the platform"
        columns={[
          { key: "reference", label: "Reference", render: (v: string) => <span className="font-mono text-xs">{v?.slice(0, 16)}...</span> },
          { key: "type", label: "Type", render: (v: string) => <Badge variant={TYPE_COLORS[v] as any || "outline"}>{v}</Badge> },
          { key: "user", label: "User", render: (_: any, row: any) => row.user?.name ?? "—" },
          { key: "amount", label: "Amount", render: (v: number) => `₦${v?.toLocaleString() ?? "0"}` },
          { key: "platform_fee", label: "Fee", render: (v: number) => v > 0 ? `₦${v.toLocaleString()}` : "—" },
          { key: "net_amount", label: "Net", render: (v: number) => `₦${v?.toLocaleString() ?? "0"}` },
          { key: "status", label: "Status", render: (v: string) => <Badge variant={STATUS_COLORS[v] as any || "outline"}>{v}</Badge> },
          { key: "created_at", label: "Date", render: (v: string) => new Date(v).toLocaleDateString() },
        ]}
        data={transactions} isLoading={isLoading} error={error as Error | null}
        searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by ID, reference, or user name..."
        exportUrl={`/api/v1/admin/transactions?format=csv&search=${encodeURIComponent(search)}`}
        emptyMessage="No transactions found"
        statusFilter={
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-10 rounded-xl border border-input bg-transparent px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        }
      />
    </div>
  );
}
