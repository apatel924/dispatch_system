import type { OrderStatus, ProofAsset } from "@/lib/types/backend";
import { isApiEnabled } from "@/lib/dash/api/config";
import { AdminApiError } from "@/lib/dash/api/client";
import {
  requiredProofTypesForDelivery,
  resolveStatusAfterStep,
  stepKeyForProofType,
} from "@/lib/delivery-workflow";
import { postOrderProof, postOrderStatus } from "@/lib/dash/api/driver-client";
import type { DeliveryStepKey, DriverOrder } from "./driver-mock-data";
import {
  clearDriverProofScope,
  clearLocalProofDataUrl,
  clearOrderProofs as clearStoredOrderProofs,
  driverHasUnsyncedProofs,
  emptyOrderProofs,
  getOrderProofs as getStoredOrderProofs,
  pruneExpiredProofsForDriver,
  resetProofStorageForTests,
  saveOrderProofs as saveStoredOrderProofs,
  type OrderProofs,
  type ProofSyncMeta,
  type ProofSyncStatus,
  type ProofType,
} from "@/lib/dash/driver-proof-storage";

export type {
  OrderProofs,
  ProofSyncMeta,
  ProofSyncStatus,
  ProofType,
} from "@/lib/dash/driver-proof-storage";

export {
  LOCAL_PROOF_TTL_MS,
  PROOF_STORAGE_SCHEMA_VERSION,
  PROOF_STORAGE_KEY,
  LEGACY_PROOF_STORAGE_KEY,
  clearDriverProofScope,
  driverHasUnsyncedProofs,
  pruneExpiredProofsForDriver,
  emptyOrderProofs,
} from "@/lib/dash/driver-proof-storage";

export interface SaveProofResult {
  proofs: OrderProofs;
  synced: boolean;
  error?: string;
  errorCode?: string;
}

function formatTimestamp(date = new Date()): string {
  return date.toISOString();
}

/** Prevents concurrent uploads of the same proof type (double-tap protection). */
const inFlightUploads = new Map<string, Promise<SaveProofResult>>();

/** Prevents concurrent Complete Delivery submissions. */
let completeDeliveryInFlight: Promise<void> | null = null;

const PROOF_UPLOAD_TIMEOUT_MS = 45_000;

function uploadKey(driverId: string, orderId: string, type: ProofType): string {
  return `${driverId}:${orderId}:${type}`;
}

export function getOrderProofs(driverId: string, orderId: string): OrderProofs {
  return getStoredOrderProofs(driverId, orderId);
}

export function saveOrderProofs(driverId: string, orderId: string, data: OrderProofs): void {
  saveStoredOrderProofs(driverId, orderId, data);
}

export function markStepComplete(
  driverId: string,
  orderId: string,
  step: DeliveryStepKey,
): OrderProofs {
  const current = getOrderProofs(driverId, orderId);
  if (!current.completedSteps.includes(step)) {
    current.completedSteps = [...current.completedSteps, step];
    current.stepTimestamps = { ...current.stepTimestamps, [step]: formatTimestamp() };
    saveOrderProofs(driverId, orderId, current);
  }
  return current;
}

/**
 * Persist a captured proof locally. When the API is enabled, the related
 * delivery step is only marked complete after a successful sync.
 */
