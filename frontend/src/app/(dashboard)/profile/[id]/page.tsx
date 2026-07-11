"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Star, Package, Shield, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";
import type { PublicProfile } from "@/types/user";

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ApiResponse<PublicProfile>>(`/users/${id}/profile`)
      .then(({ data }) => setProfile(data.data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-32 w-32 rounded-full mx-auto" />
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl text-center py-12">
        <p className="text-muted-foreground">User not found.</p>
      </div>
    );
  }

  const initials = profile.name
    .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-8 pb-6 flex flex-col items-center text-center">
          <Avatar className="w-24 h-24 mb-4 border-2 border-muted">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-xl bg-primary/10 text-primary font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-bold">{profile.name}</h1>
          <Badge className="mt-2 capitalize">
            {profile.role.replace("_", " ")}
          </Badge>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <Package className="w-5 h-5 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold">{profile.completed_orders}</div>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Star className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">--</div>
            <p className="text-sm text-muted-foreground">Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Calendar className="w-5 h-5 text-blue-500 mx-auto mb-2" />
            <div className="text-lg font-bold">{profile.member_since}</div>
            <p className="text-sm text-muted-foreground">Member Since</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
