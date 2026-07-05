'use client'

import { User2, MapPin, Package, DollarSign, Users, ClipboardCheck, Plus, ChevronDown, Info, Save } from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { SectionCard } from "@/components/dash/ui/section-card";
import { drivers } from "@/lib/dash/mock-data";
import { DriverStatusBadge } from "@/components/dash/status-badge";


export function CreateOrderPage() {
  const steps = [
    { n: 1, label: "Customer Details", active: true, done: false },
    { n: 2, label: "Delivery Details", done: false },
    { n: 3, label: "Order Details", done: false },
    { n: 4, label: "Payment Details", done: false },
    { n: 5, label: "Driver Assignment", done: false },
    { n: 6, label: "Review & Create", done: false },
  ];
  return (
    <DashboardLayout title="Create Order">
      {/* stepper */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-y-3">
          {steps.map((s, i) => (
            <div key={s.n} className="flex flex-1 min-w-[140px] items-center">
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${s.active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{s.n}</div>
              <span className={`ml-2 text-sm ${s.active ? "font-semibold text-primary" : "text-muted-foreground"}`}>{s.label}</span>
              {i < steps.length - 1 && <div className="mx-3 h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="1. Customer Details" icon={<User2 className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-3">
                <Input label="First Name *" value="Maria" />
                <Input label="Last Name *" value="Sanchez" />
                <Input label="Phone Number *" value="(555) 301-6542" />
                <Input label="Email" value="maria.sanchez@acmemfg.com" />
                <div className="col-span-2"><Input label="Company / Business Name" value="Acme Manufacturing" /></div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-info/30 bg-info-soft/60 px-3 py-2 text-xs text-info"><Info className="h-3.5 w-3.5" /> Customer will receive order tracking and delivery notifications.</div>
            </SectionCard>
            <SectionCard title="2. Delivery Details" icon={<MapPin className="h-4 w-4" />}>
              <div className="space-y-3">
                <Select label="Pickup Location *" value="Northside Pharmacy - 4567 Medical Dr, Dallas, TX 75231" />
                <Input label="Delivery Address *" value="123 Industrial Way, Dallas, TX 75201" />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Unit / Buzzer" value="Suite 200 / Buzz 42" />
                  <Select label="Delivery Area *" value="Dallas Central" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Delivery Instructions</label>
                  <textarea rows={2} className="w-full rounded-lg border border-input bg-card p-2 text-sm outline-none focus:border-primary/50" defaultValue="Ring doorbell. Leave with front desk if no one available." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Delivery Window *" value="Today, May 16, 2025" />
                  <Select label="" value="9:00 AM - 12:00 PM" />
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="3. Order Details" icon={<Package className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-3">
                <Input label="External Order #" value="ORD-55872" />
                <div>
                  <label className="mb-1 block text-xs font-medium">Item Summary *</label>
                  <div className="rounded-lg border border-input p-2 text-xs"><div className="font-semibold">Industrial Pump Assembly</div><div className="text-muted-foreground">Qty: 1 · SKU: IPA-4000 · $459.00</div></div>
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium">Internal Notes</label>
                  <textarea rows={2} className="w-full rounded-lg border border-input p-2 text-sm outline-none focus:border-primary/50" defaultValue="Handle with care. High value equipment." />
                </div>
                <Select label="Priority *" value="🟠 Medium" />
                <Select label="Service Type *" value="Standard Delivery" />
              </div>
            </SectionCard>
            <SectionCard title="4. Payment Details" icon={<DollarSign className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Payment Status *" value="Unpaid" />
                <Select label="Payment Method *" value="Invoice" />
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                <Row l="Subtotal" r="$459.00" />
                <Row l="Delivery Fee" r="$12.50" />
                <Row l="Tax (8.25%)" r="$38.02" />
                <div className="my-2 border-t border-border/60" />
                <Row l={<span className="text-base font-semibold">Total</span>} r={<span className="text-base font-bold">$509.52</span>} />
              </div>
              <div className="mt-3"><Input label="Amount to Collect *" value="$0.00" /></div>
            </SectionCard>
          </div>

          <SectionCard title="5. Driver Assignment" icon={<Users className="h-4 w-4" />} action={<a className="text-xs font-semibold text-primary hover:underline" href="#">View All Drivers</a>}>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium">Assign Driver *</label>
              <div className="flex items-center gap-2 rounded-lg border border-input p-2">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-info-soft text-xs font-semibold text-info">JC</div>
                <span className="text-sm font-medium">James Carter</span>
                <span className="text-xs text-muted-foreground">(555) 234-9876</span>
                <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="mb-2 text-xs font-semibold text-muted-foreground">Available Drivers</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {drivers.slice(0, 4).map((d, i) => (
                <div key={d.id} className={`rounded-lg border p-3 text-center ${i===0?"border-primary ring-3 ring-primary/10":"border-border"}`}>
                  <div className={`mx-auto grid h-10 w-10 place-items-center rounded-full ${d.avatarColor} text-sm font-semibold`}>{d.initials}</div>
                  <div className="mt-2 text-sm font-semibold">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.phone}</div>
                  <div className="mt-1"><DriverStatusBadge status={d.status} /></div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft/60 px-3 py-2 text-xs text-success"><Info className="h-3.5 w-3.5" /> Driver will be notified via SMS and in-app.</div>
          </SectionCard>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary"><Save className="h-4 w-4" /> Save Draft</button>
            <div className="flex items-center gap-2">
              <button className="rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary">Cancel</button>
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"><Plus className="h-4 w-4" /> Create Order</button>
            </div>
          </div>
        </div>

        {/* Sticky review */}
        <aside className="lg:sticky lg:top-24 self-start">
          <SectionCard title="Review Summary" icon={<ClipboardCheck className="h-4 w-4" />} action={<span className="rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-foreground">Draft</span>}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Order Preview</div>
            <div className="mt-1 flex items-center gap-2"><span className="text-lg font-bold">QRX-10100</span><span className="rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-foreground">Draft</span></div>
            <Divider />
            <FieldBlock label="Customer" primary="Maria Sanchez" secondary="(555) 301-6542" />
            <FieldBlock label="Pickup" primary="Northside Pharmacy" secondary="4567 Medical Dr, Dallas, TX 75231" />
            <FieldBlock label="Deliver To" primary="123 Industrial Way, Dallas, TX 75201" secondary="Suite 200 / Buzz 42" />
            <FieldBlock label="Delivery Window" primary="Today, May 16, 2025" secondary="9:00 AM - 12:00 PM" />
            <FieldBlock label="Service Type" primary="Standard Delivery" />
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Priority</div><span className="mt-1 inline-block rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-foreground">Medium</span></div>
            <Divider />
            <Row l="Items (1 item)" r="$459.00" />
            <Row l="Subtotal" r="$459.00" />
            <Row l="Delivery Fee" r="$12.50" />
            <Row l="Tax (8.25%)" r="$38.02" />
            <div className="my-2 border-t border-border/60" />
            <Row l={<span className="text-sm font-semibold">Total</span>} r={<span className="text-sm font-bold">$509.52</span>} />
            <Row l="Amount to Collect" r={<span className="font-semibold text-success">$0.00</span>} />
            <Divider />
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Assigned Driver</div>
            <div className="mt-2 flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-info-soft text-xs font-semibold text-info">JC</div>
              <div className="text-sm"><div className="font-semibold">James Carter</div><div className="text-xs text-muted-foreground">(555) 234-9876</div></div>
              <span className="ml-auto rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Available</span>
            </div>
          </SectionCard>
        </aside>
      </div>
    </DashboardLayout>
  );
}

function Input({ label, value }: { label: string; value: string }) {
  return (
    <div>
      {label && <label className="mb-1 block text-xs font-medium">{label}</label>}
      <input defaultValue={value} className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10" />
    </div>
  );
}
function Select({ label, value }: { label: string; value: string }) {
  return (
    <div>
      {label && <label className="mb-1 block text-xs font-medium">{label}</label>}
      <button className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-card px-3 text-sm">
        <span className="truncate">{value}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
function Row({ l, r }: { l: React.ReactNode; r: React.ReactNode }) {
  return <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{l}</span><span className="font-medium">{r}</span></div>;
}
function Divider() { return <div className="my-3 border-t border-border/60" />; }
function FieldBlock({ label, primary, secondary }: { label: string; primary: string; secondary?: string }) {
  return (
    <div className="mt-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{primary}</div>
      {secondary && <div className="text-xs text-muted-foreground">{secondary}</div>}
    </div>
  );
}