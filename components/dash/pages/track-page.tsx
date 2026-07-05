'use client'

import { CheckCircle2, Truck, Package, MapPin, Phone, RefreshCw, MessageCircle, Clock, User } from "lucide-react";
import { Logo } from "@/components/dash/brand/logo";
import { OrderStatusBadge } from "@/components/dash/status-badge";
import { useTracking } from "@/lib/dash/hooks/use-tracking";
import type { TrackingView } from "@/lib/types/backend";

const STEP_ICONS = [Package, User, Truck, MapPin, CheckCircle2] as const;
const STEP_TONES = [
  "bg-info-soft text-info",
  "bg-purple-soft text-purple",
  "bg-orange-soft text-orange",
  "bg-orange-soft text-orange",
  "bg-success-soft text-success",
] as const;

function formatLastUpdated(iso: string): { time: string; date: string } {
  try {
    const d = new Date(iso);
    return {
      time: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      date: d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
    };
  } catch {
    return { time: "—", date: "—" };
  }
}

export function TrackPage({ trackingId }: { trackingId: string }) {
  const { tracking, loading, notFound, refresh } = useTracking(trackingId);

  if (loading && !tracking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">Loading tracking…</p>
      </div>
    );
  }

  if (notFound || !tracking) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md p-4 text-center">
          <div className="flex justify-center pt-2"><Logo /></div>
          <p className="mt-8 text-muted-foreground">Tracking information not found for {trackingId.toUpperCase()}</p>
        </div>
      </div>
    );
  }

  return <TrackContent tracking={tracking} onRefresh={refresh} refreshing={loading} />;
}

function TrackContent({
  tracking,
  onRefresh,
  refreshing,
}: {
  tracking: TrackingView;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const updated = formatLastUpdated(tracking.lastUpdatedAt);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md p-4">
        <div className="flex justify-center pt-2"><Logo /></div>
        <div className="mt-4 rounded-2xl border border-border bg-card p-5 text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Order Number</div>
          <div className="mt-1 text-2xl font-bold">{tracking.trackingId.toUpperCase()}</div>
          <div className="mt-3 flex justify-center"><OrderStatusBadge status={tracking.status} className="px-3 py-1 text-sm" /></div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-xl border border-border/60 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Est. Delivery</div>
              <div className="mt-1 text-sm font-bold">{tracking.estimatedArrival ?? "—"}</div>
              {tracking.deliveryType && <div className="text-xs">{tracking.deliveryType}</div>}
            </div>
            <div className="rounded-xl border border-border/60 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Last Updated</div>
              <div className="mt-1 text-sm font-bold">{updated.time}</div>
              <div className="text-xs">{updated.date}</div>
            </div>
          </div>
        </div>

        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="text-sm font-bold">Delivery Progress</div>
          <ol className="mt-4 space-y-4">
            {tracking.steps.map((s, i) => {
              const Icon = STEP_ICONS[i] ?? Package;
              const tone = STEP_TONES[i] ?? "bg-secondary text-muted-foreground";
              const done = s.status === "complete";
              const current = s.status === "current";
              return (
                <li key={s.label} className="flex items-start gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${done || current ? tone : "bg-secondary text-muted-foreground"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className={`text-sm ${done || current ? "font-semibold" : "text-muted-foreground"}`}>{s.label}</div>
                    {s.time && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{s.time}</div>
                    )}
                  </div>
                  {current && <span className="rounded-full bg-orange-soft px-2 py-0.5 text-[10px] font-semibold text-orange">In Progress</span>}
                </li>
              );
            })}
          </ol>
        </section>

        {tracking.driverFirstName && (
          <section className="mt-4 rounded-2xl border border-border bg-card p-5">
            <div className="text-sm font-bold">Your Driver</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-info-soft text-sm font-bold text-info">
                {tracking.driverFirstName.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{tracking.driverFirstName}</div>
                {tracking.vehicleDescription && (
                  <div className="text-xs text-muted-foreground">{tracking.vehicleDescription}</div>
                )}
              </div>
            </div>
          </section>
        )}

        {(tracking.pickupName || tracking.pickupAddress) && (
          <section className="mt-4 rounded-2xl border border-border bg-card p-5">
            <div className="text-sm font-bold">Pickup / Store</div>
            <div className="mt-2 flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-purple" />
              <div className="text-sm">
                {tracking.pickupName && <div className="font-semibold">{tracking.pickupName}</div>}
                {tracking.pickupAddress && <div className="text-muted-foreground">{tracking.pickupAddress}</div>}
              </div>
            </div>
          </section>
        )}

        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="text-sm font-bold">Need Help?</div>
          <div className="mt-1 text-xs text-muted-foreground">Support hours: Mon–Fri 8am–7pm · Sat 9am–5pm</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href="tel:+15551234567" className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-input bg-card text-sm font-semibold hover:bg-secondary"><Phone className="h-4 w-4 text-primary" /> Call Support</a>
            <button className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"><MessageCircle className="h-4 w-4" /> Contact Support</button>
          </div>
        </section>

        <button
          disabled={refreshing}
          onClick={onRefresh}
          className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-primary/30 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh Status
        </button>

        <footer className="mt-8 pb-6 text-center text-[11px] text-muted-foreground">Powered by <span className="font-semibold text-primary">Quick-Run Express</span></footer>
      </div>
    </div>
  );
}
