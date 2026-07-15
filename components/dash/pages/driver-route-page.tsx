'use client'

import Link from "next/link";
import { MapPin, Navigation, Package, Clock } from "lucide-react";
import { OrderStatusBadge } from "@/components/dash/status-badge";
import { DriverBottomNav } from "@/components/dash/driver/bottom-nav";
import { sortRouteStops } from "@/lib/dash/api/driver-adapters";
import { useDriverRouteOrders } from "@/lib/dash/hooks/use-driver-orders";
import { useDriverSession } from "@/lib/dash/hooks/use-driver-session";
import { getOrderProofs, orderMapsUrl, getDeliveryLocation } from "@/lib/dash/driver-store";

export function DriverRoutePage() {
  const { driver } = useDriverSession();
  const { stops, loading } = useDriverRouteOrders();
  const sortedStops = sortRouteStops(stops);
  const driverId = driver?.id;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-md p-4">
        <header>
          <h1 className="text-xl font-bold">Today&apos;s Route</h1>
          <p className="mt-1 text-sm text-muted-foreground">{sortedStops.length} stops · Optimized order</p>
        </header>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex h-40 items-center justify-center bg-secondary/50">
            <div className="text-center">
              <Navigation className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-2 text-sm font-semibold">Route map preview</p>
              <p className="text-xs text-muted-foreground">Map integration coming soon</p>
            </div>
          </div>
        </div>

        {loading && sortedStops.length === 0 ? (
          <div className="mt-4 p-8 text-center text-sm text-muted-foreground">Loading route…</div>
        ) : (
          <div className="mt-4 space-y-0">
            {sortedStops.map((stop, i) => (
              <div key={stop.id} className="relative flex gap-4 pb-6 last:pb-0">
                {i < sortedStops.length - 1 && (
                  <div className="absolute left-[19px] top-10 h-[calc(100%-16px)] w-0.5 bg-border" />
                )}
                <div className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${i === 0 ? "bg-primary text-primary-foreground" : "border-2 border-border bg-card"}`}>
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold">{stop.id}</div>
                      <div className="text-sm">{stop.customer}</div>
                    </div>
                    <OrderStatusBadge status={stop.status} />
                  </div>
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{getDeliveryLocation(stop)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs font-semibold">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" /> ETA {stop.eta}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link href={`/driver-orders/${stop.id}`} className="flex h-10 items-center justify-center gap-1 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                      <Package className="h-3.5 w-3.5" /> Open
                    </Link>
                    <a href={orderMapsUrl(stop, driverId ? getOrderProofs(driverId, stop.id).completedSteps : [])} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center justify-center gap-1 rounded-lg border border-primary text-xs font-semibold text-primary hover:bg-primary/5">
                      <MapPin className="h-3.5 w-3.5" /> Navigate
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <DriverBottomNav />
    </div>
  );
}
