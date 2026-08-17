"use client";

import { useState } from "react";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/shared/SkeletonLoader";

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface AdminDataTableProps {
  title: string;
  description?: string;
  columns: Column[];
  data: any[];
  isLoading: boolean;
  error: Error | null;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  exportUrl?: string;
  emptyMessage?: string;
  meta?: { current_page?: number; last_page?: number; total?: number; per_page?: number };
  onPageChange?: (page: number) => void;
  statusFilter?: React.ReactNode;
}

export function AdminDataTable({
  title, description, columns, data, isLoading, error,
  searchPlaceholder = "Search...", searchValue, onSearchChange,
  exportUrl, emptyMessage = "No data found.",
  meta, onPageChange, statusFilter,
}: AdminDataTableProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {exportUrl && (
              <a href={exportUrl} download>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1" /> Export CSV
                </Button>
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
          {statusFilter}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive font-medium">Error loading data</p>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {columns.map((col) => (
                      <th key={col.key} className="text-left py-2 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={row.id ?? i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      {columns.map((col) => (
                        <td key={col.key} className="py-2.5 px-3">
                          {col.render ? col.render(row[col.key], row) : row[col.key] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta && onPageChange && (meta.last_page ?? 1) > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Showing {((meta.current_page ?? 1) - 1) * (meta.per_page ?? 20) + 1}–{Math.min((meta.current_page ?? 1) * (meta.per_page ?? 20), meta.total ?? 0)} of {meta.total ?? 0}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => onPageChange((meta.current_page ?? 1) - 1)} disabled={(meta.current_page ?? 1) <= 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm px-3">{meta.current_page ?? 1} / {meta.last_page ?? 1}</span>
                  <Button variant="outline" size="sm" onClick={() => onPageChange((meta.current_page ?? 1) + 1)} disabled={(meta.current_page ?? 1) >= (meta.last_page ?? 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
