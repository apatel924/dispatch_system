'use client'

import { useRouter } from "next/navigation";
import { Search, Filter, Bookmark, Download, MoreVertical, Calendar, ChevronDown, X } from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { SectionCard } from "@/components/dash/ui/section-card";
import { OrderStatusBadge } from "@/components/dash/status-badge";
import { useAdminOrders } from "@/lib/dash/hooks/use-admin-orders";

export function OrdersPage() {
  const router = useRouter();
  const { orders, loading } = useAdminOrders();

  const filters = [
    { icon: Calendar, label: "Date Range", value: "May 10 – May 16, 2024" },
    { label: "Status", value: "All Statuses" },
    { label: "Driver", value: "All Drivers" },
    { label: "Delivery Area", value: "All Areas" },
  ];

  return (
    <DashboardLayout title="Orders">
      <SectionCard padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input placeholder="Search by Order #, Customer, Phone, Driver or Address…" className="h-10 w-full rounded-lg border border-input bg-secondary/40 pl-10 pr-3 text-sm outline-none focus:border-primary/40 focus:bg-card focus:ring-3 focus:ring-primary/10" />
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"><Filter className="h-4 w-4" /> Filters</button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"><Bookmark className="h-4 w-4" /> Save View</button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"><Download className="h-4 w-4" /> Export <ChevronDown className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-4">
          {filters.map((f) => (
            <button key={f.label} className="group inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm hover:bg-secondary">
              {f.icon && <f.icon className="h-4 w-4 text-muted-foreground" />}
              <div className="text-left leading-tight">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{f.label}</div>
                <div className="text-xs font-medium">{f.value}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ))}
          <button className="ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5"><X className="h-3.5 w-3.5" /> Clear Filters</button>
        </div>

        <div className="flex items-center gap-3 border-b border-border/60 bg-secondary/20 px-5 py-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 rounded border-input text-primary" />
          <span className="text-muted-foreground">0 selected</span>
          <button className="ml-2 inline-flex items-center gap-1 rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">Bulk Actions <ChevronDown className="h-3 w-3" /></button>
        </div>

        <div className="overflow-x-auto">
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
                <tr><td colSpan={11} className="px-5 py-8 text-center text-muted-foreground">Loading orders…</td></tr>
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
                    <td className="px-3 py-3"><OrderStatusBadge status={o.status} /></td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{o.created}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{o.updated}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-secondary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
          <span>Showing 1 to {orders.length} of {orders.length} orders</span>
          <div className="flex items-center gap-1">
            {[1,2,3,4,5,"…",17].map((n, i) => (
              <button key={i} className={`h-7 min-w-7 px-2 rounded ${n===1?"border border-primary/40 text-primary":"hover:bg-secondary"}`}>{n}</button>
            ))}
          </div>
        </div>
      </SectionCard>
    </DashboardLayout>
  );
}
