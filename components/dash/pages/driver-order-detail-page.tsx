'use client'

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Phone, MapPin, Package, PenTool, Camera, IdCard,
  CheckCircle2, Circle, Truck, ChevronRight, Inbox, ClipboardList,
} from "lucide-react";
import { OrderStatusBadge } from "@/components/dash/status-badge";
import { DriverConsumerInstructionsSection } from "@/components/dash/driver-consumer-instructions";
import { ProofCaptureSheet, ProofThumbnail } from "@/components/dash/driver/proof-capture";
import {
  DELIVERY_STEPS, DEFAULT_COMPLETED_STEPS, type DeliveryStepKey,
} from "@/lib/dash/driver-mock-data";
import {
  mergeCompletedSteps,
} from "@/lib/dash/api/driver-adapters";
import {
  completedStepsIdentityKey,
  serverProofIdentityKey,
  useDriverOrder,
} from "@/lib/dash/hooks/use-driver-order";
import { useDriverSession } from "@/lib/dash/hooks/use-driver-session";
import { OrderDetailSkeleton } from "@/components/dash/ui/skeletons";
import { acknowledgeConsumerNoteApi } from "@/lib/dash/api/client";
import { isApiEnabled } from "@/lib/dash/api/config";
import {
  REQUIRED_PROOF_UPLOADS,
  proofTypeForStepKey,
  requiredProofStepKeysForDelivery,
  requiredProofTypesForDelivery,
  stepKeyForProofType,
} from "@/lib/delivery-workflow";
import {
  getOrderProofs,
  markStepCompleteAsync,
  saveProofAsync,
  saveOrderProofs,
  clearOrderProofs,
  completeDeliveryAsync,
  reconcileLocalProofsWithServer,
  orderMapsUrl,
  deliveryMapsUrl,
  pickupMapsUrl,
  getDeliveryLocation,
  areRequiredProofsSynced,
  isAnyProofUploadInFlight,
  completedStepsEqual,
  stepTimestampsEqual,
  proofRecordEqual,
  proofSyncRecordEqual,
  proofUploadErrorsEqual,
  type ProofType,
  type ProofSyncMeta,
  type ProofSyncStatus,
} from "@/lib/dash/driver-store";

type CaptureMode = "photo" | "signature";

function formatStepTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function isDriverProofType(type: string): type is ProofType {
  return type === "signature" || type === "exteriorPhoto";
}

