'use client'

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  UserPlus,
  Truck,
  CheckCircle2,
  XCircle,
  Filter,
  CheckCircle,
  RefreshCw,
  FileEdit,
  ArrowRight,
} from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { StatCard } from "@/components/dash/ui/stat-card";
import { SectionCard } from "@/components/dash/ui/section-card";
import { DashEmptyState, DashErrorState } from "@/components/dash/ui/query-state";
import { OrdersTableSkeletonRows, DriverRowSkeleton } from "@/components/dash/ui/skeletons";
import { OrderStatusBadge, DriverStatusBadge } from "@/components/dash/status-badge";
import { OrderActionsMenu } from "@/components/dash/order-actions-menu";
import { MobileOrderCard, MobileOrderCardSkeleton } from "@/components/dash/orders/mobile-order-card";
import { AssignDriverDialog } from "@/components/dash/orders/assign-driver-dialog";
import { TableScroll } from "@/components/dash/ui/table-scroll";
import { useAdminOrders } from "@/lib/dash/hooks/use-admin-orders";
import { useAdminDrivers } from "@/lib/dash/hooks/use-admin-drivers";
import { useAdminDashboardStats } from "@/lib/dash/hooks/use-admin-dashboard-stats";
import { isApiEnabled } from "@/lib/dash/api/config";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateAfterOrderLifecycle } from "@/lib/dash/query/query-keys";

