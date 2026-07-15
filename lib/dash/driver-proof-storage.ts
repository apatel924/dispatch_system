/**
 * Driver-scoped local proof persistence (browser localStorage).
 *
 * Schema v2 nests orders under authenticated driver IDs.
 * Legacy unscoped `qre-driver-proofs` data is discarded — never exposed.
 */

import type { DeliveryStepKey } from "@/lib/dash/driver-mock-data";

export type ProofType = "signature" | "exteriorPhoto";

export type ProofSyncStatus =
  | "not_captured"
  | "captured_locally"
  | "preparing"
  | "uploading"
  | "synced"
  | "failed";

export interface ProofSyncMeta {
  syncStatus: ProofSyncStatus;
  error?: string;
  serverProofId?: string;
  /** Synced-at ISO timestamp (metadata only). */
  syncedAt?: string;
  capturedAt?: string;
  updatedAt?: string;
  lastRetryAt?: string;
}

export interface OrderProofs {
  completedSteps: DeliveryStepKey[];
  stepTimestamps: Partial<Record<DeliveryStepKey, string>>;
  /** Local Data URLs — only for unsynced / failed / uploading proofs. Cleared after sync. */
  proofs: Partial<Record<ProofType, string>>;
  proofSync: Partial<Record<ProofType, ProofSyncMeta>>;
  capturedAt?: string;
  updatedAt?: string;
}

export const PROOF_STORAGE_SCHEMA_VERSION = 2 as const;

/** Legacy global key — never migrate ownership; discard safely. */
export const LEGACY_PROOF_STORAGE_KEY = "qre-driver-proofs";

/** Versioned driver-scoped store. */
export const PROOF_STORAGE_KEY = "qre-driver-proofs-v2";

/**
 * Abandoned unsynced proofs TTL: 48 hours.
 * Long enough for overnight / next-shift retry; short enough to limit PII exposure on shared devices.
 */
export const LOCAL_PROOF_TTL_MS = 48 * 60 * 60 * 1000;

interface ProofStorageRoot {
  version: typeof PROOF_STORAGE_SCHEMA_VERSION;
  drivers: Record<string, Record<string, OrderProofs>>;
}

export function emptyOrderProofs(): OrderProofs {
  return { completedSteps: [], stepTimestamps: {}, proofs: {}, proofSync: {} };
}

function nowIso(date = new Date()): string {
  return date.toISOString();
}

function emptyRoot(): ProofStorageRoot {
  return { version: PROOF_STORAGE_SCHEMA_VERSION, drivers: {} };
}

function discardLegacyUnscopedProofs(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(LEGACY_PROOF_STORAGE_KEY) != null) {
      localStorage.removeItem(LEGACY_PROOF_STORAGE_KEY);
      if (process.env.NODE_ENV === "development") {
        console.info("[proof-storage] discarded legacy unscoped proof store");
      }
    }
  } catch {
    // ignore storage errors
  }
}

function readRoot(): ProofStorageRoot {
  if (typeof window === "undefined") return emptyRoot();
  discardLegacyUnscopedProofs();
  try {
    const raw = localStorage.getItem(PROOF_STORAGE_KEY);
    if (!raw) return emptyRoot();
    const parsed = JSON.parse(raw) as Partial<ProofStorageRoot>;
    if (parsed.version !== PROOF_STORAGE_SCHEMA_VERSION || !parsed.drivers) {
      return emptyRoot();
    }
    return { version: PROOF_STORAGE_SCHEMA_VERSION, drivers: parsed.drivers };
  } catch {
    return emptyRoot();
  }
}

function writeRoot(root: ProofStorageRoot): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    PROOF_STORAGE_KEY,
    JSON.stringify({ version: PROOF_STORAGE_SCHEMA_VERSION, drivers: root.drivers }),
  );
}

export function normalizeOrderProofs(stored: Partial<OrderProofs> | undefined): OrderProofs {
  const base = emptyOrderProofs();
  if (!stored) return base;
  return {
    completedSteps: stored.completedSteps ?? [],
    stepTimestamps: stored.stepTimestamps ?? {},
    proofs: stored.proofs ?? {},
    proofSync: stored.proofSync ?? {},
    capturedAt: stored.capturedAt,
    updatedAt: stored.updatedAt,
  };
}

function assertDriverId(driverId: string | null | undefined): string {
  if (!driverId || !driverId.trim()) {
    throw new Error("Authenticated driver ID is required for proof persistence");
  }
  return driverId.trim();
}

function isExpiredMeta(meta: ProofSyncMeta | undefined, nowMs: number): boolean {
  if (!meta) return false;
  if (meta.syncStatus === "synced") return false;
  if (meta.syncStatus === "uploading" || meta.syncStatus === "preparing") return false;
  const anchor = meta.updatedAt ?? meta.capturedAt ?? meta.lastRetryAt;
  if (!anchor) return false;
  const t = Date.parse(anchor);
  if (!Number.isFinite(t)) return false;
  return nowMs - t > LOCAL_PROOF_TTL_MS;
}

