'use client'

import Link from "next/link";
import { Bell, ClipboardList, CheckCircle2, Package, Clock, MapPin, ChevronRight, Truck } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/dash/brand/logo";
import { OrderStatusBadge } from "@/components/dash/status-badge";
import { DriverBottomNav } from "@/components/dash/driver/bottom-nav";
import { pickActiveOrder } from "@/lib/dash/api/driver-adapters";
import { useDriverSession } from "@/lib/dash/hooks/use-driver-session";
import { useDriverOrders } from "@/lib/dash/hooks/use-driver-orders";
import { getOrderProofs, orderMapsUrl, getDeliveryLocation } from "@/lib/dash/driver-store";

export function DriverDashboard() {
  const [available, setAvailable] = useState(true);
  const { driver } = useDriverSession();
  const { activeOrders, completedOrders, loading } = useDriverOrders();

  const active = pickActiveOrder(activeOrders);
  const assignments = active ? activeOrders.filter((o) => o.id !== active.id) : [];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-md p-4">
        <header className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0"><Logo collapsed /></div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">Driver Dashboard</h1>
            <div className="text-xs text-muted-foreground">Friday, May 16, 2025</div>
          </div>
          <button className="relative rounded-full p-2 text-muted-foreground hover:bg-secondary" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">3</span>
          </button>
        </header>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex-1">
            <div className="text-lg font-bold">Good morning, {driver.name.split(" ")[0]}</div>
            <div className="text-xs text-muted-foreground">{activeOrders.length} deliveries assigned today</div>
          </div>
          <button
            onClick={() => setAvailable(!available)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${available ? "border-success/40 bg-success-soft text-success" : "border-border bg-secondary text-muted-foreground"}`}
          >
            <span className={`h-2 w-2 rounded-full ${available ? "bg-success" : "bg-muted-foreground"}`} />
            {available ? "Available" : "Offline"}
            <span className={`ml-1 inline-block h-5 w-9 rounded-full ${available ? "bg-success" : "bg-secondary"}`}>
              <span className={`mt-0.5 block h-4 w-4 rounded-full bg-white transition-transform ${available ? "translate-x-4" : "translate-x-0.5"}`} />
            </span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniStat icon={ClipboardList} tone="bg-purple-soft text-purple" value={activeOrders.length} label="Assigned" />
          <MiniStat icon={CheckCircle2} tone="bg-success-soft text-success" value={completedOrders.length} label="Completed" />
          <MiniStat icon={CheckCircle2} tone="bg-primary/10 text-primary" value={0} label="Failed" />
        </div>

        {loading && !active ? (
          <section className="mt-4 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading deliveries…
          </section>
        ) : active ? (
          <>
            <section className="mt-4 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Current Active Delivery</h2>
                <OrderStatusBadge status={active.status} />
              </div>
              <div className="mt-3 flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-soft text-orange">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-bold">{active.id}</div>
                  <div className="text-sm">{active.customer}</div>
                  <div className="text-sm text-muted-foreground">{getDeliveryLocation(active)}</div>
                  <div className="mt-2 flex items-center gap-1 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" /> ETA {active.eta}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link href={`/driver-orders/${active.id}`} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                  <Package className="h-4 w-4" /> Open Order
                </Link>
                <a href={orderMapsUrl(active, getOrderProofs(active.id).completedSteps)} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-primary text-sm font-semibold text-primary hover:bg-primary/5">
                  <MapPin className="h-4 w-4" /> Open Maps
                </a>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Today&apos;s Assignments</h2>
                <Link href="/driver-orders" className="text-xs font-semibold text-primary">View All</Link>
              </div>
              <div className="mt-2 divide-y divide-border/60">
                {assignments.map((o) => (
                  <Link href={`/driver-orders/${o.id}`} key={o.id} className="flex items-center gap-3 py-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-purple-soft text-purple">
                      <Package className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">{o.id}</div>
                      <div className="truncate text-sm">{o.customer}</div>
                    </div>
                    <div className="text-right">
                      <OrderStatusBadge status={o.status} />
                      <div className="mt-1 text-xs font-semibold">{o.eta}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="mt-4 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No active deliveries
          </section>
        )}

        {completedOrders.length > 0 && (
          <section className="mt-4 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-base font-bold">Recent Completed</h2>
            <div className="mt-2 divide-y divide-border/60">
              {completedOrders.map((o) => (
                <div key={o.id} className="flex items-center gap-3 py-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div className="flex-1">
                    <div className="text-sm font-bold">{o.id}</div>
                    <div className="text-sm text-muted-foreground">{o.customer}</div>
                  </div>
                  <OrderStatusBadge status="Delivered" />
                  <div className="text-xs text-muted-foreground">{o.eta}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      <DriverBottomNav />
    </div>
  );
}

function MiniStat({ icon: Icon, tone, value, label }: { icon: React.ElementType; tone: string; value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></div>
        <div className="text-xl font-bold leading-none">{value}</div>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
