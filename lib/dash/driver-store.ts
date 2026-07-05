import type { DeliveryStepKey } from "./driver-mock-data";

export type ProofType = "id" | "signature" | "dropoffPhoto" | "exteriorPhoto";

export interface OrderProofs {
  completedSteps: DeliveryStepKey[];
  proofs: Partial<Record<ProofType, string>>;
}

const STORAGE_KEY = "qre-driver-proofs";

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
  return readAll()[orderId] ?? { completedSteps: [], proofs: {} };
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
    saveOrderProofs(orderId, current);
  }
  return current;
}

export function saveProof(orderId: string, type: ProofType, dataUrl: string): OrderProofs {
  const current = getOrderProofs(orderId);
  current.proofs = { ...current.proofs, [type]: dataUrl };
  const stepMap: Record<ProofType, DeliveryStepKey> = {
    id: "verifyId",
    signature: "signature",
    dropoffPhoto: "dropoffPhoto",
    exteriorPhoto: "exteriorPhoto",
  };
  if (!current.completedSteps.includes(stepMap[type])) {
    current.completedSteps = [...current.completedSteps, stepMap[type]];
  }
  saveOrderProofs(orderId, current);
  return current;
}

export function clearOrderProofs(orderId: string) {
  const all = readAll();
  delete all[orderId];
  writeAll(all);
}

export function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
