"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminBreadcrumb } from "@/components/shared/AdminBreadcrumb";
import { ListSkeleton } from "@/components/shared/SkeletonLoader";
import api from "@/lib/api";

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "audit-logs", page],
    queryFn: async () => {
      const res = await api.get(`/notifications?per_page=30&page=${page}`);
      return (res.data as any).data as any[];
    },
  });

  const logs = data ?? [];

  return (
    <div className="max-w-6xl space-y-6">
      <AdminBreadcrumb items={[{ label: "System" }, { label: "Audit Logs" }]} />
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Audit Logs</h1>
        <p className="text-base text-muted-foreground mt-1">All platform activity recorded for compliance</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <ListSkeleton rows={10} /> : error ? (
            <div className="py-8 text-center text-destructive">Error loading audit logs</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No audit logs found</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border"><th className="text-left py-2 px-4 text-xs uppercase text-muted-foreground">Action</th><th className="text-left py-2 px-4 text-xs uppercase text-muted-foreground">User</th><th className="text-left py-2 px-4 text-xs uppercase text-muted-foreground">IP</th><th className="text-left py-2 px-4 text-xs uppercase text-muted-foreground">Date</th></tr></thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-4"><Badge variant="outline" className="font-mono text-xs">{log.action}</Badge></td>
                    <td className="py-2 px-4">{log.user?.name ?? "System"}</td>
                    <td className="py-2 px-4 font-mono text-xs text-muted-foreground">{log.ip_address ?? "—"}</td>
                    <td className="py-2 px-4 text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex justify-center gap-2 p-4 border-t border-border">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
