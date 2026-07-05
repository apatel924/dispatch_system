'use client'

import Link from "next/link";
import { ArrowLeft, Users, Send, Save, MoreVertical, FileText, MapPin, Package, User2, CreditCard, ClipboardList, CheckCircle2, Truck, Camera, PenTool } from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { SectionCard } from "@/components/dash/ui/section-card";
import { OrderStatusBadge, PaymentBadge } from "@/components/dash/status-badge";

export function OrderDetailPage({ orderId }: { orderId: string }) {
  return (
    <DashboardLayout title="Orders">
      <Link href="/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to Orders</Link>

      <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_0_rgb(0_0_0/0.03)]">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">{orderId}</h2>
          <OrderStatusBadge status="Picked Up" />
          <PaymentBadge status="Paid" />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"><Users className="h-4 w-4" /> Assign Driver</button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"><Send className="h-4 w-4" /> Resend Tracking Link</button>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Save className="h-4 w-4" /> Save Changes</button>
            <button className="rounded-lg border border-input bg-card p-2 hover:bg-secondary"><MoreVertical className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-6 md:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Assigned Driver</div>
            <div className="mt-2 flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-info-soft text-xs font-semibold text-info">JC</div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">James Carter</div>
                <div className="text-xs text-muted-foreground">(555) 234-9876</div>
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Created</div>
            <div className="mt-2 text-sm font-semibold">May 16, 2025</div>
            <div className="text-xs text-muted-foreground">9:03 AM</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Last Updated</div>
            <div className="mt-2 text-sm font-semibold">May 16, 2025</div>
            <div className="text-xs text-muted-foreground">11:28 AM</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Payment</div>
            <div className="mt-2"><PaymentBadge status="Paid" /></div>
            <div className="text-xs text-muted-foreground">Visa •••• 4242</div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <SectionCard title="Customer Information" icon={<User2 className="h-4 w-4" />} action={<button className="text-xs font-semibold text-primary hover:underline">Edit</button>}>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-purple" /><span className="font-semibold">Acme Manufacturing</span></div>
              <Field label="Contact Name" value="Maria Sanchez" />
              <Field label="Phone" value="(555) 301-6542" />
              <Field label="Email" value="maria.sanchez@acmemfg.com" />
              <Field label="Address" value="123 Industrial Way, Dallas, TX 75201" />
            </div>
          </SectionCard>
          <SectionCard title="Payment Summary" icon={<CreditCard className="h-4 w-4" />} action={<button className="text-xs font-semibold text-primary hover:underline">Edit</button>}>
            <div className="space-y-2 text-sm">
              <Row l="Payment Status" r={<PaymentBadge status="Paid" />} />
              <Row l="Payment Method" r="Visa •••• 4242" />
              <Row l="Subtotal" r="$4,590.00" />
              <Row l="Delivery Fee" r="$125.00" />
              <Row l="Tax (8.25%)" r="$375.50" />
              <div className="my-2 border-t border-border/60" />
              <Row l={<span className="text-base font-semibold">Total Paid</span>} r={<span className="text-base font-bold text-success">$4,890.50</span>} />
              <div className="text-xs text-muted-foreground">Paid on May 16, 2025 at 9:04 AM</div>
            </div>
          </SectionCard>
          <SectionCard title="Notes" action={<button className="text-xs font-semibold text-primary hover:underline">Edit</button>}>
            <p className="text-sm">Deliver to loading dock. Call upon arrival. Customer available until 5 PM. Fragile items – handle with care.</p>
            <div className="mt-3 text-xs text-muted-foreground">Added by Admin User on May 16, 2025 at 9:05 AM</div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Delivery Information" icon={<MapPin className="h-4 w-4" />} action={<button className="text-xs font-semibold text-primary hover:underline">Edit</button>}>
            <Field label="Service Type" value="Standard Delivery" />
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Pickup Location</div>
              <div className="mt-1 flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-purple" />
                <div className="text-sm">
                  <div className="font-semibold">Northside Pharmacy</div>
                  <div className="text-muted-foreground">4567 Medical Dr, Dallas, TX 75231</div>
                </div>
                <div className="ml-auto text-right text-xs text-muted-foreground">May 16<br />9:03 AM</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Delivery Location</div>
              <div className="mt-1 flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <div className="text-sm">
                  <div className="font-semibold">Acme Manufacturing – Receiving</div>
                  <div className="text-muted-foreground">123 Industrial Way, Dallas, TX 75201</div>
                </div>
                <div className="ml-auto text-right text-xs text-muted-foreground">May 16<br />11:28 AM</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Special Instructions</div>
              <p className="mt-1 text-sm">Ring doorbell. Leave with front desk if no one available.</p>
            </div>
          </SectionCard>
          <SectionCard title="Order / Product Summary" icon={<Package className="h-4 w-4" />} action={<button className="text-xs font-semibold text-primary hover:underline">Edit</button>} padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-5 py-2 font-medium">Item</th><th className="px-2 py-2 font-medium">Description</th><th className="px-2 py-2 font-medium">Qty</th><th className="px-2 py-2 font-medium">Unit Price</th><th className="px-5 py-2 font-medium">Total</th></tr>
              </thead>
              <tbody>
                <tr className="border-t border-border/60">
                  <td className="px-5 py-3"><div className="grid h-10 w-10 place-items-center rounded-lg bg-orange-soft"><Package className="h-5 w-5 text-orange" /></div></td>
                  <td className="px-2 py-3"><div className="font-medium">Industrial Pump Assembly</div><div className="text-xs text-muted-foreground">SKU: IPA-4000</div></td>
                  <td className="px-2 py-3">1</td><td className="px-2 py-3">$4,590.00</td><td className="px-5 py-3 font-semibold">$4,590.00</td>
                </tr>
              </tbody>
              <tfoot><tr className="border-t border-border/60 bg-secondary/20 text-sm"><td className="px-5 py-2">Total Items</td><td className="px-2 py-2">1</td><td className="px-2 py-2" colSpan={2}>Subtotal</td><td className="px-5 py-2 font-semibold">$4,590.00</td></tr></tfoot>
            </table>
          </SectionCard>
          <SectionCard title="Driver Assignment" icon={<Users className="h-4 w-4" />} action={<button className="text-xs font-semibold text-primary hover:underline">Edit</button>}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-info-soft text-sm font-semibold text-info">JC</div>
              <div>
                <div className="text-sm font-semibold">James Carter</div>
                <div className="text-xs text-muted-foreground">(555) 234-9876</div>
              </div>
              <div className="ml-auto"><span className="rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Available</span></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <Field label="Assigned" value="May 16, 2025 9:08 AM" />
              <Field label="Vehicle" value="White Ford Transit (QRX-21)" />
            </div>
            <div className="mt-3 text-xs"><span className="text-muted-foreground">Notes to Driver</span> — Please handle with care. Deliver to loading dock.</div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Status Timeline" icon={<ClipboardList className="h-4 w-4" />}>
            <ol className="space-y-4">
              {[
                { icon: FileText, tone: "purple", title: "Order Created", by: "Admin User", time: "9:03 AM", done: true },
                { icon: Users, tone: "info", title: "Assigned to Driver", by: "System", time: "9:08 AM", done: true },
                { icon: Package, tone: "orange", title: "Picked Up", by: "James Carter", time: "9:28 AM", done: true },
                { icon: Truck, tone: "orange", title: "Out for Delivery", by: "James Carter", time: "10:45 AM", done: true },
                { icon: MapPin, tone: "purple", title: "Arrived at Delivery Location", by: "James Carter", time: "11:26 AM", done: true },
                { icon: CheckCircle2, tone: "success", title: "Delivered", by: "James Carter", time: "11:28 AM", done: true },
              ].map((s, i) => {
                const toneBg: Record<string, string> = { purple: "bg-purple-soft text-purple", info: "bg-info-soft text-info", orange: "bg-orange-soft text-orange", success: "bg-success-soft text-success" };
                return (
                  <li key={i} className="flex items-start gap-3">
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${toneBg[s.tone]}`}><s.icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{s.title}</div>
                      <div className="text-xs text-muted-foreground">by {s.by}</div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      <div>May 16, 2025</div>
                      <div>{s.time}</div>
                    </div>
                    {s.done && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
                  </li>
                );
              })}
            </ol>
          </SectionCard>
          <SectionCard title="Proof of Delivery">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Customer Signature", icon: PenTool, note: "M. Sanchez" },
                { label: "Drop-off Photo", icon: Camera, note: "Front desk" },
                { label: "Exterior / Address", icon: Camera, note: "Loading dock" },
              ].map((p) => (
                <div key={p.label} className="text-center">
                  <div className="mb-1 text-xs text-muted-foreground">{p.label}</div>
                  <div className="grid aspect-square place-items-center rounded-lg border border-border bg-secondary/40">
                    <p.icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">May 16, 11:28 AM</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-lg border border-success/30 bg-success-soft/50 px-3 py-2 text-sm">
              <span className="font-medium">ID Verification Record</span>
              <span className="rounded-md bg-success text-success-foreground px-2 py-0.5 text-xs font-semibold">Verified</span>
            </div>
          </SectionCard>
          <SectionCard title="Notification History" padded={false}>
            <table className="w-full text-xs">
              <thead className="bg-secondary/30 text-left uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-2 font-medium">Type</th><th className="px-2 py-2 font-medium">To</th><th className="px-2 py-2 font-medium">Message</th><th className="px-4 py-2 font-medium">Sent</th></tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {[
                  ["Customer SMS", "Maria Sanchez", "Your order has been picked up.", "9:29 AM"],
                  ["Driver SMS", "James Carter", "New delivery assigned: QRX-10097", "9:08 AM"],
                  ["Customer SMS", "Maria Sanchez", "Your order is out for delivery.", "10:46 AM"],
                  ["Customer SMS", "Maria Sanchez", "Your order has been delivered. Thank you!", "11:28 AM"],
                ].map(([t, to, msg, at]) => (
                  <tr key={msg} className="hover:bg-secondary/30">
                    <td className="px-4 py-2 font-medium">{t}</td><td className="px-2 py-2">{to}</td>
                    <td className="px-2 py-2 text-muted-foreground truncate max-w-[160px]">{msg}</td>
                    <td className="px-4 py-2 text-muted-foreground">{at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3"><button className="w-full rounded-lg border border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/5">Send Message</button></div>
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}
function Row({ l, r }: { l: React.ReactNode; r: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{l}</span><span className="font-medium text-foreground">{r}</span></div>;
}