export function DriverOrderDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { driver } = useDriverSession();
  const driverId = driver?.id ?? "";
  const {
    order,
    completedSteps: apiCompletedSteps,
    proofs: apiProofs,
    statusEvents,
    consumerNotes,
    source,
    loading,
    refresh,
  } = useDriverOrder(orderId);
  const [completedSteps, setCompletedSteps] = useState<DeliveryStepKey[]>(DEFAULT_COMPLETED_STEPS);
  const [stepTimestamps, setStepTimestamps] = useState<Partial<Record<DeliveryStepKey, string>>>({});
  const [proofs, setProofs] = useState<Partial<Record<ProofType, string>>>({});
  const [proofSync, setProofSync] = useState<Partial<Record<ProofType, ProofSyncMeta>>>({});
  const [capture, setCapture] = useState<{ mode: CaptureMode; proofType: ProofType } | null>(null);
  const [delivered, setDelivered] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState<ProofType | null>(null);
  const [proofUploadErrors, setProofUploadErrors] = useState<Partial<Record<ProofType, string>>>({});
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const serverProofKey = useMemo(
    () => serverProofIdentityKey(apiProofs),
    [apiProofs],
  );
  const apiStepsKey = useMemo(
    () => completedStepsIdentityKey(apiCompletedSteps),
    [apiCompletedSteps],
  );

  const apiProofsRef = useRef(apiProofs);
  const apiCompletedStepsRef = useRef(apiCompletedSteps);
  apiProofsRef.current = apiProofs;
  apiCompletedStepsRef.current = apiCompletedSteps;

  // Hydrate / reconcile from stable server identity — not poll signed-URL churn.
  useEffect(() => {
    if (!driverId) return;

    const serverProofs = apiProofsRef.current;
    const serverSteps = apiCompletedStepsRef.current;

    const reconciled =
      source === "api"
        ? reconcileLocalProofsWithServer(driverId, orderId, serverProofs)
        : getOrderProofs(driverId, orderId);

    const previewUrls: Partial<Record<ProofType, string>> = { ...reconciled.proofs };
    for (const proof of serverProofs) {
      if (!isDriverProofType(proof.type)) continue;
      if (reconciled.proofSync[proof.type]?.syncStatus === "synced" && proof.downloadUrl) {
        previewUrls[proof.type] = proof.downloadUrl;
      } else if (!previewUrls[proof.type] && proof.downloadUrl) {
        previewUrls[proof.type] = proof.downloadUrl;
      }
    }

    let steps = reconciled.completedSteps.filter((step) => {
      const proofType = stepKeyForProofTypeLookup(step);
      if (!proofType) return true;
      return reconciled.proofSync[proofType]?.syncStatus === "synced";
    });

    if (source === "api" && serverSteps.length > 0) {
      const apiOnly = serverSteps.filter((step) => {
        const proofType = stepKeyForProofTypeLookup(step);
        if (!proofType) return true;
        return reconciled.proofSync[proofType]?.syncStatus === "synced";
      });
      steps = mergeCompletedSteps(apiOnly, steps);
    }
    if (steps.length === 0) steps = DEFAULT_COMPLETED_STEPS;

    const nextErrors: Partial<Record<ProofType, string>> = {};
    for (const type of requiredProofTypesForDelivery()) {
      if (!isDriverProofType(type)) continue;
      const meta = reconciled.proofSync[type];
      if (meta?.syncStatus === "synced") continue;
      if (meta?.error) nextErrors[type] = meta.error;
    }

    setCompletedSteps((prev) => (completedStepsEqual(prev, steps) ? prev : steps));
    setStepTimestamps((prev) =>
      stepTimestampsEqual(prev, reconciled.stepTimestamps) ? prev : reconciled.stepTimestamps,
    );
    setProofs((prev) => (proofRecordEqual(prev, previewUrls) ? prev : previewUrls));
    setProofSync((prev) =>
      proofSyncRecordEqual(prev, reconciled.proofSync) ? prev : reconciled.proofSync,
    );
    setProofUploadErrors((prev) =>
      proofUploadErrorsEqual(prev, nextErrors) ? prev : nextErrors,
    );
  }, [driverId, orderId, source, serverProofKey, apiStepsKey]);

  // Refresh signed preview URLs for already-synced proofs without re-reconciling.
  useEffect(() => {
    setProofs((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const proof of apiProofs) {
        if (!isDriverProofType(proof.type)) continue;
        if (proofSync[proof.type]?.syncStatus !== "synced") continue;
        if (!proof.downloadUrl) continue;
        if (next[proof.type] === proof.downloadUrl) continue;
        if (next[proof.type]?.startsWith("data:")) continue;
        next[proof.type] = proof.downloadUrl;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [apiProofs, proofSync]);

  if (loading && !order) {
    return (
      <div className="mx-auto min-h-screen max-w-md p-4">
        <OrderDetailSkeleton />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">Order not found</p>
        <Link href="/driver-orders" className="text-sm font-semibold text-primary">Back to orders</Link>
      </div>
    );
  }

  const proofsSynced =
    !isApiEnabled() ||
    (areRequiredProofsSynced(driverId, orderId) &&
      requiredProofStepKeysForDelivery().every((step) => completedSteps.includes(step)));
  const proofUploading = uploadingProof !== null || isAnyProofUploadInFlight(driverId, orderId);
  const tapAndProofStepsDone = DELIVERY_STEPS.every((s) => {
    if (s.type === "proof") {
      const type = s.key === "signature" ? "signature" : "exteriorPhoto";
      return proofSync[type]?.syncStatus === "synced" || (!isApiEnabled() && completedSteps.includes(s.key));
    }
    return completedSteps.includes(s.key);
  });
  const canComplete = tapAndProofStepsDone && proofsSynced && !proofUploading && !completing;

  const handleAcknowledge = async (noteId: string) => {
    if (!isApiEnabled()) return;
    setAcknowledgingId(noteId);
    try {
      await acknowledgeConsumerNoteApi(orderId, noteId);
      await refresh({ silent: true });
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handleTapStep = async (key: DeliveryStepKey) => {
    if (completedSteps.includes(key) || !order || proofUploading || completing) return;
    setSyncing(true);
    try {
      const updated = await markStepCompleteAsync(driverId, orderId, key, order.status);
      setCompletedSteps(updated.completedSteps);
      setStepTimestamps(updated.stepTimestamps);
      await refresh({ silent: true });
    } finally {
      setSyncing(false);
    }
  };

  const openCapture = (proofType: ProofType, mode: CaptureMode) => {
    if (proofUploading || completing) return;
    setCapture({ mode, proofType });
  };

  const handleSaveProof = async (dataUrl: string) => {
    if (!capture) return;
    const { proofType } = capture;
    setCapture(null);
    setUploadingProof(proofType);
    setCompleteError(null);
    setProofUploadErrors((prev) => {
      const next = { ...prev };
      delete next[proofType];
      return next;
    });
    setSyncing(true);
    try {
      const result = await saveProofAsync(driverId, orderId, proofType, dataUrl);
      setProofs(result.proofs.proofs);
      setProofSync(result.proofs.proofSync);
      setCompletedSteps(result.proofs.completedSteps);
      setStepTimestamps(result.proofs.stepTimestamps);
      if (!result.synced && result.error) {
        setProofUploadErrors((prev) => ({ ...prev, [proofType]: result.error }));
      } else {
        await refresh({ silent: true });
      }
    } finally {
      setUploadingProof(null);
      setSyncing(false);
    }
  };

  const handleRetryProofUpload = async (type: ProofType) => {
    const dataUrl = proofs[type] ?? getOrderProofs(driverId, orderId).proofs[type];
    if (!dataUrl || proofUploading || completing) return;
    setUploadingProof(type);
    setCompleteError(null);
    setProofUploadErrors((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
    setSyncing(true);
    try {
      const result = await saveProofAsync(driverId, orderId, type, dataUrl);
      setProofs(result.proofs.proofs);
      setProofSync(result.proofs.proofSync);
      setCompletedSteps(result.proofs.completedSteps);
      setStepTimestamps(result.proofs.stepTimestamps);
      if (!result.synced && result.error) {
        setProofUploadErrors((prev) => ({ ...prev, [type]: result.error }));
      } else {
        await refresh({ silent: true });
      }
    } finally {
      setUploadingProof(null);
      setSyncing(false);
    }
  };

  const handleRemoveProof = (type: ProofType) => {
    if (proofUploading || completing) return;
    const stored = getOrderProofs(driverId, orderId);
    const step = stepKeyForProofType(type);
    stored.proofs = { ...stored.proofs };
    delete stored.proofs[type];
    stored.proofSync = { ...stored.proofSync };
    delete stored.proofSync[type];
    if (step) {
      stored.completedSteps = stored.completedSteps.filter((s) => s !== step);
      stored.stepTimestamps = { ...stored.stepTimestamps };
      delete stored.stepTimestamps[step];
    }
    if (stored.completedSteps.length > 0 || Object.keys(stored.proofs).length > 0) {
      saveOrderProofs(driverId, orderId, stored);
    } else {
      clearOrderProofs(driverId, orderId);
    }
    setProofs(stored.proofs);
    setProofSync(stored.proofSync);
    setStepTimestamps(stored.stepTimestamps);
    setCompletedSteps(stored.completedSteps.length > 0 ? stored.completedSteps : DEFAULT_COMPLETED_STEPS);
    setProofUploadErrors((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  };

  const handleComplete = async () => {
    if (!canComplete || delivered || completing) return;
    setCompleting(true);
    setCompleteError(null);
    setSyncing(true);
    try {
      await completeDeliveryAsync(driverId, orderId);
      await refresh({ silent: true });
      setDelivered(true);
      setTimeout(() => router.push("/driver-dashboard"), 1500);
    } catch (err) {
      setCompleteError(
        err instanceof Error ? err.message : "Could not complete delivery. Please try again.",
      );
    } finally {
      setCompleting(false);
      setSyncing(false);
    }
  };

  const completedCount = DELIVERY_STEPS.filter((s) => {
    if (s.type === "proof") {
      const type = s.key === "signature" ? "signature" : "exteriorPhoto";
      return proofSync[type]?.syncStatus === "synced";
    }
    return completedSteps.includes(s.key);
  }).length;
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
              {(order.receivedAt || order.assignedAt) && (
                <div className="mt-3 space-y-1.5 rounded-xl bg-secondary/50 px-3 py-2 text-xs">
                  {order.receivedAt && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Inbox className="h-3.5 w-3.5 shrink-0" />
                      <span>Order received <span className="font-medium text-foreground">{order.receivedAt}</span></span>
                    </div>
                  )}
                  {order.assignedAt && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                      <span>Assigned to you <span className="font-medium text-foreground">{order.assignedAt}</span></span>
                    </div>
                  )}
                </div>
              )}
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

        <DriverConsumerInstructionsSection
          notes={consumerNotes}
          status={order.status}
          statusEvents={statusEvents}
          onAcknowledge={isApiEnabled() && source === "api" ? handleAcknowledge : undefined}
          acknowledgingId={acknowledgingId}
        />

        {order.deliveryInstructions && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="text-sm font-bold">Special Instructions (On File)</div>
            <p className="mt-2 text-sm text-muted-foreground">{order.deliveryInstructions}</p>
          </section>
        )}

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
              <div className="mt-3 text-sm font-bold">Internal Admin Notes</div>
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
              const proofTypeForStep: ProofType | null =
                s.key === "signature" ? "signature" : s.key === "exteriorPhoto" ? "exteriorPhoto" : null;
              const done = proofTypeForStep
                ? proofSync[proofTypeForStep]?.syncStatus === "synced"
                : completedSteps.includes(s.key);
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
                      {!done && proofTypeForStep && proofSync[proofTypeForStep]?.syncStatus === "failed" && (
                        <div className="mt-0.5 text-xs text-destructive">Upload required</div>
                      )}
                    </div>
                    {!done && s.type === "tap" && (
                      <button
                        type="button"
                        disabled={proofUploading || completing}
                        onClick={() => handleTapStep(s.key)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/40 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                      >
                        {TapIcon && <TapIcon className="h-3.5 w-3.5" />}
                        {tapLabel}
                      </button>
                    )}
                    {!done && s.type === "proof" && Icon && (
                      <button
                        type="button"
                        disabled={proofUploading || completing}
                        onClick={() => openCapture(
                          s.key === "signature" ? "signature" : "exteriorPhoto",
                          s.proofType === "signature" ? "signature" : "photo",
                        )}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/40 bg-card px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
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
            {REQUIRED_PROOF_UPLOADS.map((proofDef) => {
              const type = proofDef.proofType;
              const Icon = type === "signature" ? PenTool : Camera;
              return (
                <ProofThumbnail
                  key={type}
                  label={proofDef.cardLabel}
                  required={proofDef.required}
                  dataUrl={proofs[type]}
                  syncStatus={proofSyncStatus(proofSync[type], uploadingProof === type)}
                  icon={<Icon className="h-6 w-6" />}
                  onCapture={() => openCapture(type, proofDef.captureMode)}
                  onRemove={
                    proofs[type] && uploadingProof !== type && !completing
                      ? () => handleRemoveProof(type)
                      : undefined
                  }
                  uploading={uploadingProof === type}
                  uploadError={proofUploadErrors[type]}
                  disabled={proofUploading || completing}
                  onRetry={
                    proofUploadErrors[type] && proofs[type]
                      ? () => void handleRetryProofUpload(type)
                      : undefined
                  }
                />
              );
            })}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card p-3">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            disabled={!canComplete || delivered}
            onClick={() => void handleComplete()}
            className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-bold ${canComplete && !delivered ? "bg-primary text-primary-foreground hover:bg-primary/90" : "cursor-not-allowed bg-secondary text-muted-foreground"}`}
          >
            <CheckCircle2 className="h-5 w-5" />
            {delivered
              ? "Delivery Complete!"
              : completing || syncing
                ? "Saving…"
                : "Complete Delivery"}
          </button>
          {completeError && (
            <div className="mt-1.5 text-center text-[11px] text-destructive" role="alert">
              {completeError}
            </div>
          )}
          {!canComplete && !delivered && !completeError && (
            <div className="mt-1.5 text-center text-[11px] text-muted-foreground">
              {proofUploading
                ? "Wait for proof uploads to finish"
                : "Complete all steps and sync required proofs to continue"}
            </div>
          )}
        </div>
      </div>

      {capture && (
        <ProofCaptureSheet
          open
          mode={capture.mode}
          title={
            REQUIRED_PROOF_UPLOADS.find((p) => p.proofType === capture.proofType)?.cardLabel ??
            capture.proofType
          }
          onClose={() => !uploadingProof && setCapture(null)}
          onSave={handleSaveProof}
          saving={uploadingProof === capture.proofType}
        />
      )}
    </div>
  );
}

function stepKeyForProofTypeLookup(step: DeliveryStepKey): ProofType | null {
  const type = proofTypeForStepKey(step);
  return type && isDriverProofType(type) ? type : null;
}

function proofSyncStatus(
  meta: ProofSyncMeta | undefined,
  uploading: boolean,
): ProofSyncStatus | undefined {
  if (uploading) return "uploading";
  return meta?.syncStatus;
}
