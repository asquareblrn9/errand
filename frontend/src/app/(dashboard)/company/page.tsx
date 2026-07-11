"use client";

import { useEffect, useState } from "react";
import { Building, Users, Plus, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";

interface Company {
  id: string; name: string; slug: string; industry: string | null;
  owner: { id: string; name: string } | null;
  members_count: number; status: string; created_at: string;
}

interface Member {
  id: string; user_id: string; name: string; email: string;
  role: string; department: string | null; spending_limit: number; status: string;
}

export default function CompanyPage() {
  const { user } = useAuthStore();
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", rc_number: "" });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const fetchCompany = () => {
    // For now, fetch the first company — in production, use user's company
    api.get<ApiResponse<Company[]>>("/companies")
      .then(({ data }) => {
        const companies = data.data as unknown as Company[];
        if (companies.length > 0) {
          setCompany(companies[0]);
          api.get<ApiResponse<Member[]>>(`/companies/${companies[0].id}/members`)
            .then(({ data: d2 }) => setMembers(d2.data as unknown as Member[]));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCompany(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data } = await api.post("/companies", form);
      // @ts-ignore
      setCompany({ id: data.data.id, ...form, members_count: 1, status: "active", owner: { id: user!.id, name: user!.name }, created_at: new Date().toISOString() } as Company);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create company");
    } finally { setCreating(false); }
  };

  const handleInvite = async () => {
    if (!company) return;
    await api.post(`/companies/${company.id}/invite`, { email: inviteEmail });
    setInviteOpen(false);
    setInviteEmail("");
    fetchCompany();
  };

  if (loading) return <Skeleton className="h-64 max-w-2xl" />;

  if (!company) {
    return (
      <div className="max-w-lg space-y-6">
        <h1 className="text-2xl font-bold">Business Account</h1>
        <Card>
          <CardHeader><CardTitle>Create Your Company</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Company Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Industry</Label><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></div>
            <div className="space-y-2"><Label>RC Number (optional)</Label><Input value={form.rc_number} onChange={(e) => setForm({ ...form, rc_number: e.target.value })} /></div>
            <Button onClick={handleCreate} disabled={creating || !form.name} className="w-full">
              <Building className="w-4 h-4 mr-2" /> Create Company
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <p className="text-sm text-muted-foreground">{company.industry}</p>
        </div>
        <Badge>{company.status}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Members</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{company.members_count}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Owner</CardTitle></CardHeader>
          <CardContent><div className="text-lg font-semibold">{company.owner?.name}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" /> Team Members</CardTitle>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger>
              <Button size="sm"><UserPlus className="w-3 h-3 mr-1" /> Invite</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2"><Label>Email Address</Label><Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@example.com" /></div>
                <Button onClick={handleInvite} className="w-full">Send Invitation</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-medium text-sm">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <Badge variant="outline" className="capitalize">{m.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
