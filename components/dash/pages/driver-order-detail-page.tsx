'use client'

import Link from "next/link";
import { ArrowLeft, Phone, MapPin, Package, DollarSign, PenTool, Camera, IdCard, CheckCircle2, Circle, Truck, ChevronRight } from "lucide-react";
import { OrderStatusBadge } from "@/components/dash/status-badge";

export function DriverOrderDetail({ orderId }: { orderId: string }) {
  const steps = [
    { label: "Arrived at pickup", done: true },
    { label: "Picked up", done: true },
    { label: "Out for delivery", done: true },
    { label: "Arrived at destination", done: true },
    { label: "Verify ID", done: false, action: IdCard },
    { label: "Capture signature", done: false, action: PenTool },
    { label: "Upload drop-off photo", done: false, action: Camera },
    { label: "Upload exterior/address photo", done: false, action: Camera },
  ];
  const complete = steps.every((s) => s.done);
  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card p-4">
        <Link href="/driver-dashboard" className="rounded-full p-1.5 hover:bg-secondary"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1"><div className="text-sm font-bold">{orderId}</div><div className="text-xs text-muted-foreground">Order details</div></div>
        <OrderStatusBadge status="Out for Delivery" />
      </header>

      <div className="mx-auto max-w-md space-y-4 p-4">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Customer</div>
          <div className="mt-1 text-lg font-bold">Acme Manufacturing</div>
          <div className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>123 Industrial Way, Dallas, TX 75201</span></div>
          <div className="mt-2 text-sm">ETA <span className="font-semibold">12:15 PM</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-input bg-card text-sm font-semibold hover:bg-secondary"><Phone className="h-4 w-4 text-primary" /> Call Customer</button>
            <button className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"><MapPin className="h-4 w-4" /> Open Maps</button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="text-sm font-bold">Pickup Information</div>
          <div className="mt-2 flex items-start gap-2"><Truck className="mt-0.5 h-4 w-4 text-purple" /><div className="text-sm"><div className="font-semibold">Northside Pharmacy</div><div className="text-muted-foreground">4567 Medical Dr, Dallas, TX 75231</div></div></div>
          <div className="mt-3 text-sm font-bold">Delivery Notes</div>
          <p className="mt-1 text-sm text-muted-foreground">Ring doorbell. Leave with front desk if no one available. Fragile — handle with care.</p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="text-sm font-bold">Payment / Order Summary</div>
          <div className="mt-2 flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-lg bg-orange-soft"><Package className="h-4 w-4 text-orange" /></div><div className="flex-1"><div className="text-sm font-medium">Industrial Pump Assembly</div><div className="text-xs text-muted-foreground">Qty 1 · SKU IPA-4000</div></div><div className="text-sm font-semibold">$509.52</div></div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-xs text-success"><DollarSign className="h-3.5 w-3.5" /> Paid via Visa •••• 4242 — no collection required</div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="text-sm font-bold">Required Delivery Steps</div>
          <ol className="mt-3 space-y-2">
            {steps.map((s) => (
              <li key={s.label} className={`flex items-center gap-3 rounded-xl border p-3 ${s.done ? "border-success/30 bg-success-soft/40" : "border-border"}`}>
                {s.done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                <span className={`flex-1 text-sm ${s.done ? "line-through opacity-70" : "font-medium"}`}>{s.label}</span>
                {!s.done && s.action && (<button className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-card px-2.5 py-1.5 text-xs font-semibold text-primary"><s.action className="h-3.5 w-3.5" /> Capture <ChevronRight className="h-3 w-3" /></button>)}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card p-3">
        <div className="mx-auto max-w-md">
          <button disabled={!complete} className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-bold ${complete ? "bg-primary text-primary-foreground hover:bg-primary/90" : "cursor-not-allowed bg-secondary text-muted-foreground"}`}>
            <CheckCircle2 className="h-5 w-5" /> Complete Delivery
          </button>
          {!complete && <div className="mt-1.5 text-center text-[11px] text-muted-foreground">Complete required proof steps to enable</div>}
        </div>
      </div>
    </div>
  );
}