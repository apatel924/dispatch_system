import type { OrderStatus } from "@/lib/types/backend";
import { isApiEnabled } from "@/lib/dash/api/config";
import { resolveStatusAfterStep } from "@/lib/delivery-workflow";
import { postOrderProof, postOrderStatus } from "@/lib/dash/api/driver-client";
import type { DeliveryStepKey, DriverOrder } from "./driver-mock-data";

export type ProofType = "signature" | "exteriorPhoto";

export interface OrderProofs {
  completedSteps: DeliveryStepKey[];
  stepTimestamps: Partial<Record<DeliveryStepKey, string>>;
  proofs: Partial<Record<ProofType, string>>;
}

export interface SaveProofResult {
  proofs: OrderProofs;
  synced: boolean;
  error?: string;
}

function emptyOrderProofs(): OrderProofs {
  return { completedSteps: [], stepTimestamps: {}, proofs: {} };
}

function formatTimestamp(date = new Date()): string {
  return date.toISOString();
}

const STORAGE_KEY = "qre-driver-proofs";

/** Prevents concurrent uploads of the same proof type (double-tap protection). */
const inFlightUploads = new Map<string, Promise<SaveProofResult>>();

const PROOF_UPLOAD_TIMEOUT_MS = 45_000;

function uploadKey(orderId: string, type: ProofType): string {
  return `${orderId}:${type}`;
}

function readAll(): Record<string, OrderProofs> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, OrderProofs>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getOrderProofs(orderId: string): OrderProofs {
  const stored = readAll()[orderId];
  if (!stored) return emptyOrderProofs();
  return { ...emptyOrderProofs(), ...stored, stepTimestamps: stored.stepTimestamps ?? {} };
}

export function saveOrderProofs(orderId: string, data: OrderProofs) {
  const all = readAll();
  all[orderId] = data;
  writeAll(all);
}

export function markStepComplete(orderId: string, step: DeliveryStepKey): OrderProofs {
  const current = getOrderProofs(orderId);
  if (!current.completedSteps.includes(step)) {
    current.completedSteps = [...current.completedSteps, step];
    current.stepTimestamps = { ...current.stepTimestamps, [step]: formatTimestamp() };
    saveOrderProofs(orderId, current);
  }
  return current;
}

export function saveProof(orderId: string, type: ProofType, dataUrl: string): OrderProofs {
  const current = getOrderProofs(orderId);
  current.proofs = { ...current.proofs, [type]: dataUrl };
  const stepMap: Record<ProofType, DeliveryStepKey> = {
    signature: "signature",
    exteriorPhoto: "exteriorPhoto",
  };
  const step = stepMap[type];
  if (!current.completedSteps.includes(step)) {
    current.completedSteps = [...current.completedSteps, step];
    current.stepTimestamps = { ...current.stepTimestamps, [step]: formatTimestamp() };
  }
  saveOrderProofs(orderId, current);
  return current;
}

export function isProofUploadInFlight(orderId: string, type: ProofType): boolean {
  return inFlightUploads.has(uploadKey(orderId, type));
}

export async function markStepCompleteAsync(
  orderId: string,
  step: DeliveryStepKey,
  currentStatus: OrderStatus,
): Promise<OrderProofs> {
  const current = markStepComplete(orderId, step);

  if (!isApiEnabled()) return current;

  try {
    const nextStatus = resolveStatusAfterStep(currentStatus, step, currentStatus);
    await postOrderStatus(orderId, { status: nextStatus, stepKey: step });
  } catch {
    // Keep local state as offline fallback
  }

  return current;
}

async function uploadProofToApi(
  orderId: string,
  type: ProofType,
  dataUrl: string,
): Promise<SaveProofResult> {
  const current = saveProof(orderId, type, dataUrl);

  if (!isApiEnabled()) {
    return { proofs: current, synced: true };
  }

  const stepMap: Record<ProofType, DeliveryStepKey> = {
    signature: "signature",
    exteriorPhoto: "exteriorPhoto",
  };

  try {
    await postOrderProof(
      orderId,
      { type, stepKey: stepMap[type], dataUrl },
      { timeoutMs: PROOF_UPLOAD_TIMEOUT_MS },
    );
    return { proofs: current, synced: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Proof upload failed. Will retry when you reconnect.";
    return { proofs: current, synced: false, error: message };
  }
}

export function saveProofAsync(
  orderId: string,
  type: ProofType,
  dataUrl: string,
): Promise<SaveProofResult> {
  const key = uploadKey(orderId, type);
  const existing = inFlightUploads.get(key);
  if (existing) return existing;

  const task = uploadProofToApi(orderId, type, dataUrl).finally(() => {
    inFlightUploads.delete(key);
  });

  inFlightUploads.set(key, task);
  return task;
}

/** @internal Test helper */
export function resetProofUploadStateForTests(): void {
  inFlightUploads.clear();
}

export async function completeDeliveryAsync(orderId: string): Promise<void> {
  if (!isApiEnabled()) return;

  try {
    await postOrderStatus(orderId, {
      status: "Delivered",
      note: "Delivery completed by driver",
    });
  } catch {
    // UI may still show local completion
  }
}

export function clearOrderProofs(orderId: string) {
  const all = readAll();
  delete all[orderId];
  writeAll(all);
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
