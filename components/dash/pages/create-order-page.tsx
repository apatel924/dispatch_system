'use client'

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User2, MapPin, Package, Users, ClipboardCheck, Plus, ChevronDown, Info, Save,
  ArrowLeft, ArrowRight, Building2,
} from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { SectionCard } from "@/components/dash/ui/section-card";
import { DriverStatusBadge } from "@/components/dash/status-badge";
import { createOrderApi } from "@/lib/dash/api/client";
import { isApiEnabled } from "@/lib/dash/api/config";
import { useAdminDrivers } from "@/lib/dash/hooks/use-admin-drivers";
import { isDriverAssignable } from "@/lib/driver-status";

const STEP_LABELS = [
  "Customer Details",
  "Pickup Location",
  "Delivery Details",
  "Order & Driver",
  "Review & Create",
] as const;

const TOTAL_STEPS = STEP_LABELS.length;

export function CreateOrderPage() {
  const router = useRouter();
  const { drivers, loading: driversLoading } = useAdminDrivers({ limit: 12 });
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [pickupName, setPickupName] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [unit, setUnit] = useState("");
  const [area, setArea] = useState("");
  const [instructions, setInstructions] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [externalOrderId, setExternalOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [serviceType, setServiceType] = useState("Standard Delivery");

  const assignableDrivers = useMemo(
    () => drivers.filter((d) => isDriverAssignable(d.status)),
    [drivers],
  );

  const selectedDriver = useMemo(
    () => assignableDrivers.find((d) => d.id === selectedDriverId) ?? null,
    [assignableDrivers, selectedDriverId],
  );

  useEffect(() => {
    if (assignableDrivers.length > 0 && !selectedDriverId) {
      setSelectedDriverId(assignableDrivers[0].id);
    }
  }, [assignableDrivers, selectedDriverId]);

  const validateStep = (step: number): string | null => {
    switch (step) {
      case 1:
        if (!firstName.trim()) return "First name is required.";
        if (!lastName.trim()) return "Last name is required.";
        if (!phone.trim()) return "Phone number is required.";
        return null;
      case 2:
        if (!pickupName.trim()) return "Pickup location name is required.";
        if (!pickupAddress.trim()) return "Pickup address is required.";
        return null;
      case 3:
        if (!deliveryAddress.trim()) return "Delivery address is required.";
        if (!area.trim()) return "Delivery area is required.";
        if (!deliveryDate.trim() || !deliveryTime.trim()) return "Delivery window is required.";
        return null;
      case 4:
        if (!selectedDriverId) return "Please select a driver.";
        return null;
      default:
        return null;
    }
  };

  const goNext = () => {
    const err = validateStep(currentStep);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const goBack = () => {
    setStepError(null);
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

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

  const steps = STEP_LABELS.map((label, i) => ({
    n: i + 1,
    label,
    active: currentStep === i + 1,
    done: currentStep > i + 1,
  }));

  return (
    <DashboardLayout title="Create Order">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-y-3">
          {steps.map((s, i) => (
            <div key={s.n} className="flex flex-1 min-w-[120px] items-center">
              <div
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  s.active
                    ? "bg-primary text-primary-foreground"
                    : s.done
                      ? "bg-success text-success-foreground"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {s.done ? "✓" : s.n}
              </div>
              <span
                className={`ml-2 text-sm ${
                  s.active ? "font-semibold text-primary" : s.done ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && <div className="mx-3 h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {currentStep === 1 && (
          <SectionCard title="Customer Details" icon={<User2 className="h-4 w-4" />}>
            <p className="mb-4 text-sm text-muted-foreground">
              Enter the customer&apos;s contact information. They&apos;ll receive tracking and delivery notifications.
            </p>
            <div className="grid max-w-2xl grid-cols-2 gap-4">
              <Input label="First Name *" value={firstName} onChange={setFirstName} placeholder="Maria" />
              <Input label="Last Name *" value={lastName} onChange={setLastName} placeholder="Sanchez" />
              <Input label="Phone Number *" value={phone} onChange={setPhone} placeholder="(555) 301-6542" />
              <Input label="Email" value={email} onChange={setEmail} placeholder="maria@company.com" />
              <div className="col-span-2">
                <Input label="Company / Business Name" value={company} onChange={setCompany} placeholder="Acme Manufacturing" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-info/30 bg-info-soft/60 px-3 py-2 text-xs text-info">
              <Info className="h-3.5 w-3.5 shrink-0" /> Customer will receive order tracking and delivery notifications.
            </div>
          </SectionCard>
        )}

        {currentStep === 2 && (
          <SectionCard title="Pickup Location" icon={<Building2 className="h-4 w-4" />}>
            <p className="mb-4 text-sm text-muted-foreground">
              Where should the driver pick up this order?
            </p>
            <div className="max-w-2xl space-y-4">
              <Input label="Location Name *" value={pickupName} onChange={setPickupName} placeholder="Northside Pharmacy" />
              <Input label="Pickup Address *" value={pickupAddress} onChange={setPickupAddress} placeholder="4567 Medical Dr, Dallas, TX 75231" />
            </div>
          </SectionCard>
        )}

        {currentStep === 3 && (
          <SectionCard title="Delivery Details" icon={<MapPin className="h-4 w-4" />}>
            <p className="mb-4 text-sm text-muted-foreground">
              Enter the delivery destination, access details, and preferred window.
            </p>
            <div className="max-w-2xl space-y-4">
              <Input label="Delivery Address *" value={deliveryAddress} onChange={setDeliveryAddress} placeholder="123 Industrial Way, Dallas, TX 75201" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Unit / Buzzer" value={unit} onChange={setUnit} placeholder="Suite 200 / Buzz 42" />
                <Input label="Delivery Area *" value={area} onChange={setArea} placeholder="Dallas Central" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Delivery Instructions</label>
                <textarea
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Ring doorbell. Leave with front desk if no one available."
                  className="w-full rounded-lg border border-input bg-card p-3 text-sm outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Delivery Date *" value={deliveryDate} onChange={setDeliveryDate} placeholder="May 16, 2025" />
                <Input label="Delivery Time *" value={deliveryTime} onChange={setDeliveryTime} placeholder="9:00 AM - 12:00 PM" />
              </div>
            </div>
          </SectionCard>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <SectionCard title="Order Details" icon={<Package className="h-4 w-4" />}>
              <div className="max-w-2xl grid grid-cols-2 gap-4">
                <Input label="External Order #" value={externalOrderId} onChange={setExternalOrderId} placeholder="ORD-55872" />
                <SelectField label="Priority *" value={priority} onChange={setPriority} options={["Low", "Medium", "High", "Urgent"]} />
                <SelectField label="Service Type *" value={serviceType} onChange={setServiceType} options={["Standard Delivery", "Express", "Same Day", "Scheduled"]} />
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium">Internal Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Handle with care. High value equipment."
                    className="w-full rounded-lg border border-input bg-card p-3 text-sm outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10"
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Assign Driver"
              icon={<Users className="h-4 w-4" />}
              action={<Link className="text-xs font-semibold text-primary hover:underline" href="/drivers">View All Drivers</Link>}
            >
              <div className="mb-4 max-w-2xl">
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
                    disabled={driversLoading || assignableDrivers.length === 0}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Assign driver"
                  >
                    <option value="" disabled>Select a driver</option>
                    {assignableDrivers.map((d) => (
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
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft/60 px-3 py-2 text-xs text-success">
                <Info className="h-3.5 w-3.5 shrink-0" /> Driver will be notified via SMS and in-app.
              </div>
            </SectionCard>
          </div>
        )}

        {currentStep === 5 && (
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <SectionCard title="Review Order" icon={<ClipboardCheck className="h-4 w-4" />}>
              <p className="mb-4 text-sm text-muted-foreground">
                Confirm all details below before creating the order.
              </p>
              <div className="grid gap-6 md:grid-cols-2">
                <ReviewBlock title="Customer" icon={<User2 className="h-4 w-4" />}>
                  <ReviewField label="Name" value={`${firstName} ${lastName}`.trim()} />
                  <ReviewField label="Phone" value={phone} />
                  {email && <ReviewField label="Email" value={email} />}
                  {company && <ReviewField label="Company" value={company} />}
                </ReviewBlock>
                <ReviewBlock title="Pickup" icon={<Building2 className="h-4 w-4" />}>
                  <ReviewField label="Location" value={pickupName} />
                  <ReviewField label="Address" value={pickupAddress} />
                </ReviewBlock>
                <ReviewBlock title="Delivery" icon={<MapPin className="h-4 w-4" />}>
                  <ReviewField label="Address" value={deliveryAddress} />
                  {unit && <ReviewField label="Unit / Buzzer" value={unit} />}
                  <ReviewField label="Area" value={area} />
                  {instructions && <ReviewField label="Instructions" value={instructions} />}
                  <ReviewField label="Window" value={`${deliveryDate}, ${deliveryTime}`} />
                </ReviewBlock>
                <ReviewBlock title="Order & Driver" icon={<Package className="h-4 w-4" />}>
                  {externalOrderId && <ReviewField label="External Order #" value={externalOrderId} />}
                  <ReviewField label="Service Type" value={serviceType} />
                  <ReviewField label="Priority" value={priority} />
                  {notes && <ReviewField label="Notes" value={notes} />}
                  {selectedDriver && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className={`grid h-8 w-8 place-items-center rounded-full ${selectedDriver.avatarColor} text-xs font-semibold`}>{selectedDriver.initials}</div>
                      <div>
                        <div className="text-sm font-semibold">{selectedDriver.name}</div>
                        <div className="text-xs text-muted-foreground">{selectedDriver.phone}</div>
                      </div>
                      <DriverStatusBadge status={selectedDriver.status} />
                    </div>
                  )}
                </ReviewBlock>
              </div>
            </SectionCard>

            <aside className="lg:sticky lg:top-24 self-start">
              <SectionCard title="Review Summary" icon={<ClipboardCheck className="h-4 w-4" />} action={<span className="rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-foreground">Ready</span>}>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Order Preview</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-lg font-bold">New Order</span>
                  <span className="rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-foreground">Ready to Create</span>
                </div>
                <Divider />
                <FieldBlock label="Customer" primary={`${firstName} ${lastName}`.trim()} secondary={phone} />
                <FieldBlock label="Pickup" primary={pickupName} secondary={pickupAddress} />
                <FieldBlock label="Deliver To" primary={deliveryAddress} secondary={unit || undefined} />
                <FieldBlock label="Delivery Window" primary={deliveryDate} secondary={deliveryTime} />
                <FieldBlock label="Service Type" primary={serviceType} />
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Priority</div>
                  <span className="mt-1 inline-block rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-foreground">{priority}</span>
                </div>
                <Divider />
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Assigned Driver</div>
                <div className="mt-2 flex items-center gap-2">
                  {selectedDriver ? (
                    <>
                      <div className={`grid h-8 w-8 place-items-center rounded-full ${selectedDriver.avatarColor} text-xs font-semibold`}>{selectedDriver.initials}</div>
                      <div className="text-sm">
                        <div className="font-semibold">{selectedDriver.name}</div>
                        <div className="text-xs text-muted-foreground">{selectedDriver.phone}</div>
                      </div>
                      <span className="ml-auto rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">{selectedDriver.status}</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">No driver selected</span>
                  )}
                </div>
              </SectionCard>
            </aside>
          </div>
        )}

        {(stepError || error) && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {stepError ?? error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}
            {currentStep === 1 && (
              <Link href="/orders" className="rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary">
                Cancel
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary">
                  <Save className="h-4 w-4" /> Save Draft
                </button>
                <button
                  type="button"
                  onClick={handleCreateOrder}
                  disabled={submitting || !selectedDriverId}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" /> {submitting ? "Creating…" : "Create Order"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      {label && <label className="mb-1 block text-xs font-medium">{label}</label>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-3 focus:ring-primary/10"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      {label && <label className="mb-1 block text-xs font-medium">{label}</label>}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full appearance-none rounded-lg border border-input bg-card px-3 pr-8 text-sm outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

function ReviewBlock({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span className="text-primary">{icon}</span> {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
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
