'use client'

import Link from "next/link";

import {
  FileText,
  UserPlus,
  Truck,
  CheckCircle2,
  XCircle,
  DollarSign,
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
import { OrderStatusBadge, PaymentBadge } from "@/components/dash/status-badge";
import { orders, drivers, recentActivity } from "@/lib/dash/mock-data";


export function DashboardPage() {
  const stats = [
    { label: "New Orders", value: 18, icon: FileText, tone: "info" as const, delta: "12%" },
    { label: "Awaiting Assignment", value: 27, icon: UserPlus, tone: "purple" as const, delta: "8%" },
    { label: "Active Deliveries", value: 64, icon: Truck, tone: "orange" as const, delta: "15%" },
    { label: "Completed Today", value: 152, icon: CheckCircle2, tone: "success" as const, delta: "18%" },
    { label: "Failed / Returned", value: 6, icon: XCircle, tone: "primary" as const, delta: "14%", trend: "down" as const },
    { label: "Payment Pending", value: "$4,890.50", icon: DollarSign, tone: "warning" as const, delta: "9%" },
  ];
  const active = drivers.slice(0, 5);
  return (
    <DashboardLayout title="Dashboard">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard
          title="Active Orders"
          padded={false}
          action={
            <div className="flex items-center gap-2">
              <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"><Filter className="h-3.5 w-3.5" /> Filter</button>
              <button className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary">All Orders</button>
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
                  <th className="px-3 py-3 font-medium">Payment</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                  <th className="px-3 py-3 font-medium">Last Updated</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {orders.slice(0, 12).map((o) => (
                  <tr key={o.id} className="hover:bg-secondary/30">
                    <td className="px-5 py-3">
                      <Link href={`/orders/${o.id}`} className="font-mono text-xs font-semibold text-foreground hover:text-primary">{o.id}</Link>
                    </td>
                    <td className="px-3 py-3 text-foreground">{o.customer}</td>
                    <td className="px-3 py-3 text-muted-foreground">{o.driver ?? "—"}</td>
                    <td className="px-3 py-3"><OrderStatusBadge status={o.status} /></td>
                    <td className="px-3 py-3"><PaymentBadge status={o.payment} /></td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{o.created}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{o.updated}</td>
                    <td className="px-5 py-3 text-right"><button className="rounded p-1 text-muted-foreground hover:bg-secondary"><MoreVertical className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
            <span>Showing 1 to 12 of 64 orders</span>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map((n) => (
                <button key={n} className={`h-7 w-7 rounded ${n===1?"border border-primary/40 text-primary":"hover:bg-secondary"}`}>{n}</button>
              ))}
            </div>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Driver Activity" action={<Link href="/drivers" className="text-xs font-semibold text-primary hover:underline">View All Drivers</Link>}>
            <div className="grid grid-cols-3 gap-3 pb-4">
              {[["Available", 12, "text-success"], ["Busy", 18, "text-warning-foreground"], ["Completed Today", 152, "text-success"]].map(([l, v, tone]) => (
                <div key={l as string} className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">{l}</div>
                  <div className={`mt-1 text-lg font-bold ${tone}`}>{v}</div>
                </div>
              ))}
            </div>
            <div className="divide-y divide-border/60">
              {active.map((d) => (
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
            <button className="mt-4 flex w-full items-center justify-center rounded-lg border border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/5">View All Drivers</button>
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