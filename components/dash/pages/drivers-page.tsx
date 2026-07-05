'use client'

import Link from "next/link";

import { Users, UserCheck, UserCog, Truck, XCircle, Clock, Search, Filter, Download, ChevronDown, MoreVertical, UserPlus } from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { StatCard } from "@/components/dash/ui/stat-card";
import { SectionCard } from "@/components/dash/ui/section-card";
import { DriverStatusBadge } from "@/components/dash/status-badge";
import { drivers } from "@/lib/dash/mock-data";


export function DriversPage() {
  return (
    <DashboardLayout title="Drivers">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Drivers" value={48} icon={Users} tone="info" delta="8%" />
        <StatCard label="Available Drivers" value={22} icon={UserCheck} tone="success" delta="5%" />
        <StatCard label="Busy Drivers" value={18} icon={UserCog} tone="orange" delta="12%" />
        <StatCard label="Completed Today" value={152} icon={Truck} tone="purple" delta="18%" />
        <StatCard label="Failed Deliveries Today" value={6} icon={XCircle} tone="primary" delta="14%" trend="down" />
        <StatCard label="Average Delivery Time" value="28m" icon={Clock} tone="warning" delta="5%" trend="down" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <SectionCard title="All Drivers" padded={false} action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input placeholder="Search drivers…" className="h-9 w-[200px] rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none" /></div>
            <button className="inline-flex items-center gap-1 rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium"><Filter className="h-3.5 w-3.5" /> Filter</button>
            <button className="inline-flex items-center gap-1 rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium">Status <ChevronDown className="h-3 w-3" /></button>
            <button className="inline-flex items-center gap-1 rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium"><Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" /></button>
          </div>
        }>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-3 py-3 font-medium">Phone</th>
                  <th className="px-3 py-3 font-medium">Email</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Active Deliveries</th>
                  <th className="px-3 py-3 font-medium">Completed Today</th>
                  <th className="px-3 py-3 font-medium">Failed Today</th>
                  <th className="px-3 py-3 font-medium">Average Time</th>
                  <th className="px-3 py-3 font-medium">Last Active</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {drivers.map((d) => (
                  <tr key={d.id} className="hover:bg-secondary/30">
                    <td className="px-5 py-3">
                      <Link href={`/drivers/${d.id}`} className="flex items-center gap-3">
                        <div className={`grid h-9 w-9 place-items-center rounded-full ${d.avatarColor} text-xs font-semibold`}>{d.initials}</div>
                        <span className="font-medium hover:text-primary">{d.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{d.phone}</td>
                    <td className="px-3 py-3 text-muted-foreground">{d.email}</td>
                    <td className="px-3 py-3"><DriverStatusBadge status={d.status} /></td>
                    <td className="px-3 py-3">{d.activeDeliveries}</td>
                    <td className="px-3 py-3">{d.completedToday}</td>
                    <td className="px-3 py-3">{d.failedToday}</td>
                    <td className="px-3 py-3 text-muted-foreground">{d.averageTime}</td>
                    <td className="px-3 py-3 text-muted-foreground">{d.lastActive}</td>
                    <td className="px-5 py-3 text-right"><button className="rounded p-1 text-muted-foreground hover:bg-secondary"><MoreVertical className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
            <span>Showing 1 to 12 of 48 drivers</span>
            <div className="flex items-center gap-1">{[1,2,3,4,5].map((n) => (<button key={n} className={`h-7 w-7 rounded ${n===1?"border border-primary/40 text-primary":"hover:bg-secondary"}`}>{n}</button>))}</div>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Driver Availability">
            <div className="flex items-center gap-4">
              <Donut segments={[
                { value: 22, color: "var(--success)" },
                { value: 18, color: "var(--warning)" },
                { value: 6, color: "var(--muted-foreground)" },
                { value: 2, color: "var(--primary)" },
              ]} total={48} label="Total" />
              <div className="flex-1 space-y-2 text-sm">
                {[
                  ["Available", "22 (45.8%)", "bg-success"],
                  ["Busy", "18 (37.5%)", "bg-warning"],
                  ["Inactive", "6 (12.5%)", "bg-muted-foreground"],
                  ["Suspended", "2 (4.2%)", "bg-primary"],
                ].map(([l, v, c]) => (
                  <div key={l} className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${c}`} />
                    <span className="flex-1">{l}</span>
                    <span className="text-xs text-muted-foreground">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Top Performers" action={<a className="text-xs font-semibold text-primary hover:underline" href="#">View All</a>}>
            <div className="space-y-3">
              {drivers.filter(d => d.successRate).slice(0, 5).map((d, i) => (
                <Link href={`/drivers/${d.id}`} key={d.id} className="flex items-center gap-3">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">{i + 1}</div>
                  <div className={`grid h-9 w-9 place-items-center rounded-full ${d.avatarColor} text-xs font-semibold`}>{d.initials}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.successRate}% Success Rate</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{d.deliveries}</div>
                    <div className="text-xs text-muted-foreground">Deliveries</div>
                  </div>
                </Link>
              ))}
            </div>
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

function Donut({ segments, total, label }: { segments: { value: number; color: string }[]; total: number; label: string }) {
  const size = 128, stroke = 18, r = (size - stroke) / 2, C = 2 * Math.PI * r;
  const sum = segments.reduce((a, b) => a + b.value, 0);
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {segments.map((s, i) => {
          const len = (s.value / sum) * C;
          const el = <circle key={i} r={r} cx={size/2} cy={size/2} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />;
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-xl font-bold">{total}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}