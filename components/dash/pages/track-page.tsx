'use client'

import { CheckCircle2, Truck, Package, MapPin, Phone, RefreshCw, MessageCircle, Clock, User } from "lucide-react";
import { Logo } from "@/components/dash/brand/logo";
import { OrderStatusBadge } from "@/components/dash/status-badge";

export function TrackPage({ trackingId }: { trackingId: string }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md p-4">
        <div className="flex justify-center pt-2"><Logo /></div>
        <div className="mt-4 rounded-2xl border border-border bg-card p-5 text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Order Number</div>
          <div className="mt-1 text-2xl font-bold">{trackingId.toUpperCase()}</div>
          <div className="mt-3 flex justify-center"><OrderStatusBadge status="Out for Delivery" className="px-3 py-1 text-sm" /></div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-xl border border-border/60 p-3"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Est. Delivery</div><div className="mt-1 text-sm font-bold">Today</div><div className="text-xs">9:00 AM – 12:00 PM</div></div>
            <div className="rounded-xl border border-border/60 p-3"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Last Updated</div><div className="mt-1 text-sm font-bold">11:26 AM</div><div className="text-xs">May 16, 2025</div></div>
          </div>
        </div>

        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="text-sm font-bold">Delivery Progress</div>
          <ol className="mt-4 space-y-4">
            {[
              { icon: Package, title: "Order Received", time: "May 16, 9:03 AM", done: true, tone: "bg-info-soft text-info" },
              { icon: User, title: "Driver Assigned", time: "May 16, 9:08 AM", done: true, tone: "bg-purple-soft text-purple" },
              { icon: Truck, title: "Picked Up", time: "May 16, 9:28 AM", done: true, tone: "bg-orange-soft text-orange" },
              { icon: MapPin, title: "Out for Delivery", time: "May 16, 10:45 AM", done: true, tone: "bg-orange-soft text-orange", current: true },
              { icon: CheckCircle2, title: "Delivered", time: "Est. by 12:00 PM", done: false, tone: "bg-secondary text-muted-foreground" },
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${s.tone}`}><s.icon className="h-5 w-5" /></div>
                <div className="flex-1">
                  <div className={`text-sm ${s.done ? "font-semibold" : "text-muted-foreground"}`}>{s.title}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{s.time}</div>
                </div>
                {s.current && <span className="rounded-full bg-orange-soft px-2 py-0.5 text-[10px] font-semibold text-orange">In Progress</span>}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="text-sm font-bold">Your Driver</div>
          <div className="mt-3 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-info-soft text-sm font-bold text-info">J</div>
            <div className="flex-1"><div className="font-semibold">James</div><div className="text-xs text-muted-foreground">White Ford Transit Van</div></div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="text-sm font-bold">Pickup / Store</div>
          <div className="mt-2 flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-purple" /><div className="text-sm"><div className="font-semibold">Northside Pharmacy</div><div className="text-muted-foreground">4567 Medical Dr, Dallas, TX 75231</div></div></div>
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="text-sm font-bold">Need Help?</div>
          <div className="mt-1 text-xs text-muted-foreground">Support hours: Mon–Fri 8am–7pm · Sat 9am–5pm</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href="tel:+15551234567" className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-input bg-card text-sm font-semibold hover:bg-secondary"><Phone className="h-4 w-4 text-primary" /> Call Support</a>
            <button className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"><MessageCircle className="h-4 w-4" /> Contact Support</button>
          </div>
        </section>

        <button className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-primary/30 text-sm font-semibold text-primary hover:bg-primary/5"><RefreshCw className="h-4 w-4" /> Refresh Status</button>

        <footer className="mt-8 pb-6 text-center text-[11px] text-muted-foreground">Powered by <span className="font-semibold text-primary">Quick-Run Express</span></footer>
      </div>
    </div>
  );
}