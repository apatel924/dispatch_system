'use client'

import Link from "next/link";

import { Bell, ClipboardList, CheckCircle2, XCircle, Package, Clock, MapPin, Home, FileText, Route as RouteIcon, MessageCircle, User, ChevronRight, Truck } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/dash/brand/logo";
import { OrderStatusBadge } from "@/components/dash/status-badge";


export function DriverDashboard() {
  const [available, setAvailable] = useState(true);
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-md p-4">
        <header className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0"><Logo collapsed /></div>
          <div className="min-w-0 flex-1"><h1 className="truncate text-xl font-bold">Driver Dashboard</h1><div className="text-xs text-muted-foreground">Friday, May 16, 2025</div></div>
          <button className="relative rounded-full p-2 text-muted-foreground hover:bg-secondary"><Bell className="h-5 w-5" /><span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">8</span></button>
        </header>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex-1"><div className="text-lg font-bold">Good morning, James</div><div className="text-xs text-muted-foreground">Here's your overview for today.</div></div>
          <button onClick={() => setAvailable(!available)} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${available ? "border-success/40 bg-success-soft text-success" : "border-border bg-secondary text-muted-foreground"}`}>
            <span className={`h-2 w-2 rounded-full ${available ? "bg-success" : "bg-muted-foreground"}`} />
            {available ? "Available" : "Offline"}
            <span className={`ml-1 inline-block h-5 w-9 rounded-full ${available ? "bg-success" : "bg-secondary"}`}><span className={`mt-0.5 block h-4 w-4 rounded-full bg-white transition-transform ${available ? "translate-x-4" : "translate-x-0.5"}`} /></span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniStat icon={ClipboardList} tone="bg-purple-soft text-purple" value={4} label="Assigned Today" delta="↑ 2 vs yesterday" up />
          <MiniStat icon={CheckCircle2} tone="bg-success-soft text-success" value={7} label="Completed" delta="↑ 3 vs yesterday" up />
          <MiniStat icon={XCircle} tone="bg-primary/10 text-primary" value={1} label="Failed / Returned" delta="↓ 1 vs yesterday" />
        </div>

        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between"><h2 className="text-base font-bold">Current Active Delivery</h2><OrderStatusBadge status="En Route" /></div>
          <div className="mt-3 flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-soft text-orange"><Truck className="h-5 w-5" /></div>
            <div>
              <div className="text-lg font-bold">QRX-10190</div>
              <div className="text-sm">Acme Manufacturing</div>
              <div className="text-sm text-muted-foreground">123 Industrial Way<br />Dallas, TX 75201</div>
              <div className="mt-2 flex items-center gap-1 text-sm"><Clock className="h-4 w-4 text-muted-foreground" /> ETA 12:15 PM</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/driver-orders/QRX-10190" className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Package className="h-4 w-4" /> Open Order</Link>
            <button className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-primary text-sm font-semibold text-primary hover:bg-primary/5"><MapPin className="h-4 w-4" /> Open Maps</button>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between"><h2 className="text-base font-bold">Today's Assignments</h2><a className="text-xs font-semibold text-primary" href="#">View All</a></div>
          <div className="mt-2 divide-y divide-border/60">
            {[
              { id: "QRX-10191", cust: "Northside Pharmacy", addr: "456 Medical Dr, Dallas, TX", status: "Assigned" as const, tone: "bg-purple-soft text-purple", eta: "10:45 AM" },
              { id: "QRX-10192", cust: "Global Office Supplies", addr: "789 Commerce St, Dallas, TX", status: "En Route" as const, tone: "bg-orange-soft text-orange", eta: "11:30 AM" },
              { id: "QRX-10193", cust: "Downtown Deli", addr: "321 Main St, Dallas, TX", status: "Out for Delivery" as const, tone: "bg-orange-soft text-orange", eta: "12:30 PM" },
              { id: "QRX-10194", cust: "Tech Solutions Inc.", addr: "901 Innovation Dr, Dallas, TX", status: "Scheduled" as const, tone: "bg-secondary text-muted-foreground", eta: "2:15 PM" },
            ].map((o) => (
              <Link href={`/driver-orders/${o.id}`} key={o.id} className="flex items-center gap-3 py-3">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${o.tone}`}><Package className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1"><div className="text-sm font-bold">{o.id}</div><div className="truncate text-sm">{o.cust}</div><div className="truncate text-xs text-muted-foreground">{o.addr}</div></div>
                <div className="text-right"><OrderStatusBadge status={o.status} /><div className="mt-1 text-xs font-semibold">{o.eta}</div><div className="text-[10px] text-muted-foreground">ETA</div></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between"><h2 className="text-base font-bold">Recent Completed</h2><a className="text-xs font-semibold text-primary" href="#">View All</a></div>
          <div className="mt-2 divide-y divide-border/60">
            {[["QRX-10188","Seaside Coffee Co.","9:05 AM"],["QRX-10187","West End Hardware","8:21 AM"]].map(([id,c,t]) => (
              <div key={id} className="flex items-center gap-3 py-3">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div className="flex-1"><div className="text-sm font-bold">{id}</div><div className="text-sm text-muted-foreground">{c}</div></div>
                <OrderStatusBadge status="Delivered" />
                <div className="ml-2 text-xs text-muted-foreground">{t}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {[
            { icon: Home, label: "Home", active: true },
            { icon: FileText, label: "Orders" },
            { icon: RouteIcon, label: "Route" },
            { icon: MessageCircle, label: "Messages", badge: 3 },
            { icon: User, label: "Account" },
          ].map((t) => (
            <button key={t.label} className={`relative flex flex-col items-center gap-1 py-3 text-[11px] font-medium ${t.active ? "text-primary" : "text-muted-foreground"}`}>
              {t.active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
              <div className="relative"><t.icon className="h-5 w-5" />{t.badge && <span className="absolute -top-1 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{t.badge}</span>}</div>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function MiniStat({ icon: Icon, tone, value, label, delta, up }: { icon: any; tone: string; value: number; label: string; delta: string; up?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2"><div className={`grid h-8 w-8 place-items-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></div><div className="text-xl font-bold leading-none">{value}</div></div>
      <div className="mt-2 text-[11px] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-[10px] font-semibold ${up ? "text-success" : "text-primary"}`}>{delta}</div>
    </div>
  );
}