export function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const apiEnabled = isApiEnabled();
  const { orders, loading: ordersLoading, error: ordersError, refresh: refreshOrders } = useAdminOrders({ limit: 50 });
  const { drivers, loading: driversLoading, error: driversError } = useAdminDrivers({ limit: 20 });
  const { stats: dashboardStats, loading: statsLoading, error: statsError } = useAdminDashboardStats();
  const [assignTarget, setAssignTarget] = useState<{
    orderId: string;
    retryFailed?: boolean;
  } | null>(null);

  const onOrderStatusChanged = () => {
    void invalidateAfterOrderLifecycle(queryClient);
    void refreshOrders();
  };

  const onAssign = (orderId: string, options?: { retryFailed?: boolean }) => {
    setAssignTarget({ orderId, retryFailed: options?.retryFailed });
  };

  const stats = useMemo(() => {
    const failedReturnedLabel = apiEnabled && dashboardStats?.partialData
      ? "Failed / Returned Today (partial)"
      : "Failed / Returned Today";

    return [
      {
        label: "New Orders",
        value: dashboardStats?.newOrders ?? null,
        icon: FileText,
        tone: "info" as const,
        loading: statsLoading,
      },
      {
        label: "Awaiting Assignment",
        value: dashboardStats?.awaitingAssignment ?? null,
        icon: UserPlus,
        tone: "purple" as const,
        loading: statsLoading,
      },
      {
        label: "Active Deliveries",
        value: dashboardStats?.activeDeliveries ?? null,
        icon: Truck,
        tone: "orange" as const,
        loading: statsLoading,
      },
      {
        label: "Completed Today",
        value: dashboardStats?.completedToday ?? null,
        icon: CheckCircle2,
        tone: "success" as const,
        loading: statsLoading,
      },
      {
        label: failedReturnedLabel,
        value: dashboardStats?.failedReturnedToday ?? null,
        icon: XCircle,
        tone: "primary" as const,
        loading: statsLoading,
      },
    ];
  }, [apiEnabled, dashboardStats, statsLoading]);

  const recentActivity = useMemo(() => {
    return [...orders]
      .sort((a, b) => b.updated.localeCompare(a.updated))
      .slice(0, 5)
      .map((o) => {
        if (o.status === "Delivered") {
          return { icon: "check" as const, tone: "success", title: `Order ${o.id} delivered successfully`, by: o.driver ?? "System", time: o.updated };
        }
        if (o.status === "Out for Delivery") {
          return { icon: "truck" as const, tone: "orange", title: `Order ${o.id} is ${o.status.toLowerCase()}`, by: o.driver ?? "System", time: o.updated };
        }
        if (o.status === "Failed") {
          return { icon: "x" as const, tone: "destructive", title: `Order ${o.id} marked as failed`, by: o.driver ?? "System", time: o.updated };
        }
        if (o.status === "Returned") {
          return { icon: "refresh" as const, tone: "muted", title: `Order ${o.id} returned`, by: o.driver ?? "System", time: o.updated };
        }
        return { icon: "file" as const, tone: "info", title: `Order ${o.id} — ${o.status}`, by: o.driver ?? "System", time: o.updated };
      });
  }, [orders]);

  const activeDrivers = drivers.slice(0, 5);
  const tableOrders = orders.slice(0, 12);
  const availableCount = dashboardStats?.availableDrivers ?? null;
  const busyCount = dashboardStats?.busyDrivers ?? null;
  const completedToday = dashboardStats?.completedToday ?? null;
  const driverStatsLoading = statsLoading && apiEnabled;
  const assignOrder = assignTarget
    ? orders.find((o) => o.id === assignTarget.orderId)
    : undefined;

  return (
    <DashboardLayout title="Dashboard">
      {assignTarget && (
        <AssignDriverDialog
          open
          orderId={assignTarget.orderId}
          orderLabel={assignOrder ? `${assignOrder.id} · ${assignOrder.customer}` : assignTarget.orderId}
          currentDriverId={assignOrder?.driverId ?? null}
          currentDriverName={assignOrder?.driver ?? null}
          retryFailed={assignTarget.retryFailed}
          onClose={() => setAssignTarget(null)}
          onAssigned={onOrderStatusChanged}
        />
      )}

      {(ordersError || driversError || statsError) && (
        <div className="mb-4 space-y-2">
          {ordersError && <DashErrorState message={ordersError} />}
          {driversError && <DashErrorState message={driversError} />}
          {statsError && <DashErrorState message={statsError} />}
        </div>
      )}

      {apiEnabled && dashboardStats?.partialData && dashboardStats.partialDataMessage && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning-soft/40 px-4 py-3 text-sm text-warning-foreground">
          {dashboardStats.partialDataMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Mobile portrait: card-based operational layout */}
      <div className="mt-5 space-y-5 md:hidden">
        <SectionCard
          title="Active Orders"
          padded={false}
          action={
            <Link href="/orders" className="text-xs font-semibold text-primary hover:underline">
              All Orders
            </Link>
          }
        >
          {ordersLoading && tableOrders.length === 0 ? (
            <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading orders">
              <MobileOrderCardSkeleton />
              <MobileOrderCardSkeleton />
              <MobileOrderCardSkeleton />
            </div>
          ) : tableOrders.length === 0 ? (
            <DashEmptyState message="No orders found" />
          ) : (
            <ul className="space-y-3 p-4">
              {tableOrders.map((o) => (
                <li key={o.id}>
                  <MobileOrderCard
                    order={o}
                    onStatusChanged={onOrderStatusChanged}
                    onAssign={onAssign}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
            Showing {tableOrders.length === 0 ? 0 : 1} to {tableOrders.length} recent orders
          </div>
        </SectionCard>

        <SectionCard
          title="Driver Activity"
          action={
            <Link href="/drivers" className="text-xs font-semibold text-primary hover:underline">
              View All
            </Link>
          }
        >
          <div className="grid grid-cols-3 gap-2 pb-4 sm:gap-3">
            {([["Available", availableCount, "text-success"], ["Busy", busyCount, "text-warning-foreground"], ["Completed", completedToday, "text-success"]] as const).map(([l, v, tone]) => (
              <div key={l} className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-center sm:p-3">
                <div className="text-[10px] leading-tight text-muted-foreground sm:text-[11px]">{l}</div>
                <div className={`mt-1 min-h-[1.5rem] text-base font-bold tabular-nums sm:text-lg ${tone}`}>
                  {driverStatsLoading || v === null ? (
                    <span className="inline-block h-5 w-8 animate-pulse rounded bg-secondary" aria-hidden />
                  ) : (
                    v
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {driversLoading && activeDrivers.length === 0 ? (
              <>
                <DriverRowSkeleton />
                <DriverRowSkeleton />
                <DriverRowSkeleton />
              </>
            ) : activeDrivers.length === 0 ? (
              <DashEmptyState message="No drivers found" className="py-4" />
            ) : (
              activeDrivers.map((d) => (
                <Link
                  href={`/drivers/${d.id}`}
                  key={d.id}
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 hover:bg-secondary/30"
                >
                  <div className={`grid h-10 w-10 place-items-center rounded-full ${d.avatarColor} text-xs font-semibold`}>{d.initials}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{d.name}</span>
                      <DriverStatusBadge status={d.status} />
                    </div>
                    <div className="text-xs text-muted-foreground">{d.activeDeliveries} active</div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Recent Activity">
          {recentActivity.length === 0 ? (
            <DashEmptyState message="No recent activity" className="py-4" />
          ) : (
            <div className="space-y-4">
              {recentActivity.map((a, i) => {
                const Icon = a.icon === "check" ? CheckCircle : a.icon === "truck" ? Truck : a.icon === "file" ? FileEdit : a.icon === "x" ? XCircle : RefreshCw;
                const toneMap: Record<string, string> = {
                  success: "bg-success-soft text-success",
                  orange: "bg-orange-soft text-orange",
                  info: "bg-info-soft text-info",
                  destructive: "bg-primary/10 text-primary",
                  muted: "bg-secondary text-muted-foreground",
                };
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${toneMap[a.tone]}`}><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-tight">{a.title}</div>
                      <div className="text-xs text-muted-foreground">by {a.by}</div>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">{a.time}</div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Tablet + desktop: preserve existing table layout */}
      <div className="mt-6 hidden min-w-0 gap-6 md:grid xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard
          title="Active Orders"
          padded={false}
          action={
            <div className="flex items-center gap-2">
              <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"><Filter className="h-3.5 w-3.5" /> Filter</button>
              <Link href="/orders" className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary">All Orders</Link>
            </div>
          }
        >
          <TableScroll>
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Order #</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Driver</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-3 py-3 font-medium">Last Updated</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody
                className="divide-y divide-border/60"
                aria-busy={ordersLoading && tableOrders.length === 0 ? true : undefined}
                aria-label={ordersLoading && tableOrders.length === 0 ? "Loading orders" : undefined}
              >
                {ordersLoading && tableOrders.length === 0 ? (
                  <>
                    <tr className="sr-only">
                      <td colSpan={7}>Loading orders</td>
                    </tr>
                    <OrdersTableSkeletonRows rows={6} columns={7} />
                  </>
                ) : tableOrders.length === 0 ? (
                  <tr><td colSpan={7}><DashEmptyState message="No orders found" /></td></tr>
                ) : (
                  tableOrders.map((o) => (
                    <tr
                      key={o.id}
                      className="cursor-pointer hover:bg-secondary/30"
                      onClick={() => router.push(`/orders/${o.id}`)}
                    >
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-foreground">{o.id}</td>
                      <td className="px-3 py-3 text-foreground">{o.customer}</td>
                      <td className="px-3 py-3 text-muted-foreground">{o.driver ?? "—"}</td>
                      <td className="px-3 py-3"><OrderStatusBadge status={o.status} /></td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{o.created}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{o.updated}</td>
                      <td className="px-5 py-3 text-right">
                        <OrderActionsMenu
                          order={o}
                          onStatusChanged={onOrderStatusChanged}
                          onAssign={onAssign}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableScroll>
          <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
            <span>Showing {tableOrders.length === 0 ? 0 : 1} to {tableOrders.length} recent orders (latest {orders.length} loaded)</span>
            {orders.length > tableOrders.length && (
              <Link href="/orders" className="text-primary hover:underline">View all on Orders page</Link>
            )}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Driver Activity" action={<Link href="/drivers" className="text-xs font-semibold text-primary hover:underline">View All Drivers</Link>}>
            <div className="grid grid-cols-3 gap-3 pb-4">
              {([["Available", availableCount, "text-success"], ["Busy", busyCount, "text-warning-foreground"], ["Completed Today", completedToday, "text-success"]] as const).map(([l, v, tone]) => (
                <div key={l} className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">{l}</div>
                  <div className={`mt-1 min-h-[1.75rem] text-lg font-bold tabular-nums ${tone}`}>
                    {driverStatsLoading || v === null ? (
                      <span className="inline-block h-5 w-8 animate-pulse rounded bg-secondary" aria-hidden />
                    ) : (
                      v
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="divide-y divide-border/60">
              {driversLoading && activeDrivers.length === 0 ? (
                <div className="space-y-2 py-2">
                  <DriverRowSkeleton />
                  <DriverRowSkeleton />
                  <DriverRowSkeleton />
                </div>
              ) : activeDrivers.length === 0 ? (
                <DashEmptyState message="No drivers found" className="py-4" />
              ) : (
                activeDrivers.map((d) => (
                  <Link href={`/drivers/${d.id}`} key={d.id} className="flex items-center gap-3 py-2.5 hover:bg-secondary/30 -mx-2 px-2 rounded">
                    <div className={`grid h-9 w-9 place-items-center rounded-full ${d.avatarColor} text-xs font-semibold`}>{d.initials}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{d.name}</span>
                        <span className={`h-1.5 w-1.5 rounded-full ${d.status === "Available" ? "bg-success" : d.status === "Busy" ? "bg-warning" : "bg-muted-foreground"}`} />
                        <span className="sr-only">{d.status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{d.phone}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold">{d.activeDeliveries}</div>
                      <div className="text-muted-foreground">Active</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))
              )}
            </div>
            <Link href="/drivers" className="mt-4 flex w-full items-center justify-center rounded-lg border border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/5">View All Drivers</Link>
          </SectionCard>

          <SectionCard title="Recent Activity">
            {recentActivity.length === 0 ? (
              <DashEmptyState message="No recent activity" className="py-4" />
            ) : (
              <div className="space-y-4">
                {recentActivity.map((a, i) => {
                  const Icon = a.icon === "check" ? CheckCircle : a.icon === "truck" ? Truck : a.icon === "file" ? FileEdit : a.icon === "x" ? XCircle : RefreshCw;
                  const toneMap: Record<string, string> = { success: "bg-success-soft text-success", orange: "bg-orange-soft text-orange", info: "bg-info-soft text-info", destructive: "bg-primary/10 text-primary", muted: "bg-secondary text-muted-foreground" };
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${toneMap[a.tone]}`}><Icon className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium leading-tight">{a.title}</div>
                        <div className="text-xs text-muted-foreground">by {a.by}</div>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">{a.time}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
