"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, UserX, UserCheck, Ban, Users, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/shared/SkeletonLoader";
import { useAdminUsers, useSuspendUserMutation, useActivateUserMutation, useBanUserMutation } from "@/hooks/queries/admin/use-admin";
import { toast } from "@/store/toastStore";
import { handleApiError } from "@/lib/error-handler";
import type { AdminUserListItem } from "@/types/api/admin";

const statusVariant = (s: string) =>
  s === "active" ? "success" as const : s === "suspended" ? "warning" as const : "destructive" as const;

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<{
    userId: string;
    userName: string;
    action: "suspend" | "activate" | "ban";
  } | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const { data: users = [], isLoading } = useAdminUsers({
    search: debouncedSearch || undefined,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
    page,
    per_page: 20,
  });

  const suspendMutation = useSuspendUserMutation();
  const activateMutation = useActivateUserMutation();
  const banMutation = useBanUserMutation();

  const handleAction = async () => {
    if (!confirmAction) return;
    const { userId, action } = confirmAction;
    try {
      if (action === "suspend") await suspendMutation.mutateAsync(userId);
      else if (action === "activate") await activateMutation.mutateAsync(userId);
      else await banMutation.mutateAsync({ id: userId });
      toast.success(`User ${action}${action === "ban" ? "ned" : "d"}`);
      setConfirmAction(null);
    } catch (err) {
      handleApiError(err, `Failed to ${action} user.`);
    }
  };

  const isMutating = suspendMutation.isPending || activateMutation.isPending || banMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Users</h1>
        <p className="text-base text-muted-foreground mt-1">
          Manage all platform users
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="h-10 rounded-xl border border-input bg-transparent px-3 py-2 text-sm"
        >
          <option value="">All Roles</option>
          <option value="requester">Requester</option>
          <option value="errander">Errander</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-10 rounded-xl border border-input bg-transparent px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {/* Users List */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No users found</h3>
            <p className="text-sm text-muted-foreground">
              {debouncedSearch || roleFilter || statusFilter
                ? "No users match your filters. Try adjusting your search."
                : "No users registered yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {users.map((u: AdminUserListItem) => (
                <div key={u.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/admin/users/${u.id}`} className="font-semibold hover:underline truncate">
                        {u.name}
                      </Link>
                      <Badge variant="outline" className="capitalize text-xs">{u.role}</Badge>
                      <Badge variant={statusVariant(u.status)} className="text-xs">{u.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {u.email} • Tier {u.kyc_tier} • {u.completed_orders} orders
                    </p>
                  </div>
                  <div className="flex gap-1 ml-4 shrink-0">
                    {u.status === "active" && (
                      <Button variant="ghost" size="icon-sm" title="Suspend"
                        onClick={() => setConfirmAction({ userId: u.id, userName: u.name, action: "suspend" })}
                        disabled={isMutating}>
                        <UserX className="w-4 h-4" />
                      </Button>
                    )}
                    {u.status === "suspended" && (
                      <Button variant="ghost" size="icon-sm" title="Activate"
                        onClick={() => setConfirmAction({ userId: u.id, userName: u.name, action: "activate" })}
                        disabled={isMutating}>
                        <UserCheck className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-sm" title="Ban"
                      onClick={() => setConfirmAction({ userId: u.id, userName: u.name, action: "ban" })}
                      disabled={u.status === "banned" || isMutating}>
                      <Ban className={`w-4 h-4 ${u.status === "banned" ? "text-muted-foreground" : "text-[#EF4444]"}`} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#F97316]" />
              Confirm {confirmAction?.action}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to <strong>{confirmAction?.action}</strong>{" "}
            <strong>{confirmAction?.userName}</strong>?
            {confirmAction?.action === "ban" && " This will revoke all their active sessions."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction?.action === "ban" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={isMutating}
            >
              {confirmAction?.action === "suspend" ? "Suspend"
              : confirmAction?.action === "activate" ? "Activate"
              : "Ban"} User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
