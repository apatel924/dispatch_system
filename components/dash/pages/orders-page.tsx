'use client'

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, Bookmark, Download, ChevronDown, X } from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { SectionCard } from "@/components/dash/ui/section-card";
import { DashEmptyState, DashErrorState, DashLoadingState } from "@/components/dash/ui/query-state";
import { OrderStatusBadge } from "@/components/dash/status-badge";
import { OrderActionsMenu } from "@/components/dash/order-actions-menu";
import { TableScroll } from "@/components/dash/ui/table-scroll";
import { useAdminOrders } from "@/lib/dash/hooks/use-admin-orders";
import type { OrderStatus } from "@/lib/types/backend";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All Statuses" },
  { value: "New", label: "New" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "Assigned", label: "Assigned" },
  { value: "Picked Up", label: "Picked Up" },
  { value: "En Route", label: "En Route" },
  { value: "Out for Delivery", label: "Out for Delivery" },
  { value: "Delivered", label: "Delivered" },
  { value: "Failed", label: "Failed" },
  { value: "Returned", label: "Returned" },
];

export function OrdersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const { orders, loading, error, refresh } = useAdminOrders({
    status: status || undefined,
    search: search.trim() || undefined,
  });

  const hasFilters = search.trim().length > 0 || status.length > 0;

  const statusLabel = useMemo(
    () => STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "All Statuses",
    [status],
  );

  function clearFilters() {
    setSearch("");
    setStatus("");
  }

  return (
    <DashboardLayout title="Orders">
      {error && (
        <div className="mb-4">
          <DashErrorState message={error} />
        </div>
      )}

      <SectionCard padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Order #, Customer, Phone, Driver or Address…"
              className="h-10 w-full rounded-lg border border-input bg-secondary/40 pl-10 pr-3 text-sm outline-none focus:border-primary/40 focus:bg-card focus:ring-3 focus:ring-primary/10"
            />
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"><Filter className="h-4 w-4" /> Filters</button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"><Bookmark className="h-4 w-4" /> Save View</button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"><Download className="h-4 w-4" /> Export <ChevronDown className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-4">
          <label className="group inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm hover:bg-secondary">
            <div className="text-left leading-tight">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-transparent text-xs font-medium outline-none"
                aria-label="Filter by status"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </label>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
            >
              <X className="h-3.5 w-3.5" /> Clear Filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 border-b border-border/60 bg-secondary/20 px-5 py-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 rounded border-input text-primary" />
          <span className="text-muted-foreground">0 selected</span>
          <button className="ml-2 inline-flex items-center gap-1 rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">Bulk Actions <ChevronDown className="h-3 w-3" /></button>
        </div>

        <TableScroll>
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-5 py-3"><input type="checkbox" className="h-4 w-4 rounded border-input" /></th>
                <th className="px-3 py-3 font-medium">Order #</th>
                <th className="px-3 py-3 font-medium">External Order #</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Phone</th>
                <th className="px-3 py-3 font-medium">Address</th>
                <th className="px-3 py-3 font-medium">Driver</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Created</th>
                <th className="px-3 py-3 font-medium">Updated</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading && orders.length === 0 ? (
                <tr><td colSpan={11} className="px-5 py-8 text-center text-muted-foreground"><DashLoadingState message="Loading orders…" /></td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={11}><DashEmptyState message={hasFilters ? "No orders match your filters" : "No orders found"} /></td></tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o.id}
                    className="cursor-pointer hover:bg-secondary/30"
                    onClick={() => router.push(`/orders/${o.id}`)}
                  >
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="h-4 w-4 rounded border-input" />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-foreground">{o.id}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{o.external}</td>
                    <td className="px-3 py-3">{o.customer}</td>
                    <td className="px-3 py-3 text-muted-foreground">{o.phone}</td>
                    <td className="px-3 py-3 max-w-[180px] truncate text-muted-foreground">{o.address}</td>
                    <td className="px-3 py-3">{o.driver ?? "—"}</td>
                    <td className="px-3 py-3"><OrderStatusBadge status={o.status as OrderStatus} /></td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{o.created}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{o.updated}</td>
                    <td className="px-5 py-3 text-right">
                      <OrderActionsMenu
                        order={o}
                        onStatusChanged={() => void refresh({ silent: true })}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScroll>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
          <span>
            {orders.length === 0
              ? "No orders to display"
              : `Showing 1 to ${orders.length} of ${orders.length} orders loaded${statusLabel !== "All Statuses" ? ` · ${statusLabel}` : ""}`}
          </span>
        </div>
      </SectionCard>
    </DashboardLayout>
  );
}
