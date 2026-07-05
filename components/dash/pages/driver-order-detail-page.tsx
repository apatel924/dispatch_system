'use client'

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, Phone, MapPin, Package, PenTool, Camera, IdCard,
  CheckCircle2, Circle, Truck, ChevronRight,
} from "lucide-react";
import { OrderStatusBadge } from "@/components/dash/status-badge";
import { ProofCaptureSheet, ProofThumbnail } from "@/components/dash/driver/proof-capture";
import {
  DELIVERY_STEPS, DEFAULT_COMPLETED_STEPS, getDriverOrder, type DeliveryStepKey,
} from "@/lib/dash/driver-mock-data";
import {
  getOrderProofs, markStepComplete, saveProof, saveOrderProofs, clearOrderProofs,
  orderMapsUrl, deliveryMapsUrl, pickupMapsUrl, getDeliveryLocation, type ProofType,
} from "@/lib/dash/driver-store";

type CaptureMode = "photo" | "signature";

const PROOF_LABELS: Record<ProofType, string> = {
  signature: "Signature",
  exteriorPhoto: "Address Photo",
};

function formatStepTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function DriverOrderDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const order = getDriverOrder(orderId);
  const [completedSteps, setCompletedSteps] = useState<DeliveryStepKey[]>(DEFAULT_COMPLETED_STEPS);
  const [stepTimestamps, setStepTimestamps] = useState<Partial<Record<DeliveryStepKey, string>>>({});
  const [proofs, setProofs] = useState<Partial<Record<ProofType, string>>>({});
  const [capture, setCapture] = useState<{ mode: CaptureMode; proofType: ProofType } | null>(null);
  const [delivered, setDelivered] = useState(false);

  const loadProofs = useCallback(() => {
    const stored = getOrderProofs(orderId);
    const steps = stored.completedSteps.length > 0 ? stored.completedSteps : DEFAULT_COMPLETED_STEPS;
    setCompletedSteps(steps);
    setStepTimestamps(stored.stepTimestamps);
    setProofs(stored.proofs);
  }, [orderId]);

  useEffect(() => { loadProofs(); }, [loadProofs]);

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">Order not found</p>
        <Link href="/driver-orders" className="text-sm font-semibold text-primary">Back to orders</Link>
      </div>
    );
  }

  const canComplete = DELIVERY_STEPS.every((s) => completedSteps.includes(s.key));

  const handleTapStep = (key: DeliveryStepKey) => {
    if (completedSteps.includes(key)) return;
    const updated = markStepComplete(orderId, key);
    setCompletedSteps(updated.completedSteps);
    setStepTimestamps(updated.stepTimestamps);
  };

  const openCapture = (proofType: ProofType, mode: CaptureMode) => {
    setCapture({ mode, proofType });
  };

  const handleSaveProof = (dataUrl: string) => {
    if (!capture) return;
    const updated = saveProof(orderId, capture.proofType, dataUrl);
    setProofs(updated.proofs);
    setCompletedSteps(updated.completedSteps);
    setStepTimestamps(updated.stepTimestamps);
    setCapture(null);
  };

  const handleRemoveProof = (type: ProofType) => {
    const stored = getOrderProofs(orderId);
    const stepMap: Record<ProofType, DeliveryStepKey> = {
      signature: "signature", exteriorPhoto: "exteriorPhoto",
    };
    const step = stepMap[type];
    stored.proofs = { ...stored.proofs };
    delete stored.proofs[type];
    stored.completedSteps = stored.completedSteps.filter((s) => s !== step);
    stored.stepTimestamps = { ...stored.stepTimestamps };
    delete stored.stepTimestamps[step];
    if (stored.completedSteps.length > 0 || Object.keys(stored.proofs).length > 0) {
      saveOrderProofs(orderId, stored);
    } else {
      clearOrderProofs(orderId);
    }
    setProofs(stored.proofs);
    setStepTimestamps(stored.stepTimestamps);
    setCompletedSteps(stored.completedSteps.length > 0 ? stored.completedSteps : DEFAULT_COMPLETED_STEPS);
  };

  const handleComplete = () => {
    setDelivered(true);
    setTimeout(() => router.push("/driver-dashboard"), 1500);
  };

  const completedCount = DELIVERY_STEPS.filter((s) => completedSteps.includes(s.key)).length;
  const deliveryLocation = getDeliveryLocation(order);
  const navigationUrl = orderMapsUrl(order, completedSteps);

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card p-4">
        <Link href="/driver-dashboard" className="rounded-full p-1.5 hover:bg-secondary"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <div className="text-sm font-bold">{orderId}</div>
        </div>
        <OrderStatusBadge status={delivered ? "Delivered" : order.status} />
      </header>

      <div className="mx-auto max-w-md space-y-4 p-4">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-soft text-orange">
              <Truck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-lg font-bold">{order.customer}</div>
              <div className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <a
                  href={deliveryMapsUrl(order)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary hover:underline"
                >
                  {deliveryLocation}
                </a>
              </div>
              <div className="mt-2 text-sm">ETA <span className="font-semibold">{order.eta}</span></div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={`tel:${order.phone.replace(/\D/g, "")}`} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <Phone className="h-4 w-4" /> Call Customer
            </a>
            <a href={navigationUrl} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-primary text-sm font-semibold text-primary hover:bg-primary/5">
              <MapPin className="h-4 w-4" /> Open Maps
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Package className="h-4 w-4 text-purple" /> Pickup
            </div>
            <a
              href={pickupMapsUrl(order)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <MapPin className="h-3.5 w-3.5" /> Open Maps
            </a>
          </div>
          <div className="mt-2 text-sm">
            <div className="font-semibold">{order.pickupName}</div>
            <div className="text-muted-foreground">{order.pickupAddress}</div>
          </div>
          {order.notes && (
            <>
              <div className="mt-3 text-sm font-bold">Delivery Notes</div>
              <p className="mt-1 text-sm text-muted-foreground">{order.notes}</p>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold">Required Delivery Steps</div>
            <span className="text-xs font-semibold text-primary">{completedCount} of {DELIVERY_STEPS.length}</span>
          </div>
          <ol className="mt-3 space-y-2">
            {DELIVERY_STEPS.map((s) => {
              const done = completedSteps.includes(s.key);
              const timestamp = stepTimestamps[s.key];
              const Icon = s.proofType === "signature" ? PenTool : s.proofType === "photo" ? Camera : null;
              const tapLabel = s.key === "verifyId" ? "Verify" : "Mark Done";
              const TapIcon = s.key === "verifyId" ? IdCard : null;

              return (
                <li
                  key={s.key}
                  className={`rounded-xl border p-3 ${done ? "border-success/30 bg-success-soft/40" : "border-border"}`}
                >
                  <div className="flex items-center gap-3">
                    {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${done ? "text-muted-foreground" : "font-medium"}`}>{s.label}</span>
                      {done && timestamp && (
                        <div className="mt-0.5 text-xs text-success">Completed at {formatStepTime(timestamp)}</div>
                      )}
                    </div>
                    {!done && s.type === "tap" && (
                      <button
                        onClick={() => handleTapStep(s.key)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/40 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
                      >
                        {TapIcon && <TapIcon className="h-3.5 w-3.5" />}
                        {tapLabel}
                      </button>
                    )}
                    {!done && s.type === "proof" && Icon && (
                      <button
                        onClick={() => openCapture(
                          s.key === "signature" ? "signature" : "exteriorPhoto",
                          s.proofType === "signature" ? "signature" : "photo",
                        )}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/40 bg-card px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
                      >
                        <Icon className="h-3.5 w-3.5" /> Capture <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="text-sm font-bold">Proof Capture</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ProofThumbnail
              label="Signature"
              required
              dataUrl={proofs.signature}
              icon={<PenTool className="h-6 w-6" />}
              onCapture={() => openCapture("signature", "signature")}
              onRemove={proofs.signature ? () => handleRemoveProof("signature") : undefined}
            />
            <ProofThumbnail
              label="Exterior"
              required
              dataUrl={proofs.exteriorPhoto}
              icon={<Camera className="h-6 w-6" />}
              onCapture={() => openCapture("exteriorPhoto", "photo")}
              onRemove={proofs.exteriorPhoto ? () => handleRemoveProof("exteriorPhoto") : undefined}
            />
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card p-3">
        <div className="mx-auto max-w-md">
          <button
            disabled={!canComplete || delivered}
            onClick={handleComplete}
            className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-bold ${canComplete && !delivered ? "bg-primary text-primary-foreground hover:bg-primary/90" : "cursor-not-allowed bg-secondary text-muted-foreground"}`}
          >
            <CheckCircle2 className="h-5 w-5" />
            {delivered ? "Delivery Complete!" : "Complete Delivery"}
          </button>
          {!canComplete && !delivered && (
            <div className="mt-1.5 text-center text-[11px] text-muted-foreground">
              Complete all delivery steps to continue
            </div>
          )}
        </div>
      </div>

      {capture && (
        <ProofCaptureSheet
          open
          mode={capture.mode}
          title={PROOF_LABELS[capture.proofType]}
          onClose={() => setCapture(null)}
          onSave={handleSaveProof}
        />
      )}
    </div>
  );
}
