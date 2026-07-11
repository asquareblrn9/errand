"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";
import Link from "next/link";

interface DisputeDetail {
  id: string; reason: string; description: string;
  status: string; errander_response: string | null;
  resolution_note: string | null; resolved_at: string | null;
  raised_by: { id: string; name: string } | null;
  errander: { id: string; name: string } | null;
  opened_at: string;
}

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchDispute = () => {
    api.get<ApiResponse<DisputeDetail>>(`/disputes/${id}`)
      .then(({ data }) => setDispute(data.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchDispute(); }, [id]);

  const handleRespond = async () => {
    setSubmitting(true);
    await api.post(`/disputes/${id}/respond`, { response });
    fetchDispute();
    setResponse("");
    setSubmitting(false);
  };

  if (loading) return <Skeleton className="h-64 max-w-2xl" />;
  if (!dispute) return <p className="text-muted-foreground">Dispute not found.</p>;

  const isErrander = user?.id === dispute.errander?.id;
  const canRespond = isErrander && dispute.status === "open";

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/disputes"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <h1 className="text-2xl font-bold">{dispute.reason}</h1>
        <Badge>{dispute.status.replace(/_/g, " ")}</Badge>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <p>{dispute.description}</p>
          <div className="text-sm text-muted-foreground">
            <p>Raised by: {dispute.raised_by?.name}</p>
            <p>Errander: {dispute.errander?.name}</p>
            <p>Opened: {new Date(dispute.opened_at).toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      {dispute.errander_response && (
        <Card>
          <CardHeader><CardTitle className="text-base">Errander Response</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{dispute.errander_response}</p></CardContent>
        </Card>
      )}

      {dispute.resolution_note && (
        <Card className="border-green-200">
          <CardHeader><CardTitle className="text-base text-green-700">Resolution</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm">{dispute.resolution_note}</p>
            {dispute.resolved_at && <p className="text-xs text-muted-foreground mt-2">Resolved: {new Date(dispute.resolved_at).toLocaleString()}</p>}
          </CardContent>
        </Card>
      )}

      {canRespond && (
        <Card>
          <CardHeader><CardTitle className="text-base">Submit Response</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={4} value={response} onChange={(e) => setResponse(e.target.value)}
              placeholder="Describe your side of the story..." />
            <Button onClick={handleRespond} disabled={submitting || !response.trim()} className="w-full">
              <Send className="w-4 h-4 mr-2" /> Submit Response
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