export function saveProof(
  driverId: string,
  orderId: string,
  type: ProofType,
  dataUrl: string,
  options?: {
    markStepComplete?: boolean;
    syncStatus?: ProofSyncStatus;
    error?: string;
    lastRetryAt?: string;
  },
): OrderProofs {
  const current = getOrderProofs(driverId, orderId);
  const prev = current.proofSync[type];
  // Replacing a failed/local capture drops the previous Data URL first.
  current.proofs = { ...current.proofs, [type]: dataUrl };
  const step = stepKeyForProofType(type);
  const markComplete = options?.markStepComplete ?? !isApiEnabled();
  if (markComplete && step && !current.completedSteps.includes(step)) {
    current.completedSteps = [...current.completedSteps, step];
    current.stepTimestamps = { ...current.stepTimestamps, [step]: formatTimestamp() };
  }
  const now = formatTimestamp();
  current.proofSync = {
    ...current.proofSync,
    [type]: {
      syncStatus: options?.syncStatus ?? (markComplete ? "synced" : "captured_locally"),
      error: options?.error,
      serverProofId: options?.syncStatus === "synced" ? prev?.serverProofId : undefined,
      capturedAt: prev?.capturedAt ?? now,
      updatedAt: now,
      lastRetryAt: options?.lastRetryAt,
      syncedAt: options?.syncStatus === "synced" ? now : undefined,
    },
  };
  saveOrderProofs(driverId, orderId, current);
  return current;
}

export function setProofSyncMeta(
  driverId: string,
  orderId: string,
  type: ProofType,
  meta: ProofSyncMeta,
): OrderProofs {
  const current = getOrderProofs(driverId, orderId);
  current.proofSync = {
    ...current.proofSync,
    [type]: { ...meta, updatedAt: formatTimestamp() },
  };
  saveOrderProofs(driverId, orderId, current);
  return current;
}

export function getProofSyncStatus(
  driverId: string,
  orderId: string,
  type: ProofType,
): ProofSyncStatus {
  const meta = getOrderProofs(driverId, orderId).proofSync[type];
  if (meta?.syncStatus) return meta.syncStatus;
  const dataUrl = getOrderProofs(driverId, orderId).proofs[type];
  return dataUrl ? "captured_locally" : "not_captured";
}

export function areRequiredProofsSynced(driverId: string, orderId: string): boolean {
  const current = getOrderProofs(driverId, orderId);
  return requiredProofTypesForDelivery().every((type) => {
    if (type !== "signature" && type !== "exteriorPhoto") return true;
    return current.proofSync[type]?.syncStatus === "synced";
  });
}

export function isAnyProofUploadInFlight(driverId: string, orderId: string): boolean {
  return requiredProofTypesForDelivery().some((type) => {
    if (type !== "signature" && type !== "exteriorPhoto") return false;
    return inFlightUploads.has(uploadKey(driverId, orderId, type));
  });
}

export function isProofUploadInFlight(
  driverId: string,
  orderId: string,
  type: ProofType,
): boolean {
  return inFlightUploads.has(uploadKey(driverId, orderId, type));
}

export async function markStepCompleteAsync(
  driverId: string,
  orderId: string,
  step: DeliveryStepKey,
  currentStatus: OrderStatus,
): Promise<OrderProofs> {
  const current = markStepComplete(driverId, orderId, step);

  if (!isApiEnabled()) return current;

  try {
    const nextStatus = resolveStatusAfterStep(currentStatus, step, currentStatus);
    await postOrderStatus(orderId, { status: nextStatus, stepKey: step });
  } catch {
    // Keep local state as offline fallback
  }

  return current;
}

function clientFacingProofError(err: unknown, type: ProofType): { message: string; code?: string } {
  if (err instanceof AdminApiError) {
    const kept =
      type === "signature"
        ? "Your captured signature has been kept so you can retry."
        : "Your captured photo has been kept so you can retry.";
    const message = err.message.includes("kept so you can retry")
      ? err.message
      : `${err.message.replace(/\.$/, "")}. ${kept}`;
    return { message, code: err.code };
  }
  if (err instanceof Error && err.name === "AbortError") {
    return {
      message:
        type === "signature"
          ? "The signature upload timed out. Your captured signature has been kept so you can retry."
          : "The photo upload timed out. Your captured photo has been kept so you can retry.",
      code: "UPLOAD_TIMEOUT",
    };
  }
  return {
    message:
      type === "signature"
        ? "The signature could not be uploaded. Your captured signature has been kept so you can retry."
        : "The photo could not be uploaded. Your captured photo has been kept so you can retry.",
    code: "UPLOAD_FAILED",
  };
}

