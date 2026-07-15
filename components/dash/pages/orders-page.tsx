'use client'

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, PlusCircle, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { SectionCard } from "@/components/dash/ui/section-card";
import { DashEmptyState, DashErrorState } from "@/components/dash/ui/query-state";
import { OrdersTableSkeletonRows } from "@/components/dash/ui/skeletons";
import { OrderStatusBadge } from "@/components/dash/status-badge";
import { OrderActionsMenu } from "@/components/dash/order-actions-menu";
import { TableScroll } from "@/components/dash/ui/table-scroll";
import { useAdminOrders } from "@/lib/dash/hooks/use-admin-orders";
import { dashboardGroupForOrder } from "@/lib/order-status";
import {
  ORDER_LIFECYCLE_TABS,
  type OrderLifecycleTabId,
} from "@/lib/dash/order-lifecycle-tabs";
import type { OrderStatus } from "@/lib/types/backend";
import { cn } from "@/lib/utils";

const TABLE_COLUMNS = 10;

export function OrdersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<OrderLifecycleTabId>("all");
  const { orders, loading, error, refresh, refreshing } = useAdminOrders({
    search: search.trim() || undefined,
  });

  const activeTab = ORDER_LIFECYCLE_TABS.find((t) => t.id === tab) ?? ORDER_LIFECYCLE_TABS[0];
  const hasSearch = search.trim().length > 0;

  const filteredOrders = useMemo(() => {
    if (!activeTab.group) return orders;
    return orders.filter(
      (o) => dashboardGroupForOrder(o) === activeTab.group,
    );
  }, [orders, activeTab.group]);

  const emptyMessage = hasSearch
    ? "No orders match your search"
    : activeTab.id !== "all"
      ? `No ${activeTab.label.toLowerCase()} orders`
      : "No orders found";

  return (
    <DashboardLayout title="Orders">
      {error && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <DashErrorState message={error} />
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      )}

      <SectionCard padded={false}>
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1 sm:min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <label htmlFor="orders-search" className="sr-only">
              Search orders
            </label>
            <input
              id="orders-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Order #, Customer, Phone, Driver or Address…"
              className="h-10 w-full rounded-lg border border-input bg-secondary/40 pl-10 pr-3 text-sm outline-none focus:border-primary/40 focus:bg-card focus:ring-3 focus:ring-primary/10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/create-order"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <PlusCircle className="h-4 w-4" /> Create Order
            </Link>
            <button
              type="button"
              disabled={loading || refreshing}
              onClick={() => void refresh()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              aria-label="Refresh orders"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        <div
          className="flex flex-wrap gap-1 border-b border-border/60 px-3 py-2 sm:px-4"
          role="tablist"
          aria-label="Order lifecycle"
        >
          {ORDER_LIFECYCLE_TABS.map((item) => {
            const selected = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  selected
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <TableScroll>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium sm:px-5">Order #</th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">External #</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">Phone</th>
                <th className="hidden px-3 py-3 font-medium xl:table-cell">Address</th>
                <th className="px-3 py-3 font-medium">Driver</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">Created</th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">Updated</th>
                <th className="px-4 py-3 font-medium sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody
              className="divide-y divide-border/60"
              aria-busy={loading && orders.length === 0 ? true : undefined}
              aria-label={loading && orders.length === 0 ? "Loading orders" : undefined}
            >
              {loading && orders.length === 0 ? (
                <>
                  <tr className="sr-only">
                    <td colSpan={TABLE_COLUMNS}>Loading orders</td>
                  </tr>
                  <OrdersTableSkeletonRows rows={8} columns={TABLE_COLUMNS} />
                </>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS}>
                    <DashEmptyState message={emptyMessage} />
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr
                    key={o.id}
                    className="cursor-pointer hover:bg-secondary/30"
                    onClick={() => router.push(`/orders/${o.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground sm:px-5">
                      {o.id}
                    </td>
                    <td className="hidden px-3 py-3 text-xs text-muted-foreground md:table-cell">
                      {o.external}
                    </td>
                    <td className="px-3 py-3">{o.customer}</td>
                    <td className="hidden px-3 py-3 text-muted-foreground lg:table-cell">
                      {o.phone}
                    </td>
                    <td className="hidden max-w-[180px] truncate px-3 py-3 text-muted-foreground xl:table-cell">
                      {o.address}
                    </td>
                    <td className="px-3 py-3">{o.driver ?? "—"}</td>
                    <td className="px-3 py-3">
                      <OrderStatusBadge
                        status={o.status as OrderStatus}
                        unrecognizedStatusRaw={o.unrecognizedStatusRaw}
                      />
                    </td>
                    <td className="hidden px-3 py-3 text-xs text-muted-foreground lg:table-cell">
                      {o.created}
                    </td>
                    <td className="hidden px-3 py-3 text-xs text-muted-foreground md:table-cell">
                      {o.updated}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-5">
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
            {filteredOrders.length === 0
              ? "No orders to display"
              : `Showing ${filteredOrders.length} order${filteredOrders.length === 1 ? "" : "s"}${
                  activeTab.id !== "all" ? ` · ${activeTab.label}` : ""
                }${refreshing ? " · refreshing…" : ""}`}
          </span>
        </div>
      </SectionCard>
    </DashboardLayout>
  );
}
