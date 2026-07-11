"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, MapPin, Home, Briefcase, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";

interface Address {
  id: string;
  label: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code?: string;
  is_default: boolean;
  created_at: string;
}

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAddresses = () => {
    api.get<ApiResponse<Address[]>>("/me/addresses")
      .then(({ data }) => setAddresses(data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAddresses(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this address?")) return;
    await api.delete(`/me/addresses/${id}`);
    fetchAddresses();
  };

  const labelIcon = (label: string) => {
    switch (label) {
      case "home": return <Home className="w-4 h-4" />;
      case "work": return <Briefcase className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        {[...Array(2)].map((_, i) => (<Skeleton key={i} className="h-24" />))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Addresses</h1>
        <Link href="/addresses/new">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1" /> Add Address
          </Button>
        </Link>
      </div>

      {addresses.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No addresses saved yet.</p>
            <Link href="/addresses/new">
              <Button>Add Your First Address</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <Card key={addr.id} className={addr.is_default ? "border-primary/50" : ""}>
              <CardContent className="flex items-start justify-between pt-6">
                <div className="flex gap-3">
                  <div className="mt-0.5 text-muted-foreground">
                    {labelIcon(addr.label)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium capitalize">{addr.label}</span>
                      {addr.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
                    </div>
                    <p className="text-sm">{addr.address_line_1}</p>
                    {addr.address_line_2 && <p className="text-sm text-muted-foreground">{addr.address_line_2}</p>}
                    <p className="text-sm text-muted-foreground">{addr.city}, {addr.state}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Link href={`/addresses/${addr.id}/edit`}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(addr.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
