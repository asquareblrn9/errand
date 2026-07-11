"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Save, Loader2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatsSkeleton } from "@/components/shared/SkeletonLoader";
import api from "@/lib/api";
import { toast } from "@/store/toastStore";
import { handleApiError } from "@/lib/error-handler";
import type { ApiResponse } from "@/types/api";

interface SettingItem {
  key: string;
  value: string | number | boolean;
  type: string;
  label: string;
  description?: string;
}

interface SettingsData {
  [group: string]: SettingItem[];
}

const GROUP_LABELS: Record<string, string> = {
  commission: "Commission & Fees",
  delivery: "Delivery Settings",
  general: "General Settings",
};

export default function AdminSettingsPage() {
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<SettingsData>>("/admin/settings");
      return data.data;
    },
  });

  const [formValues, setFormValues] = useState<Record<string, string>>({});

  // Initialize form when data loads
  const initialized = Object.keys(formValues).length > 0;
  if (settings && !initialized) {
    const values: Record<string, string> = {};
    Object.values(settings).forEach((items) => {
      items.forEach((item) => {
        values[item.key] = String(item.value);
      });
    });
    // Use setTimeout to avoid setState during render
    setTimeout(() => setFormValues(values), 0);
  }

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, string>) => {
      const payload = Object.entries(values).map(([key, value]) => ({ key, value }));
      return api.put("/admin/settings", { settings: payload });
    },
    onSuccess: () => {
      toast.success("Saved", "Platform settings updated.");
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
    onError: (err) => handleApiError(err, "Failed to save settings."),
  });

  if (isLoading) return <StatsSkeleton cards={2} />;
  if (!settings) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-foreground">Platform Settings</h1>
          <p className="text-base text-muted-foreground mt-1">
            Configure commissions, fees, and platform parameters
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate(formValues)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Save All</>
          )}
        </Button>
      </div>

      {Object.entries(settings).map(([group, items]) => (
        <Card key={group}>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              {GROUP_LABELS[group] ?? group}
            </CardTitle>
            <CardDescription>
              {group === "commission"
                ? "Fee percentages and transaction limits"
                : "General platform configuration"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item) => (
              <div key={item.key} className="space-y-2">
                <Label htmlFor={item.key}>
                  {item.label}
                  {item.type === "float" && " (₦ or %)"}
                </Label>
                {item.description && (
                  <p className="text-xs text-muted-foreground -mt-1">{item.description}</p>
                )}
                <Input
                  id={item.key}
                  type={item.type === "float" || item.type === "integer" ? "number" : "text"}
                  value={formValues[item.key] ?? ""}
                  onChange={(e) => setFormValues({ ...formValues, [item.key]: e.target.value })}
                  step={item.type === "float" ? "0.1" : "1"}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