async function uploadProofToApi(
  driverId: string,
  orderId: string,
  type: ProofType,
  dataUrl: string,
): Promise<SaveProofResult> {
  const step = stepKeyForProofType(type);
  let current = saveProof(driverId, orderId, type, dataUrl, {
    markStepComplete: false,
    syncStatus: "uploading",
    lastRetryAt: formatTimestamp(),
  });

  if (!isApiEnabled()) {
    current = saveProof(driverId, orderId, type, dataUrl, {
      markStepComplete: true,
      syncStatus: "synced",
    });
    return { proofs: current, synced: true };
  }

  try {
    const { proof } = await postOrderProof(
      orderId,
      { type, stepKey: step!, dataUrl },
      { timeoutMs: PROOF_UPLOAD_TIMEOUT_MS },
    );

    current = getOrderProofs(driverId, orderId);
    if (step && !current.completedSteps.includes(step)) {
      current.completedSteps = [...current.completedSteps, step];
      current.stepTimestamps = { ...current.stepTimestamps, [step]: formatTimestamp() };
    }
    saveOrderProofs(driverId, orderId, current);
    current = clearLocalProofDataUrl(driverId, orderId, type, {
      serverProofId: proof.id,
      syncedAt: formatTimestamp(),
    });
    pruneExpiredProofsForDriver(driverId);
    return { proofs: current, synced: true };
  } catch (err) {
    const { message, code } = clientFacingProofError(err, type);
    current = saveProof(driverId, orderId, type, dataUrl, {
      markStepComplete: false,
      syncStatus: "failed",
      error: message,
      lastRetryAt: formatTimestamp(),
    });
    return { proofs: current, synced: false, error: message, errorCode: code };
  }
}

export function saveProofAsync(
  driverId: string,
  orderId: string,
  type: ProofType,
  dataUrl: string,
): Promise<SaveProofResult> {
  const key = uploadKey(driverId, orderId, type);
  const existing = inFlightUploads.get(key);
  if (existing) return existing;

  const task = uploadProofToApi(driverId, orderId, type, dataUrl).finally(() => {
    inFlightUploads.delete(key);
  });

  inFlightUploads.set(key, task);
  return task;
}

/** @internal Test helper */
export function resetProofUploadStateForTests(): void {
  inFlightUploads.clear();
  completeDeliveryInFlight = null;
  resetProofStorageForTests();
}

export async function completeDeliveryAsync(
  driverId: string,
  orderId: string,
): Promise<void> {
  if (!isApiEnabled()) return;

  if (completeDeliveryInFlight) {
    return completeDeliveryInFlight;
  }

  if (isAnyProofUploadInFlight(driverId, orderId)) {
    throw new Error("Wait for proof uploads to finish before completing delivery.");
  }

  if (!areRequiredProofsSynced(driverId, orderId)) {
    throw new Error("Upload all required proofs before completing delivery.");
  }

  const task = (async () => {
    try {
      await postOrderStatus(orderId, {
        status: "Delivered",
        note: "Delivery completed by driver",
      });
    } catch (err) {
      if (err instanceof AdminApiError) throw err;
      throw new Error(
        err instanceof Error ? err.message : "Could not complete delivery. Please try again.",
      );
    }
  })().finally(() => {
    completeDeliveryInFlight = null;
  });

  completeDeliveryInFlight = task;
  return task;
}

export function clearOrderProofs(driverId: string, orderId: string): void {
  clearStoredOrderProofs(driverId, orderId);
}

function proofSyncMateriallyEqual(
  a: ProofSyncMeta | undefined,
  b: ProofSyncMeta | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.syncStatus === b.syncStatus &&
    a.serverProofId === b.serverProofId &&
    a.error === b.error &&
    a.syncedAt === b.syncedAt &&
    a.capturedAt === b.capturedAt
  );
}

