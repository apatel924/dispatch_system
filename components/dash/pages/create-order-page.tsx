'use client'

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User2, MapPin, Package, Users, ClipboardCheck, Plus, ChevronDown, Info, Save } from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { SectionCard } from "@/components/dash/ui/section-card";
import { DriverStatusBadge } from "@/components/dash/status-badge";
import { createOrderApi } from "@/lib/dash/api/client";
import { isApiEnabled } from "@/lib/dash/api/config";
import { useAdminDrivers } from "@/lib/dash/hooks/use-admin-drivers";

export function CreateOrderPage() {
  const router = useRouter();
  const { drivers, loading: driversLoading } = useAdminDrivers({ limit: 12 });
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("Maria");
  const [lastName, setLastName] = useState("Sanchez");
  const [phone, setPhone] = useState("(555) 301-6542");
  const [email, setEmail] = useState("maria.sanchez@acmemfg.com");
  const [company, setCompany] = useState("Acme Manufacturing");
  const [pickupName, setPickupName] = useState("Northside Pharmacy");
  const [pickupAddress, setPickupAddress] = useState("4567 Medical Dr, Dallas, TX 75231");
  const [deliveryAddress, setDeliveryAddress] = useState("123 Industrial Way, Dallas, TX 75201");
  const [unit, setUnit] = useState("Suite 200 / Buzz 42");
  const [area, setArea] = useState("Dallas Central");
  const [instructions, setInstructions] = useState("Ring doorbell. Leave with front desk if no one available.");
  const [deliveryDate, setDeliveryDate] = useState("Today, May 16, 2025");
  const [deliveryTime, setDeliveryTime] = useState("9:00 AM - 12:00 PM");
  const [externalOrderId, setExternalOrderId] = useState("ORD-55872");
  const [notes, setNotes] = useState("Handle with care. High value equipment.");

  const selectedDriver = useMemo(
    () => drivers.find((d) => d.id === selectedDriverId) ?? null,
    [drivers, selectedDriverId],
  );

  useEffect(() => {
    if (drivers.length > 0 && !selectedDriverId) {
      setSelectedDriverId(drivers[0].id);
    }
  }, [drivers, selectedDriverId]);

  const steps = [
    { n: 1, label: "Customer Details", active: true, done: false },
    { n: 2, label: "Delivery Details", done: false },
    { n: 3, label: "Order Details", done: false },
    { n: 4, label: "Driver Assignment", done: false },
    { n: 5, label: "Review & Create", done: false },
  ];

  const handleCreateOrder = async () => {
    if (!selectedDriverId) {
      setError("Please select a driver before creating the order.");
      return;
    }
    if (!isApiEnabled()) {
      setError("API mode is required to create orders. Set NEXT_PUBLIC_USE_API=true.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { order } = await createOrderApi({
        customerName: `${firstName} ${lastName}`.trim(),
        customerPhone: phone,
        customerEmail: email || undefined,
        companyName: company || undefined,
        pickupName,
        pickupAddress,
        deliveryAddress,
        deliveryUnit: unit || undefined,
        deliveryArea: area || undefined,
        deliveryInstructions: instructions || undefined,
        deliveryWindow: `${deliveryDate}, ${deliveryTime}`,
        externalOrderId: externalOrderId || undefined,
        notes: notes || undefined,
        totalCents: 12850,
        assignedDriverId: selectedDriverId,
        source: "manual",
      });
      router.push(`/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

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
                <Input label="First Name *" value={firstName} onChange={setFirstName} />
                <Input label="Last Name *" value={lastName} onChange={setLastName} />
                <Input label="Phone Number *" value={phone} onChange={setPhone} />
                <Input label="Email" value={email} onChange={setEmail} />
                <div className="col-span-2"><Input label="Company / Business Name" value={company} onChange={setCompany} /></div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-info/30 bg-info-soft/60 px-3 py-2 text-xs text-info"><Info className="h-3.5 w-3.5" /> Customer will receive order tracking and delivery notifications.</div>
            </SectionCard>
            <SectionCard title="2. Delivery Details" icon={<MapPin className="h-4 w-4" />}>
              <div className="space-y-3">
                <Input label="Pickup Location *" value={`${pickupName} - ${pickupAddress}`} onChange={(v) => {
                  const [name, ...rest] = v.split(" - ");
                  setPickupName(name ?? "");
                  setPickupAddress(rest.join(" - "));
                }} />
                <Input label="Delivery Address *" value={deliveryAddress} onChange={setDeliveryAddress} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Unit / Buzzer" value={unit} onChange={setUnit} />
                  <Input label="Delivery Area *" value={area} onChange={setArea} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Delivery Instructions</label>
                  <textarea
                    rows={2}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="w-full rounded-lg border border-input bg-card p-2 text-sm outline-none focus:border-primary/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Delivery Window *" value={deliveryDate} onChange={setDeliveryDate} />
                  <Input label="" value={deliveryTime} onChange={setDeliveryTime} />
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="3. Order Details" icon={<Package className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-3">
              <Input label="External Order #" value={externalOrderId} onChange={setExternalOrderId} />
              <div>
                <label className="mb-1 block text-xs font-medium">Item Summary *</label>
                <div className="rounded-lg border border-input p-2 text-xs"><div className="font-semibold">Industrial Pump Assembly</div><div className="text-muted-foreground">Qty: 1 · SKU: IPA-4000</div></div>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium">Internal Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-input p-2 text-sm outline-none focus:border-primary/50"
                />
              </div>
              <Select label="Priority *" value="🟠 Medium" />
              <Select label="Service Type *" value="Standard Delivery" />
            </div>
          </SectionCard>

          <SectionCard title="4. Driver Assignment" icon={<Users className="h-4 w-4" />} action={<Link className="text-xs font-semibold text-primary hover:underline" href="/drivers">View All Drivers</Link>}>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium" htmlFor="assign-driver">Assign Driver *</label>
              <div className="relative flex items-center gap-2 rounded-lg border border-input p-2">
                {selectedDriver && (
                  <>
                    <div className={`grid h-8 w-8 place-items-center rounded-full ${selectedDriver.avatarColor} text-xs font-semibold`}>{selectedDriver.initials}</div>
                    <span className="text-sm font-medium">{selectedDriver.name}</span>
                    <span className="text-xs text-muted-foreground">{selectedDriver.phone}</span>
                  </>
                )}
                <select
                  id="assign-driver"
                  value={selectedDriverId ?? ""}
                  onChange={(e) => setSelectedDriverId(e.target.value || null)}
                  disabled={driversLoading || drivers.length === 0}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Assign driver"
                >
                  <option value="" disabled>Select a driver</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} — {d.phone}</option>
                  ))}
                </select>
                <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="mb-2 text-xs font-semibold text-muted-foreground">Available Drivers</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {drivers.slice(0, 4).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDriverId(d.id)}
                  className={`rounded-lg border p-3 text-center transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20 ${selectedDriverId === d.id ? "border-primary ring-3 ring-primary/10" : "border-border"}`}
                >
                  <div className={`mx-auto grid h-10 w-10 place-items-center rounded-full ${d.avatarColor} text-sm font-semibold`}>{d.initials}</div>
                  <div className="mt-2 text-sm font-semibold">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.phone}</div>
                  <div className="mt-1"><DriverStatusBadge status={d.status} /></div>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft/60 px-3 py-2 text-xs text-success"><Info className="h-3.5 w-3.5" /> Driver will be notified via SMS and in-app.</div>
          </SectionCard>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary"><Save className="h-4 w-4" /> Save Draft</button>
            <div className="flex items-center gap-2">
              <Link href="/orders" className="rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary">Cancel</Link>
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={submitting || !selectedDriverId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" /> {submitting ? "Creating…" : "Create Order"}
              </button>
            </div>
          </div>
        </div>

        {/* Sticky review */}
        <aside className="lg:sticky lg:top-24 self-start">
          <SectionCard title="Review Summary" icon={<ClipboardCheck className="h-4 w-4" />} action={<span className="rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-foreground">Draft</span>}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Order Preview</div>
            <div className="mt-1 flex items-center gap-2"><span className="text-lg font-bold">New Order</span><span className="rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-foreground">Draft</span></div>
            <Divider />
            <FieldBlock label="Customer" primary={`${firstName} ${lastName}`.trim()} secondary={phone} />
            <FieldBlock label="Pickup" primary={pickupName} secondary={pickupAddress} />
            <FieldBlock label="Deliver To" primary={deliveryAddress} secondary={unit} />
            <FieldBlock label="Delivery Window" primary={deliveryDate} secondary={deliveryTime} />
            <FieldBlock label="Service Type" primary="Standard Delivery" />
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Priority</div><span className="mt-1 inline-block rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-foreground">Medium</span></div>
            <Divider />
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Assigned Driver</div>
            <div className="mt-2 flex items-center gap-2">
              {selectedDriver ? (
                <>
                  <div className={`grid h-8 w-8 place-items-center rounded-full ${selectedDriver.avatarColor} text-xs font-semibold`}>{selectedDriver.initials}</div>
                  <div className="text-sm"><div className="font-semibold">{selectedDriver.name}</div><div className="text-xs text-muted-foreground">{selectedDriver.phone}</div></div>
                  <span className="ml-auto rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">{selectedDriver.status}</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">No driver selected</span>
              )}
            </div>
          </SectionCard>
        </aside>
      </div>
    </DashboardLayout>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange?: (v: string) => void }) {
  return (
    <div>
      {label && <label className="mb-1 block text-xs font-medium">{label}</label>}
      <input
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={!onChange}
        className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10"
      />
    </div>
  );
}
function Select({ label, value }: { label: string; value: string }) {
  return (
    <div>
      {label && <label className="mb-1 block text-xs font-medium">{label}</label>}
      <button type="button" className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-card px-3 text-sm">
        <span className="truncate">{value}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
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
