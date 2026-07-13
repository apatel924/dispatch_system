'use client'

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { Users, UserCheck, UserCog, Truck, XCircle, Clock, Search, Filter, Download, ChevronDown, MoreVertical, UserPlus } from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { StatCard } from "@/components/dash/ui/stat-card";
import { SectionCard } from "@/components/dash/ui/section-card";
import { TableScroll } from "@/components/dash/ui/table-scroll";
import { DashEmptyState, DashErrorState, DashLoadingState } from "@/components/dash/ui/query-state";
import { DriverStatusBadge } from "@/components/dash/status-badge";
import { useAdminDrivers } from "@/lib/dash/hooks/use-admin-drivers";
import { useAdminDashboardStats } from "@/lib/dash/hooks/use-admin-dashboard-stats";
import { averageMs, formatAvgMs } from "@/lib/delivery-metrics";
import { isApiEnabled } from "@/lib/dash/api/config";


export function DriversPage() {
  const router = useRouter();
  const apiEnabled = isApiEnabled();
  const { drivers, loading, error } = useAdminDrivers();
  const { stats: dashboardStats, loading: statsLoading, error: statsError } = useAdminDashboardStats();

  const stats = useMemo(() => {
    const durations = drivers
      .map((d) => d.averageDeliveryTimeMs)
      .filter((ms): ms is number => ms != null && ms > 0);

    const showPlaceholder = statsLoading && apiEnabled;

    return {
      total: showPlaceholder ? "—" : dashboardStats.totalActiveDrivers,
      available: showPlaceholder ? "—" : dashboardStats.availableDrivers,
      busy: showPlaceholder ? "—" : dashboardStats.busyDrivers,
      completedToday: showPlaceholder ? "—" : dashboardStats.completedToday,
      failedToday: showPlaceholder ? "—" : dashboardStats.failedToday,
      avgDeliveryTime: loading && drivers.length === 0 ? "—" : formatAvgMs(averageMs(durations)),
    };
  }, [drivers, loading, apiEnabled, dashboardStats, statsLoading]);

  const topPerformers = useMemo(() => {
    return [...drivers]
      .filter((d) => (d.deliveries ?? 0) > 0)
      .sort((a, b) => (b.deliveries ?? 0) - (a.deliveries ?? 0))
      .slice(0, 5);
  }, [drivers]);

  return (
    <DashboardLayout title="Drivers">
      {(error || statsError) && (
        <div className="mb-4 space-y-2">
          {error && <DashErrorState message={error} />}
          {statsError && <DashErrorState message={statsError} />}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total Drivers" value={stats.total} icon={Users} tone="info" />
        <StatCard label="Available Drivers" value={stats.available} icon={UserCheck} tone="success" />
        <StatCard label="Busy Drivers" value={stats.busy} icon={UserCog} tone="orange" />
        <StatCard label="Completed Today" value={stats.completedToday} icon={Truck} tone="purple" />
        <StatCard label="Failed Deliveries Today" value={stats.failedToday} icon={XCircle} tone="primary" />
        <StatCard label="Average Delivery Time" value={stats.avgDeliveryTime} icon={Clock} tone="warning" />
      </div>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <SectionCard className="min-w-0" title="All Drivers" padded={false} action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input placeholder="Search drivers…" className="h-9 w-full min-w-[160px] rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none sm:w-[200px]" /></div>
            <button className="inline-flex items-center gap-1 rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium"><Filter className="h-3.5 w-3.5" /> Filter</button>
            <button className="inline-flex items-center gap-1 rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium">Status <ChevronDown className="h-3 w-3" /></button>
            <button className="inline-flex items-center gap-1 rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium"><Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" /></button>
          </div>
        }>
          <TableScroll>
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-3 py-3 font-medium">Phone</th>
                  <th className="px-3 py-3 font-medium">Email</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap">Active</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap">Completed</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap">Failed</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap">Avg Time</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap">Last Active</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading && drivers.length === 0 ? (
                  <tr><td colSpan={10} className="px-5 py-8 text-center text-muted-foreground"><DashLoadingState message="Loading drivers…" /></td></tr>
                ) : drivers.length === 0 ? (
                  <tr><td colSpan={10}><DashEmptyState message="No drivers found" /></td></tr>
                ) : (
                  drivers.map((d) => (
                    <tr
                      key={d.id}
                      className="cursor-pointer hover:bg-secondary/30"
                      onClick={() => router.push(`/drivers/${d.id}`)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${d.avatarColor} text-xs font-semibold`}>{d.initials}</div>
                          <span className="font-medium">{d.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{d.phone}</td>
                      <td className="max-w-[200px] truncate px-3 py-3 text-muted-foreground">{d.email}</td>
                      <td className="px-3 py-3 whitespace-nowrap"><DriverStatusBadge status={d.status} /></td>
                      <td className="px-3 py-3 whitespace-nowrap">{d.activeDeliveries}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{d.completedToday}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{d.failedToday}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{d.averageTime}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{d.lastActive}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-secondary"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Actions for ${d.name}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableScroll>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
            <span>Showing {drivers.length === 0 ? 0 : 1} to {drivers.length} of {drivers.length} drivers loaded</span>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Top Performers" action={<Link href="/reports" className="text-xs font-semibold text-primary hover:underline">View Reports</Link>}>
            {topPerformers.length === 0 ? (
              <DashEmptyState message="No completed deliveries yet" className="py-6" />
            ) : (
              <div className="space-y-3">
                {topPerformers.map((d, i) => (
                  <Link href={`/drivers/${d.id}`} key={d.id} className="flex items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-secondary/30">
                    <div className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">{i + 1}</div>
                    <div className={`grid h-9 w-9 place-items-center rounded-full ${d.avatarColor} text-xs font-semibold`}>{d.initials}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.successRate != null ? `${d.successRate}% success` : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{d.deliveries ?? 0}</div>
                      <div className="text-xs text-muted-foreground">Deliveries</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard>
            <div className="text-center">
              <div className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary"><UserPlus className="h-5 w-5" /></div>
              <div className="text-sm font-semibold">Add New Driver</div>
              <p className="mt-1 text-xs text-muted-foreground">Create a new driver profile and send invitation to join the team.</p>
              <button className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><UserPlus className="h-4 w-4" /> Add New Driver</button>
            </div>
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
