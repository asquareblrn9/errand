"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, Check, DollarSign, Truck, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatsSkeleton } from "@/components/shared/SkeletonLoader";
import api from "@/lib/api";
import { toast } from "@/store/toastStore";
import type { ApiResponse } from "@/types/api";

interface SettingItem {
  key: string;
  value: string | number | boolean;
  type: string;
  label: string;
  description?: string;
}

type SettingsData = Record<string, SettingItem[]>;

const GROUP_CONFIG: Record<string, { icon: React.ElementType; label: string; desc: string }> = {
  commission: { icon: DollarSign, label: "Platform Fees", desc: "Commission rates and fee structures" },
  delivery: { icon: Truck, label: "Delivery Settings", desc: "SLA defaults, late fees, and grace periods" },
  general: { icon: Building2, label: "General Settings", desc: "Platform-wide configuration" },
};

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<SettingsData>>("/admin/settings");
      return data.data;
    },
  });

  const [formValues, setFormValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings && Object.keys(formValues).length === 0) {
      const values: Record<string, string> = {};
      Object.values(settings).flat().forEach((s) => {
        values[s.key] = String(s.value ?? "");
      });
      setFormValues(values);
    }
  }, [settings, formValues]);

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      const payload = Object.entries(values).map(([key, value]) => ({ key, value }));
      await api.put("/admin/settings", { settings: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast.success("Settings saved", "All changes applied successfully.");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err: any) => {
      toast.error("Error", err?.response?.data?.message || "Could not save settings.");
    },
  });

  const handleChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) return <StatsSkeleton cards={3} />;
  if (!settings) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-foreground">Platform Settings</h1>
          <p className="text-base text-muted-foreground mt-1">Configure fees, delivery defaults, and platform parameters</p>
        </div>
        <Button onClick={() => saveMutation.mutate(formValues)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : saved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {saved ? "Saved" : "Save All"}
        </Button>
      </div>

      {Object.entries(GROUP_CONFIG).map(([group, config]) => {
        const items = settings[group];
        if (!items?.length) return null;
        const Icon = config.icon;

        return (
          <Card key={group}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{config.label}</CardTitle>
                  <CardDescription>{config.desc}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={item.key} className="text-sm font-medium">
                      {item.label}
                    </Label>
                    <Badge variant="outline" className="text-xs font-mono">
                      {item.type === "float" ? "₦ / %" : item.type}
                    </Badge>
                  </div>
                  <Input
                    id={item.key}
                    type={item.type === "float" || item.type === "integer" ? "number" : "text"}
                    value={formValues[item.key] ?? ""}
                    onChange={(e) => handleChange(item.key, e.target.value)}
                    step={item.type === "float" ? "0.1" : "1"}
                  />
                  {item.description && (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