/**
 * Remove expired unsynced Data URLs for one driver. Skips actively uploading proofs.
 * Returns count of order records that had content pruned.
 */
export function pruneExpiredProofsForDriver(
  driverId: string,
  now = new Date(),
): { prunedOrders: number } {
  const id = assertDriverId(driverId);
  const root = readRoot();
  const orders = root.drivers[id];
  if (!orders) return { prunedOrders: 0 };

  const nowMs = now.getTime();
  let prunedOrders = 0;

  for (const [orderId, raw] of Object.entries(orders)) {
    const order = normalizeOrderProofs(raw);
    let changed = false;
    for (const type of Object.keys(order.proofSync) as ProofType[]) {
      const meta = order.proofSync[type];
      if (!isExpiredMeta(meta, nowMs)) continue;
      if (order.proofs[type]) {
        delete order.proofs[type];
        changed = true;
      }
      order.proofSync[type] = {
        syncStatus: "not_captured",
        capturedAt: undefined,
        updatedAt: nowIso(now),
      };
      const step = type === "signature" ? "signature" : "exteriorPhoto";
      order.completedSteps = order.completedSteps.filter((s) => s !== step);
      delete order.stepTimestamps[step];
      changed = true;
    }
    if (changed) {
      prunedOrders += 1;
      const hasAnything =
        order.completedSteps.length > 0 ||
        Object.keys(order.proofs).length > 0 ||
        Object.values(order.proofSync).some(
          (m) => m && m.syncStatus !== "not_captured",
        );
      if (hasAnything) orders[orderId] = order;
      else delete orders[orderId];
    }
  }

  root.drivers[id] = orders;
  writeRoot(root);

  if (prunedOrders > 0 && process.env.NODE_ENV === "development") {
    console.info("[proof-storage] pruned expired local proofs", { prunedOrders });
  }

  return { prunedOrders };
}

export function getOrderProofs(driverId: string, orderId: string): OrderProofs {
  const id = assertDriverId(driverId);
  pruneExpiredProofsForDriver(id);
  const root = readRoot();
  return normalizeOrderProofs(root.drivers[id]?.[orderId]);
}

export function saveOrderProofs(driverId: string, orderId: string, data: OrderProofs): void {
  const id = assertDriverId(driverId);
  pruneExpiredProofsForDriver(id);
  const root = readRoot();
  if (!root.drivers[id]) root.drivers[id] = {};
  const normalized = normalizeOrderProofs(data);
  normalized.updatedAt = nowIso();
  if (!normalized.capturedAt) normalized.capturedAt = normalized.updatedAt;
  root.drivers[id][orderId] = normalized;
  writeRoot(root);
}

export function clearOrderProofs(driverId: string, orderId: string): void {
  const id = assertDriverId(driverId);
  const root = readRoot();
  if (!root.drivers[id]) return;
  delete root.drivers[id][orderId];
  if (Object.keys(root.drivers[id]).length === 0) delete root.drivers[id];
  writeRoot(root);
}

/** Remove all local proof state for one driver (used after confirmed logout). */
export function clearDriverProofScope(driverId: string): void {
  const id = assertDriverId(driverId);
  const root = readRoot();
  delete root.drivers[id];
  writeRoot(root);
}

export function driverHasUnsyncedProofs(driverId: string): boolean {
  const id = assertDriverId(driverId);
  pruneExpiredProofsForDriver(id);
  const root = readRoot();
  const orders = root.drivers[id];
  if (!orders) return false;
  for (const order of Object.values(orders)) {
    const normalized = normalizeOrderProofs(order);
    for (const meta of Object.values(normalized.proofSync)) {
      if (!meta) continue;
      if (
        meta.syncStatus === "captured_locally" ||
        meta.syncStatus === "failed" ||
        meta.syncStatus === "uploading" ||
        meta.syncStatus === "preparing"
      ) {
        return true;
      }
    }
    if (Object.keys(normalized.proofs).length > 0) return true;
  }
  return false;
}

/** Strip local Data URL after successful server sync; keep metadata only. */
export function clearLocalProofDataUrl(
  driverId: string,
  orderId: string,
  type: ProofType,
  meta: Pick<ProofSyncMeta, "serverProofId" | "syncedAt">,
): OrderProofs {
  const current = getOrderProofs(driverId, orderId);
  const proofs = { ...current.proofs };
  delete proofs[type];
  const next: OrderProofs = {
    ...current,
    proofs,
    proofSync: {
      ...current.proofSync,
      [type]: {
        syncStatus: "synced",
        serverProofId: meta.serverProofId,
        syncedAt: meta.syncedAt ?? nowIso(),
        updatedAt: nowIso(),
        capturedAt: current.proofSync[type]?.capturedAt,
      },
    },
  };
  saveOrderProofs(driverId, orderId, next);
  return next;
}

/** @internal Test helper — wipe v2 + legacy keys. */
export function resetProofStorageForTests(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PROOF_STORAGE_KEY);
  localStorage.removeItem(LEGACY_PROOF_STORAGE_KEY);
}
