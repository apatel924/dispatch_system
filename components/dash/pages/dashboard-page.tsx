'use client'

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  UserPlus,
  Truck,
  CheckCircle2,
  XCircle,
  Filter,
  MoreVertical,
  CheckCircle,
  RefreshCw,
  FileEdit,
  ArrowRight,
} from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { StatCard } from "@/components/dash/ui/stat-card";
import { SectionCard } from "@/components/dash/ui/section-card";
import { OrderStatusBadge } from "@/components/dash/status-badge";
import { useAdminOrders } from "@/lib/dash/hooks/use-admin-orders";
import { useAdminDrivers } from "@/lib/dash/hooks/use-admin-drivers";

const ACTIVE_STATUSES = new Set(["Assigned", "Picked Up", "En Route", "Out for Delivery"]);

export function DashboardPage() {
  const router = useRouter();
  const { orders, loading: ordersLoading } = useAdminOrders({ limit: 50 });
  const { drivers, loading: driversLoading } = useAdminDrivers({ limit: 20 });

  const stats = useMemo(() => {
    const newCount = orders.filter((o) => o.status === "New").length;
    const awaiting = orders.filter((o) => !o.driver && (o.status === "New" || o.status === "Scheduled")).length;
    const active = orders.filter((o) => ACTIVE_STATUSES.has(o.status)).length;
    const completed = orders.filter((o) => o.status === "Delivered").length;
    const failedReturned = orders.filter((o) => o.status === "Failed" || o.status === "Returned").length;

    return [
      { label: "New Orders", value: newCount, icon: FileText, tone: "info" as const, delta: "12%" },
      { label: "Awaiting Assignment", value: awaiting, icon: UserPlus, tone: "purple" as const, delta: "8%" },
      { label: "Active Deliveries", value: active, icon: Truck, tone: "orange" as const, delta: "15%" },
      { label: "Completed Today", value: completed, icon: CheckCircle2, tone: "success" as const, delta: "18%" },
      { label: "Failed / Returned", value: failedReturned, icon: XCircle, tone: "primary" as const, delta: "14%", trend: "down" as const },
    ];
  }, [orders]);

  const recentActivity = useMemo(() => {
    return [...orders]
      .sort((a, b) => b.updated.localeCompare(a.updated))
      .slice(0, 5)
      .map((o) => {
        if (o.status === "Delivered") {
          return { icon: "check" as const, tone: "success", title: `Order ${o.id} delivered successfully`, by: o.driver ?? "System", time: o.updated };
        }
        if (o.status === "Out for Delivery" || o.status === "En Route") {
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
  const availableCount = drivers.filter((d) => d.status === "Available").length;
  const busyCount = drivers.filter((d) => d.status === "Busy").length;
  const completedToday = drivers.reduce((sum, d) => sum + d.completedToday, 0);

  return (
    <DashboardLayout title="Dashboard">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard
          title="Active Orders"
          padded={false}
          action={
            <div className="flex items-center gap-2">
              <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"><Filter className="h-3.5 w-3.5" /> Filter</button>
              <Link href="/orders" className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary">All Orders</Link>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Order #</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Driver</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                  <th className="px-3 py-3 font-medium">Last Updated</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {ordersLoading && tableOrders.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">Loading orders…</td></tr>
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
          <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
            <span>Showing 1 to {tableOrders.length} of {orders.length} orders</span>
            {orders.length > tableOrders.length && (
              <span className="text-muted-foreground">View all on Orders page</span>
            )}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Driver Activity" action={<Link href="/drivers" className="text-xs font-semibold text-primary hover:underline">View All Drivers</Link>}>
            <div className="grid grid-cols-3 gap-3 pb-4">
              {[["Available", availableCount, "text-success"], ["Busy", busyCount, "text-warning-foreground"], ["Completed Today", completedToday, "text-success"]].map(([l, v, tone]) => (
                <div key={l as string} className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">{l}</div>
                  <div className={`mt-1 text-lg font-bold ${tone}`}>{v}</div>
                </div>
              ))}
            </div>
            <div className="divide-y divide-border/60">
              {(driversLoading && activeDrivers.length === 0 ? [] : activeDrivers).map((d) => (
                <Link href={`/drivers/${d.id}`} key={d.id} className="flex items-center gap-3 py-2.5 hover:bg-secondary/30 -mx-2 px-2 rounded">
                  <div className={`grid h-9 w-9 place-items-center rounded-full ${d.avatarColor} text-xs font-semibold`}>{d.initials}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{d.name}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${d.status === "Available" ? "bg-success" : d.status === "Busy" ? "bg-warning" : "bg-muted-foreground"}`} />
                    </div>
                    <div className="text-xs text-muted-foreground">{d.phone}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-semibold">{d.activeDeliveries}</div>
                    <div className="text-muted-foreground">Active</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
            <Link href="/drivers" className="mt-4 flex w-full items-center justify-center rounded-lg border border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/5">View All Drivers</Link>
          </SectionCard>

          <SectionCard title="Recent Activity" action={<a className="text-xs font-semibold text-primary hover:underline" href="#">View All</a>}>
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
            <button className="mt-4 flex w-full items-center justify-center rounded-lg border border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/5">View All Activity</button>
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
