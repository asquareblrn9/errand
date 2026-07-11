"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Tag, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ListSkeleton } from "@/components/shared/SkeletonLoader";
import api from "@/lib/api";
import { toast } from "@/store/toastStore";
import { handleApiError } from "@/lib/error-handler";
import type { ApiResponse } from "@/types/api";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  dispute_window_hours: number;
  sla_target_minutes: number;
  sort_order: number;
  is_active: boolean;
}

const emptyCategory = {
  name: "",
  slug: "",
  description: "",
  icon: "",
  dispute_window_hours: 48,
  sla_target_minutes: 120,
  sort_order: 0,
  is_active: true,
};

export default function AdminCategoriesPage() {
  const qc = useQueryClient();

  const { data: categories = [], isLoading, error } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Category[]>>("/admin/categories");
      return data.data;
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(emptyCategory);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyCategory);
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || "",
      icon: cat.icon || "",
      dispute_window_hours: cat.dispute_window_hours,
      sla_target_minutes: cat.sla_target_minutes,
      sort_order: cat.sort_order,
      is_active: cat.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/categories/${editing.id}`, form);
        toast.success("Updated", "Category updated.");
      } else {
        await api.post("/admin/categories", form);
        toast.success("Created", "Category created.");
      }
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      setDialogOpen(false);
    } catch (err) {
      handleApiError(err, "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/admin/categories/${deleteConfirm.id}`);
      toast.success("Deleted", "Category deleted.");
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      setDeleteConfirm(null);
    } catch (err) {
      handleApiError(err, "Failed to delete category.");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-foreground">Categories</h1>
          <p className="text-base text-muted-foreground mt-1">
            Manage errand categories and their settings
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> New Category
        </Button>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <AlertTriangle className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-1">Failed to load categories</h3>
            <Button variant="outline" className="mt-4" onClick={() => qc.invalidateQueries({ queryKey: ["admin", "categories"] })}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Tag className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-1">No categories</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first errand category.</p>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> New Category</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{cat.name}</span>
                      <Badge variant={cat.is_active ? "success" : "secondary"}>
                        {cat.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {cat.description || cat.slug} · SLA: {cat.sla_target_minutes}min · Dispute: {cat.dispute_window_hours}h
                    </p>
                  </div>
                  <div className="flex gap-1 ml-4 shrink-0">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(cat)} title="Edit">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteConfirm(cat)} title="Delete">
                      <Trash2 className="w-4 h-4 text-[#EF4444]" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Groceries" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="groceries (auto-generated)" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Icon (Lucide icon name)</Label>
              <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="shopping-cart" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SLA (minutes)</Label>
                <Input type="number" value={form.sla_target_minutes} onChange={(e) => setForm({ ...form, sla_target_minutes: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Dispute Window (hours)</Label>
                <Input type="number" value={form.dispute_window_hours} onChange={(e) => setForm({ ...form, dispute_window_hours: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  value={form.is_active ? "true" : "false"}
                  onChange={(e) => setForm({ ...form, is_active: e.target.value === "true" })}
                  className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editing ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
              Delete Category
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
