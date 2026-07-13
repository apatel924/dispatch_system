'use client'

import Link from "next/link";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Phone, Mail, Car, Calendar, Edit3, MessageSquare, CheckCircle2, XCircle, Clock, Truck, ArrowLeft, Activity, StickyNote } from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { StatCard } from "@/components/dash/ui/stat-card";
import { SectionCard } from "@/components/dash/ui/section-card";
import { TableScroll } from "@/components/dash/ui/table-scroll";
import { DashEmptyState, DashErrorState, DashLoadingState } from "@/components/dash/ui/query-state";
import { DriverStatusBadge, OrderStatusBadge } from "@/components/dash/status-badge";
import { DriverEditDialog } from "@/components/dash/driver-edit-dialog";
import { DriverAccountAccessCard } from "@/components/dash/driver-account-access";
import { useAdminDriver } from "@/lib/dash/hooks/use-admin-drivers";
import { useAdminOrders } from "@/lib/dash/hooks/use-admin-orders";
import { cn } from "@/lib/utils";

function splitDateTime(value: string): { date: string; time: string } {
  const comma = value.indexOf(", ");
  if (comma === -1) return { date: value, time: "—" };
  return { date: value.slice(0, comma), time: value.slice(comma + 2) };
}

export function DriverProfilePage({ driverId }: { driverId: string }) {
  const { driver: d, loading, error, applyDriverUpdate } = useAdminDriver(driverId);
  const { orders: driverOrders, loading: ordersLoading, error: ordersError } = useAdminOrders({ driverId, limit: 20 });
  const [editOpen, setEditOpen] = useState(false);

  if (loading && !d) {
    return (
      <DashboardLayout title="Driver Profile">
        <DashLoadingState message="Loading driver…" />
      </DashboardLayout>
    );
  }

  if (error && !d) {
    return (
      <DashboardLayout title="Driver Profile">
        <DashErrorState message={error} />
      </DashboardLayout>
    );
  }

  if (!d) {
    return (
      <DashboardLayout title="Driver Profile">
        <DashEmptyState message="Driver not found" />
      </DashboardLayout>
    );
  }

  const recentOrders = driverOrders.slice(0, 10);

  return (
    <DashboardLayout title="Driver Profile">
      <Link href="/drivers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to Drivers
      </Link>

      <div className="rounded-xl border border-border bg-card shadow-[0_1px_2px_0_rgb(0_0_0/0.03)]">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <div className={`grid h-20 w-20 shrink-0 place-items-center rounded-full text-2xl font-bold sm:h-24 sm:w-24 ${d.avatarColor}`}>
            {d.initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-bold tracking-tight">{d.name}</h2>
              <DriverStatusBadge status={d.status} />
            </div>
            <p className="mt-1 font-mono text-sm text-muted-foreground">{d.id}</p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Edit3 className="h-4 w-4" /> Edit
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary">
              <MessageSquare className="h-4 w-4" /> Message
            </button>
          </div>
        </div>

        <div className="grid gap-px border-y border-border/60 bg-border/40 sm:grid-cols-2 lg:grid-cols-4">
          <ContactCell icon={Phone} label="Phone" href={`tel:${d.phone.replace(/\D/g, "")}`}>
            {d.phone}
          </ContactCell>
          <ContactCell icon={Mail} label="Email" href={`mailto:${d.email}`}>
            {d.email}
          </ContactCell>
          <ContactCell icon={Car} label="Vehicle">
            {d.vehicle ?? "Not provided"}
          </ContactCell>
          <ContactCell icon={Activity} label="Last Active">
            {d.lastActive && d.lastActive !== "—" ? d.lastActive : "No activity recorded"}
          </ContactCell>
        </div>

        {d.adminNote ? (
          <div className="border-t border-border/60 bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <StickyNote className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Internal admin note
                </div>
                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{d.adminNote}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 divide-x divide-y divide-border/60 bg-secondary/20 md:grid-cols-3 md:divide-y-0">
          <SummaryStat
            label="Total Deliveries"
            value={
              d.deliveries != null && d.deliveries > 0
                ? String(d.deliveries)
                : "No activity recorded"
            }
          />
          <SummaryStat
            label="Member Since"
            value={d.joinedDate ?? "Not provided"}
            icon={d.joinedDate ? Calendar : undefined}
          />
          <SummaryStat
            label="Success Rate"
            value={
              d.successRate != null ? `${d.successRate}%` : "No activity recorded"
            }
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Completed Today" value={d.completedToday} icon={CheckCircle2} tone="success" />
        <StatCard label="Failed Today" value={d.failedToday} icon={XCircle} tone="primary" />
        <StatCard label="Average Delivery Time" value={d.averageTime} icon={Clock} tone="purple" />
        <StatCard label="Active Orders" value={d.activeDeliveries} icon={Truck} tone="warning" />
      </div>

      <div className="mt-6">
        <SectionCard
          title="Recent Assignments"
          action={
            driverOrders.length > 0 ? (
              <Link href="/orders" className="text-xs font-semibold text-primary hover:underline">
                View All
              </Link>
            ) : undefined
          }
          padded={false}
        >
          {ordersError && (
            <div className="p-4">
              <DashErrorState message={ordersError} />
            </div>
          )}
          {ordersLoading && recentOrders.length === 0 ? (
            <DashLoadingState message="Loading assignments…" className="py-8" />
          ) : recentOrders.length === 0 ? (
            <DashEmptyState message="No assignments yet" />
          ) : (
            <>
              <TableScroll>
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Order #</th>
                      <th className="px-3 py-3 font-medium">Customer</th>
                      <th className="px-3 py-3 font-medium">Date</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {recentOrders.map((o) => {
                      const { date, time } = splitDateTime(o.updated);
                      return (
                        <tr key={o.id} className="transition-colors hover:bg-secondary/30">
                          <td className="px-5 py-3 font-mono">
                            <Link href={`/orders/${o.id}`} className="font-medium hover:text-primary hover:underline">
                              {o.id}
                            </Link>
                          </td>
                          <td className="px-3 py-3">{o.customer}</td>
                          <td className="px-3 py-3 text-muted-foreground">{splitDateTime(o.created).date}</td>
                          <td className="px-3 py-3">
                            <OrderStatusBadge status={o.status} />
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {date}{time !== "—" ? `, ${time}` : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>
              <div className="border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
                Showing {recentOrders.length} of {driverOrders.length} assignments
              </div>
            </>
          )}
        </SectionCard>
      </div>

      <DriverAccountAccessCard driverId={d.id} driverName={d.name} />

      <DriverEditDialog
        driver={d}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={applyDriverUpdate}
      />
    </DashboardLayout>
  );
}

function ContactCell({
  icon: Icon,
  label,
  href,
  children,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  children: React.ReactNode;
}) {
  const content = (
    <>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-0.5 truncate text-sm font-medium text-foreground">{children}</div>
      </div>
    </>
  );

  const className = cn(
    "flex items-center gap-3 bg-card p-4 transition-colors",
    href && "hover:bg-secondary/40",
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}

function SummaryStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="px-5 py-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold tracking-tight">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {value}
      </div>
    </div>
  );
}