function orderProofsMateriallyEqual(a: OrderProofs, b: OrderProofs): boolean {
  if (a.completedSteps.length !== b.completedSteps.length) return false;
  if (a.completedSteps.some((step, i) => step !== b.completedSteps[i])) return false;

  const stepKeys = new Set([
    ...Object.keys(a.stepTimestamps),
    ...Object.keys(b.stepTimestamps),
  ]);
  for (const key of stepKeys) {
    const k = key as DeliveryStepKey;
    if (a.stepTimestamps[k] !== b.stepTimestamps[k]) return false;
  }

  const proofTypes = new Set([
    ...Object.keys(a.proofs),
    ...Object.keys(b.proofs),
    ...Object.keys(a.proofSync),
    ...Object.keys(b.proofSync),
  ]) as Set<ProofType>;
  for (const type of proofTypes) {
    if (!proofPreviewEqual(a.proofs[type], b.proofs[type])) return false;
    if (!proofSyncMateriallyEqual(a.proofSync[type], b.proofSync[type])) return false;
  }
  return true;
}

/** Compare previews without stringifying large Data URLs every time. */
export function proofPreviewEqual(
  a: string | undefined,
  b: string | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  // Data URLs: length + prefix is enough to detect change without full scan.
  if (a.startsWith("data:") || b.startsWith("data:")) {
    return a.slice(0, 64) === b.slice(0, 64);
  }
  return a === b;
}

