'use client'

import Link from "next/link";
import { Phone, Mail, MapPin, Car, Calendar, IdCard, Edit3, UserX, MessageSquare, Star, CheckCircle2, XCircle, RotateCcw, Clock, TrendingUp, Truck, AlertTriangle, Info, User2, ArrowLeft } from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { StatCard } from "@/components/dash/ui/stat-card";
import { SectionCard } from "@/components/dash/ui/section-card";
import { DriverStatusBadge, OrderStatusBadge } from "@/components/dash/status-badge";
import { useAdminDriver } from "@/lib/dash/hooks/use-admin-drivers";
import { useAdminOrders } from "@/lib/dash/hooks/use-admin-orders";

export function DriverProfilePage({ driverId }: { driverId: string }) {
  const { driver: d } = useAdminDriver(driverId);
  const { orders: driverOrders } = useAdminOrders({ driverId, limit: 20 });

  if (!d) {
    return (
      <DashboardLayout title="Driver Profile">
        <p className="text-muted-foreground">Driver not found</p>
      </DashboardLayout>
    );
  }
  return (
    <DashboardLayout title="Driver Profile">
      <Link href="/drivers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to Drivers</Link>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start gap-6">
          <div className={`grid h-24 w-24 shrink-0 place-items-center rounded-full ${d.avatarColor} text-2xl font-bold`}>{d.initials}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold">{d.name}</h2>
              <DriverStatusBadge status={d.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Phone className="h-4 w-4" />{d.phone}</span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Mail className="h-4 w-4" />{d.email}</span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-4 w-4" />Dallas, TX 75201</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Car className="h-4 w-4" />White Ford Transit (QRX-21)</span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Calendar className="h-4 w-4" />Joined Apr 12, 2023</span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><IdCard className="h-4 w-4" />TX DL #12345678</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"><Edit3 className="h-4 w-4" /> Edit Driver</button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"><UserX className="h-4 w-4" /> Deactivate</button>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><MessageSquare className="h-4 w-4" /> Send Message</button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/60 pt-4 md:grid-cols-4">
          <MetaField label="Driver ID" value={d.id} />
          <MetaField label="Status" value={<span className="font-semibold text-success">Active</span>} />
          <MetaField label="Rating" value={<span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-warning text-warning" />{d.rating} / 5</span>} />
          <MetaField label="Total Deliveries" value={String(d.deliveries ?? "—")} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Completed Deliveries" value="1,142" icon={CheckCircle2} tone="success" delta="16%" compareLabel="vs last 30 days" />
        <StatCard label="Failed Deliveries" value={18} icon={XCircle} tone="primary" delta="10%" trend="down" compareLabel="vs last 30 days" />
        <StatCard label="Returned Orders" value={23} icon={RotateCcw} tone="orange" delta="8%" trend="down" compareLabel="vs last 30 days" />
        <StatCard label="Average Delivery Time" value="28 min" icon={Clock} tone="purple" delta="6m" trend="down" compareLabel="vs last 30 days" />
        <StatCard label="On-Time Rate" value="96.2%" icon={TrendingUp} tone="info" delta="4.1%" compareLabel="vs last 30 days" />
        <StatCard label="Active Orders" value={d.activeDeliveries} icon={Truck} tone="warning" delta="—" compareLabel="vs last 30 days" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard title="Delivery Performance" description="Last 30 Days" action={<button className="inline-flex items-center gap-1 rounded-lg border border-input px-2 py-1 text-xs">Last 30 Days ▾</button>}>
          <LineChart />
          <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg border border-border/60 bg-secondary/30 p-3 text-center">
            <div><div className="text-xs text-muted-foreground">Completed</div><div className="text-lg font-bold text-success">1,142</div></div>
            <div><div className="text-xs text-muted-foreground">Failed</div><div className="text-lg font-bold text-primary">18</div></div>
            <div><div className="text-xs text-muted-foreground">Returned</div><div className="text-lg font-bold text-orange">23</div></div>
            <div><div className="text-xs text-muted-foreground">Total</div><div className="text-lg font-bold">1,183</div></div>
          </div>
        </SectionCard>

        <SectionCard title="Recent Assignments" action={<a className="text-xs font-semibold text-primary hover:underline" href="#">View All</a>} padded={false}>
          <table className="w-full text-xs">
            <thead className="bg-secondary/30 text-left uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-2 font-medium">Order #</th><th className="px-2 py-2 font-medium">Customer</th><th className="px-2 py-2 font-medium">Date</th><th className="px-2 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Completed At</th></tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {driverOrders.slice(0, 5).map((o) => (
                <tr key={o.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-2 font-mono">{o.id}</td>
                  <td className="px-2 py-2">{o.customer}</td>
                  <td className="px-2 py-2 text-muted-foreground">May 16, 2025</td>
                  <td className="px-2 py-2"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-4 py-2 text-muted-foreground">{o.updated.split(", ")[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">Showing 1 to 5 of 20 assignments</div>
        </SectionCard>

        <SectionCard title="Current Assignments" action={<a className="text-xs font-semibold text-primary hover:underline" href="#">View All</a>}>
          <div className="space-y-4">
            {driverOrders.slice(0, 3).map((o) => (
              <div key={o.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-sm font-semibold">{o.id}</div>
                    <div className="text-sm">{o.customer}</div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{o.address}</div>
                  </div>
                  <div className="text-right text-xs"><div className="text-muted-foreground">ETA</div><div className="font-semibold">12:15 PM</div><OrderStatusBadge status={o.status} className="mt-1" /></div>
                </div>
                <div className="mt-2 text-[10px] uppercase text-muted-foreground">Priority: Normal</div>
              </div>
            ))}
          </div>
          <button className="mt-4 w-full rounded-lg border border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/5">View All Active Orders</button>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard title="Notes / Incidents" action={<a className="text-xs font-semibold text-primary hover:underline" href="#">Add Note</a>}>
          <div className="space-y-4">
            {[
              { icon: AlertTriangle, tone: "orange", title: "Address issue reported", body: "Customer unavailable on May 10. Left package at front desk.", meta: "May 10, 2025 · Admin User" },
              { icon: Info, tone: "info", title: "Excellent service feedback", body: "Received positive feedback for professional delivery.", meta: "May 7, 2025 · System" },
              { icon: AlertTriangle, tone: "warning", title: "Traffic delay", body: "Heavy traffic on I-35 caused 15 min delay.", meta: "May 2, 2025 · James Carter" },
            ].map((n, i) => {
              const toneBg: Record<string, string> = { orange: "bg-orange-soft text-orange", info: "bg-info-soft text-info", warning: "bg-warning-soft text-warning-foreground" };
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${toneBg[n.tone]}`}><n.icon className="h-4 w-4" /></div>
                  <div>
                    <div className="text-sm font-semibold">{n.title}</div>
                    <div className="text-sm text-muted-foreground">{n.body}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{n.meta}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="mt-4 w-full rounded-lg border border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/5">View All Notes</button>
        </SectionCard>

        <SectionCard title="Today's Route Summary">
          <div className="grid aspect-[16/9] place-items-center rounded-lg bg-gradient-to-br from-secondary/40 to-secondary/10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> Route map preview</div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <Meta label="Start Time" value="8:00 AM" />
            <Meta label="Est. End Time" value="3:30 PM" />
            <Meta label="Total Stops" value="8" />
            <Meta label="Completed" value="3" />
            <Meta label="Remaining" value="5" />
            <Meta label="Est. Distance" value="46.2 miles" />
          </div>
          <button className="mt-3 w-full rounded-lg border border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/5">View Full Route</button>
        </SectionCard>

        <SectionCard title="Account Activity" action={<a className="text-xs font-semibold text-primary hover:underline" href="#">View All</a>}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Last Login</div><div className="font-semibold">May 16, 2025 at 7:45 AM</div></div>
            <div><div className="text-xs text-muted-foreground">IP Address</div><div className="font-semibold">192.168.1.45</div></div>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            {[
              [CheckCircle2, "success", "Marked order QRX-10187 delivered", "11:08 AM"],
              [Edit3, "info", "Updated delivery status for QRX-10186", "10:32 AM"],
              [Truck, "orange", "Started route with 8 assignments", "8:00 AM"],
              [User2, "muted", "Logged in to system", "7:45 AM"],
            ].map(([Icon, tone, title, time], i) => {
              const toneBg: Record<string, string> = { success: "bg-success-soft text-success", info: "bg-info-soft text-info", orange: "bg-orange-soft text-orange", muted: "bg-secondary text-muted-foreground" };
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${toneBg[tone as string]}`}>{/* @ts-ignore */}<Icon className="h-4 w-4" /></div>
                  <div className="flex-1 text-sm">{title as string}</div>
                  <div className="text-xs text-muted-foreground">{time as string}</div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}

function MetaField({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-0.5 text-sm font-semibold">{value}</div></div>;
}
function Meta({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>;
}

function LineChart() {
  const w = 400, h = 160, pad = 24;
  const completed = [40, 55, 60, 50, 65, 70, 62, 68, 72, 75];
  const failed = [8, 6, 7, 10, 5, 6, 4, 7, 5, 3];
  const max = 80;
  const toPath = (arr: number[]) => arr.map((v, i) => {
    const x = pad + (i * (w - pad*2)) / (arr.length - 1);
    const y = h - pad - (v / max) * (h - pad*2);
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {[0,1,2,3].map(i => <line key={i} x1={pad} x2={w-pad} y1={pad + i*((h-pad*2)/3)} y2={pad + i*((h-pad*2)/3)} stroke="var(--border)" strokeDasharray="3 3" />)}
      <path d={toPath(completed)} fill="none" stroke="var(--success)" strokeWidth="2.5" />
      <path d={toPath(failed)} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
      {completed.map((v, i) => {
        const x = pad + (i * (w - pad*2)) / (completed.length - 1);
        const y = h - pad - (v / max) * (h - pad*2);
        return <circle key={i} cx={x} cy={y} r="3" fill="var(--success)" />;
      })}
    </svg>
  );
}