export function completedStepsEqual(
  a: DeliveryStepKey[],
  b: DeliveryStepKey[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((step, i) => step === b[i]);
}

export function stepTimestampsEqual(
  a: Partial<Record<DeliveryStepKey, string>>,
  b: Partial<Record<DeliveryStepKey, string>>,
): boolean {
  if (a === b) return true;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const k = key as DeliveryStepKey;
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export function proofRecordEqual(
  a: Partial<Record<ProofType, string>>,
  b: Partial<Record<ProofType, string>>,
): boolean {
  if (a === b) return true;
  const keys = new Set([
    ...Object.keys(a),
    ...Object.keys(b),
  ]) as Set<ProofType>;
  for (const type of keys) {
    if (!proofPreviewEqual(a[type], b[type])) return false;
  }
  return true;
}

export function proofSyncRecordEqual(
  a: Partial<Record<ProofType, ProofSyncMeta>>,
  b: Partial<Record<ProofType, ProofSyncMeta>>,
): boolean {
  if (a === b) return true;
  const keys = new Set([
    ...Object.keys(a),
    ...Object.keys(b),
  ]) as Set<ProofType>;
  for (const type of keys) {
    if (!proofSyncMateriallyEqual(a[type], b[type])) return false;
  }
  return true;
}

export function proofUploadErrorsEqual(
  a: Partial<Record<ProofType, string>>,
  b: Partial<Record<ProofType, string>>,
): boolean {
  if (a === b) return true;
  const keys = new Set([
    ...Object.keys(a),
    ...Object.keys(b),
  ]) as Set<ProofType>;
  for (const type of keys) {
    if (a[type] !== b[type]) return false;
  }
  return true;
}

/**
 * Reconcile local proof state with server proofs for this driver + order.
 * Server truth wins: synced server proofs clear local Data URLs;
 * local "synced" without a server proof is downgraded.
 * Persists only when material proof state changes (skips updatedAt-only churn).
 */
export function reconcileLocalProofsWithServer(
  driverId: string,
  orderId: string,
  apiProofs: ProofAsset[],
): OrderProofs {
  const stored = getOrderProofs(driverId, orderId);
  const serverByType = new Map<ProofType, ProofAsset>();
  for (const proof of apiProofs) {
    if (proof.type !== "signature" && proof.type !== "exteriorPhoto") continue;
    if (!proof.storagePath && !proof.downloadUrl) continue;
    serverByType.set(proof.type, proof);
  }

  const next: OrderProofs = {
    ...stored,
    proofs: { ...stored.proofs },
    proofSync: { ...stored.proofSync },
    completedSteps: [...stored.completedSteps],
    stepTimestamps: { ...stored.stepTimestamps },
  };

  for (const type of requiredProofTypesForDelivery()) {
    if (type !== "signature" && type !== "exteriorPhoto") continue;
    const server = serverByType.get(type);
    const step = stepKeyForProofType(type);

    if (server) {
      delete next.proofs[type];
      const prevMeta = next.proofSync[type];
      const alreadySynced =
        prevMeta?.syncStatus === "synced" && prevMeta.serverProofId === server.id;
      next.proofSync[type] = {
        syncStatus: "synced",
        serverProofId: server.id,
        syncedAt: alreadySynced
          ? (prevMeta.syncedAt ?? server.uploadedAt ?? formatTimestamp())
          : (server.uploadedAt ?? formatTimestamp()),
        updatedAt: alreadySynced
          ? (prevMeta.updatedAt ?? formatTimestamp())
          : formatTimestamp(),
        capturedAt: prevMeta?.capturedAt,
      };
      if (step && !next.completedSteps.includes(step)) {
        next.completedSteps.push(step);
        next.stepTimestamps[step] = server.uploadedAt ?? formatTimestamp();
      }
      continue;
    }

    const local = next.proofSync[type];
    if (local?.syncStatus === "synced") {
      // Do not trust local synced without a server proof.
      if (next.proofs[type]) {
        next.proofSync[type] = {
          syncStatus: "failed",
          error: "Server does not have this proof. Please retry upload.",
          updatedAt: formatTimestamp(),
          capturedAt: local.capturedAt,
        };
      } else {
        next.proofSync[type] = {
          syncStatus: "not_captured",
          updatedAt: formatTimestamp(),
        };
        if (step) {
          next.completedSteps = next.completedSteps.filter((s) => s !== step);
          delete next.stepTimestamps[step];
        }
      }
    }
  }

  if (!orderProofsMateriallyEqual(stored, next)) {
    saveOrderProofs(driverId, orderId, next);
  }
  pruneExpiredProofsForDriver(driverId);
  return orderProofsMateriallyEqual(stored, next) ? stored : next;
}

/**
 * Logout helper. Returns whether the caller must confirm before clearing.
 * Prefer deleting local proof data after confirmation (shared-device safe).
 */
export function prepareDriverProofLogout(driverId: string): {
  hasUnsynced: boolean;
  clear: () => void;
} {
  const hasUnsynced = driverHasUnsyncedProofs(driverId);
  return {
    hasUnsynced,
    clear: () => clearDriverProofScope(driverId),
  };
}

export function getDeliveryLocation(order: Pick<DriverOrder, "address" | "unit">): string {
  return [order.address, order.unit].filter(Boolean).join(", ");
}

export function getPickupLocation(order: Pick<DriverOrder, "pickupName" | "pickupAddress">): string {
  return `${order.pickupName}, ${order.pickupAddress}`;
}

function isHeadingToPickup(order: DriverOrder, completedSteps: DeliveryStepKey[] = []): boolean {
  if (completedSteps.includes("pickedUp")) return false;
  if (order.status === "Out for Delivery") return false;
  return true;
}

export function getOrderNavigationLocation(order: DriverOrder, completedSteps: DeliveryStepKey[] = []): string {
  return isHeadingToPickup(order, completedSteps)
    ? getPickupLocation(order)
    : getDeliveryLocation(order);
}

export function mapsUrl(location: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`;
}

export function orderMapsUrl(order: DriverOrder, completedSteps: DeliveryStepKey[] = []): string {
  return mapsUrl(getOrderNavigationLocation(order, completedSteps));
}

export function deliveryMapsUrl(order: Pick<DriverOrder, "address" | "unit">): string {
  return mapsUrl(getDeliveryLocation(order));
}

export function pickupMapsUrl(order: Pick<DriverOrder, "pickupName" | "pickupAddress">): string {
  return mapsUrl(getPickupLocation(order));
}
