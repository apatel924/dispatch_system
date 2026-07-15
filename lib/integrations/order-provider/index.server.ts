import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { omitUndefined } from "@/lib/server/firestore/helpers";
import type { AuthUser } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/services/audit";
import { getDriverById } from "@/lib/server/services/drivers";
import { assignDriver } from "@/lib/server/services/orders";
import { notFoundError } from "@/lib/server/errors";
import { promoteExternalOrderToDispatch } from "@/lib/integrations/order-provider/promote-external-order.server";
import {
  assertLiveOrdersReadsAllowed,
  assertLiveReadsAllowed,
  assertLiveSyncAllowed,
  getExternalOrderProviderConfig,
} from "@/lib/integrations/order-provider/env.server";
import { diagnoseBarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-order-diagnostics";
import {
  enrichBarnetDeliveryOrder,
  resolveBarnetCustomerId,
  type BarnetCustomerCache,
} from "@/lib/integrations/order-provider/barnet-customer-enrichment.server";
import {
  fetchBarnetOrderById,
  fetchBarnetOrderByNumber,
  fetchBarnetUserById,
  type BarnetOrderRaw,
} from "@/lib/integrations/order-provider/barnet-client.server";
import { diagnoseLiveCustomerDetail } from "@/lib/integrations/order-provider/live-customer-detail-diagnostics";
import { diagnoseLiveOrderDetail } from "@/lib/integrations/order-provider/live-order-detail-diagnostics";
import { scanBarnetOrderPages } from "@/lib/integrations/order-provider/scan-barnet-orders.server";
import {
  fetchMockProviderOrders,
  getMockProviderName,
} from "@/lib/integrations/order-provider/mock-client.server";
import { normalizeExternalOrder } from "@/lib/integrations/order-provider/normalize-order";
import {
  barnetDocumentId,
  normalizeBarnetOrder,
} from "@/lib/integrations/order-provider/normalize-barnet-order";
import { toSafeExternalOrder } from "@/lib/integrations/order-provider/safe-external-order";
import {
  hydrateNormalizedExternalOrder,
  toExternalOrderIntakeDetail,
  toExternalOrderIntakeRow,
} from "@/lib/integrations/order-provider/external-order-intake";
import type {
  ExternalOrderIntakeDetail,
  ExternalOrderIntakeRow,
  ExternalOrderProviderHealth,
  ExternalOrderProviderSyncState,
  ExternalOrderSyncResult,
  LiveCustomerDetailResult,
  LiveDeliveryScanResult,
  LiveOrderDetailResult,
  LiveOrderPreviewResult,
  LiveOrderProviderHealth,
  NormalizedExternalOrder,
  SafeExternalOrder,
} from "@/lib/integrations/order-provider/types";

const COLLECTION = "externalOrders";
const SYNC_STATE_DOC = "integrationState/orderProvider";

function nowIso(): string {
  return new Date().toISOString();
}

async function readSyncState(): Promise<ExternalOrderProviderSyncState> {
  const db = getAdminFirestore();
  const snap = await db.doc(SYNC_STATE_DOC).get();
  if (!snap.exists) {
    return {
      lastSuccessfulSyncAt: null,
      lastAttemptedSyncAt: null,
      lastAttemptAt: null,
      lastAttemptResult: null,
      lastScanAt: null,
      lastNewOrderImportedAt: null,
      lastResult: null,
      lastError: null,
      lastSyncSummary: null,
    };
  }
  const data = snap.data() as Record<string, unknown>;
  return {
    lastSuccessfulSyncAt:
      typeof data.lastSuccessfulSyncAt === "string" ? data.lastSuccessfulSyncAt : null,
    lastAttemptedSyncAt:
      typeof data.lastAttemptAt === "string"
        ? data.lastAttemptAt
        : typeof data.lastAttemptedSyncAt === "string"
          ? data.lastAttemptedSyncAt
          : null,
    lastAttemptAt:
      typeof data.lastAttemptAt === "string"
        ? data.lastAttemptAt
        : typeof data.lastAttemptedSyncAt === "string"
          ? data.lastAttemptedSyncAt
          : null,
    lastAttemptResult:
      typeof data.lastAttemptResult === "string" ? data.lastAttemptResult : null,
    lastScanAt: typeof data.lastScanAt === "string" ? data.lastScanAt : null,
    lastNewOrderImportedAt:
      typeof data.lastNewOrderImportedAt === "string"
        ? data.lastNewOrderImportedAt
        : null,
    lastResult: typeof data.lastResult === "string" ? data.lastResult : null,
    lastError: typeof data.lastError === "string" ? data.lastError : null,
    lastSyncSummary:
      data.lastSyncSummary && typeof data.lastSyncSummary === "object"
        ? (data.lastSyncSummary as ExternalOrderProviderSyncState["lastSyncSummary"])
        : null,
  };
}

async function writeSyncState(state: ExternalOrderProviderSyncState): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(SYNC_STATE_DOC).set(omitUndefined(state as unknown as Record<string, unknown>));
}

export async function getExternalOrderProviderSyncState(): Promise<ExternalOrderProviderSyncState> {
  return readSyncState();
}

export function getOrderProviderHealthWithSyncState(): ExternalOrderProviderHealth & {
  syncState: ExternalOrderProviderSyncState;
} {
  return {
    ...getOrderProviderHealth(),
    syncState: {
      lastSuccessfulSyncAt: null,
      lastAttemptedSyncAt: null,
      lastAttemptAt: null,
      lastAttemptResult: null,
      lastScanAt: null,
      lastNewOrderImportedAt: null,
      lastResult: null,
      lastError: null,
      lastSyncSummary: null,
    },
  };
}

export async function getExternalOrderProviderHealthWithSyncState(): Promise<
  ExternalOrderProviderHealth & { syncState: ExternalOrderProviderSyncState }
> {
  return {
    ...getOrderProviderHealth(),
    syncState: await readSyncState(),
  };
}

async function buildEnrichedNormalizedOrder(
  rawOrder: Parameters<typeof normalizeBarnetOrder>[0],
  customerCache: BarnetCustomerCache,
): Promise<NormalizedExternalOrder> {
  const normalized = await enrichBarnetDeliveryOrder(
    normalizeBarnetOrder(rawOrder),
    rawOrder,
    customerCache,
  );
  const diagnostics = diagnoseBarnetOrderRaw(rawOrder, {
    customerName: normalized.customerName,
    customerPhone: normalized.customerPhone,
    customerEmail: normalized.customerEmail,
    customerEnrichmentStatus: normalized.customerEnrichmentStatus,
    customerMessagingReady: normalized.customerMessagingReady,
  });
  return {
    ...normalized,
    dispatchReady: diagnostics.dispatchReady,
    needsReview: normalized.needsReview,
    reviewReasons: normalized.reviewReasons,
    missingFields: diagnostics.missingFields,
    dispatchStatus: diagnostics.dispatchReady ? "ready" : "needs_review",
  };
}

async function buildEnrichedSafeOrder(
  rawOrder: Parameters<typeof normalizeBarnetOrder>[0],
  customerCache: BarnetCustomerCache,
): Promise<SafeExternalOrder> {
  const normalized = await buildEnrichedNormalizedOrder(rawOrder, customerCache);
  const diagnostics = diagnoseBarnetOrderRaw(rawOrder, {
    customerName: normalized.customerName,
    customerPhone: normalized.customerPhone,
    customerEmail: normalized.customerEmail,
    customerEnrichmentStatus: normalized.customerEnrichmentStatus,
    customerMessagingReady: normalized.customerMessagingReady,
  });
  return toSafeExternalOrder(normalized, diagnostics);
}

export function getOrderProviderHealth(): ExternalOrderProviderHealth {
  const config = getExternalOrderProviderConfig();
  const readsDisabled =
    config.mode === "live" && config.configured && !config.liveReadsEnabled;

  return {
    ok: true,
    mode: config.mode,
    configured: config.configured,
    ordersConfigured: config.ordersConfigured,
    liveReadsEnabled: config.liveReadsEnabled,
    liveSyncEnabled: config.liveSyncEnabled,
    readsDisabled,
  };
}

export function getLiveOrderProviderHealth(): LiveOrderProviderHealth {
  const base = getOrderProviderHealth();
  const config = getExternalOrderProviderConfig();

  return {
    ...base,
    apiPathPrefix: config.apiPathPrefix,
    locationId: config.locationId,
    hasOtp: config.hasOtp,
    hasWebhookSecret: config.hasWebhookSecret,
  };
}

/**
 * Read-only live Barnet order detail probe with customer-link diagnostics.
 */
export async function probeLiveOrderDetail(params: {
  id?: string;
  number?: string;
}): Promise<LiveOrderDetailResult> {
  assertLiveOrdersReadsAllowed();

  const id = params.id?.trim();
  const number = params.number?.trim();

  if (!id && !number) {
    throw new Error("id or number is required for live order detail probe");
  }

  const rawOrder = id
    ? await fetchBarnetOrderById(id)
    : await fetchBarnetOrderByNumber(number!);

  if (!rawOrder) {
    throw new Error(
      id
        ? `Barnet order id ${id} was not found`
        : `Barnet order number ${number} was not found`,
    );
  }

  const customerId = resolveBarnetCustomerId(rawOrder);
  const customerCache: BarnetCustomerCache = new Map();
  let enrichment:
    | {
        customerName: string | null;
        customerPhone: string | null;
        customerEmail: string | null;
        customerEnrichmentStatus: NormalizedExternalOrder["customerEnrichmentStatus"];
        customerMessagingReady: boolean;
      }
    | undefined;

  if (customerId) {
    const enriched = await enrichBarnetDeliveryOrder(
      normalizeBarnetOrder(rawOrder),
      rawOrder,
      customerCache,
    );
    enrichment = {
      customerName: enriched.customerName,
      customerPhone: enriched.customerPhone,
      customerEmail: enriched.customerEmail,
      customerEnrichmentStatus: enriched.customerEnrichmentStatus,
      customerMessagingReady: enriched.customerMessagingReady,
    };
  }

  return {
    ok: true,
    mode: "live",
    diagnostics: diagnoseLiveOrderDetail(rawOrder, enrichment),
  };
}

/**
 * Read-only live Barnet customer detail probe with safe diagnostics only.
 */
export async function probeLiveCustomerDetail(
  customerId: string,
): Promise<LiveCustomerDetailResult> {
  assertLiveReadsAllowed();

  const trimmedId = customerId.trim();
  if (!trimmedId) {
    throw new Error("customerId is required for live customer detail probe");
  }

  const rawUser = await fetchBarnetUserById(trimmedId);

  return {
    ok: true,
    mode: "live",
    diagnostics: diagnoseLiveCustomerDetail(trimmedId, rawUser),
  };
}

export async function previewLiveExternalOrders(): Promise<LiveOrderPreviewResult> {
  assertLiveOrdersReadsAllowed();

  const config = getExternalOrderProviderConfig();
  const locationId = config.locationId;
  if (!locationId) {
    throw new Error("EXTERNAL_ORDER_LOCATION_ID is required for live preview");
  }

  const scan = await scanBarnetOrderPages();
  const customerCache: BarnetCustomerCache = new Map();
  const normalizedOrders = await Promise.all(
    scan.deliveryOrders.map((rawOrder) => buildEnrichedNormalizedOrder(rawOrder, customerCache)),
  );
  const orders: SafeExternalOrder[] = normalizedOrders.map((normalized, index) =>
    toSafeExternalOrder(
      normalized,
      diagnoseBarnetOrderRaw(scan.deliveryOrders[index]!, {
        customerName: normalized.customerName,
        customerPhone: normalized.customerPhone,
        customerEmail: normalized.customerEmail,
        customerEnrichmentStatus: normalized.customerEnrichmentStatus,
        customerMessagingReady: normalized.customerMessagingReady,
      }),
    ),
  );
  const intakeOrders = normalizedOrders.map((normalized) =>
    toExternalOrderIntakeRow(normalized, { isPreview: true }),
  );

  return {
    ok: true,
    mode: "live",
    orders,
    intakeOrders,
    total: orders.length,
    pagesScanned: scan.pagesScanned,
    totalOrdersSeen: scan.totalOrdersSeen,
    deliveryOrdersFound: scan.deliveryOrdersFound,
    pickupOrdersIgnored: scan.pickupOrdersIgnored,
    unknownOrdersIgnored: scan.unknownOrdersIgnored,
    pagesConfigured: scan.pagesConfigured,
    itemsOnPage: scan.itemsPerPage,
    locationId,
  };
}

/**
 * Read-only multi-page scan for delivery orders. Does not write to Firestore.
 */
export async function scanLiveExternalDeliveryOrders(): Promise<LiveDeliveryScanResult> {
  assertLiveOrdersReadsAllowed();

  const config = getExternalOrderProviderConfig();
  const locationId = config.locationId;
  if (!locationId) {
    throw new Error("EXTERNAL_ORDER_LOCATION_ID is required for delivery scan");
  }

  const scan = await scanBarnetOrderPages();
  const customerCache: BarnetCustomerCache = new Map();
  const normalizedOrders = await Promise.all(
    scan.deliveryOrders.map((rawOrder) => buildEnrichedNormalizedOrder(rawOrder, customerCache)),
  );
  const orders: SafeExternalOrder[] = normalizedOrders.map((normalized, index) =>
    toSafeExternalOrder(
      normalized,
      diagnoseBarnetOrderRaw(scan.deliveryOrders[index]!, {
        customerName: normalized.customerName,
        customerPhone: normalized.customerPhone,
        customerEmail: normalized.customerEmail,
        customerEnrichmentStatus: normalized.customerEnrichmentStatus,
        customerMessagingReady: normalized.customerMessagingReady,
      }),
    ),
  );
  const intakeOrders = normalizedOrders.map((normalized) =>
    toExternalOrderIntakeRow(normalized, { isPreview: true }),
  );

  return {
    ok: true,
    mode: "live",
    orders,
    intakeOrders,
    pagesScanned: scan.pagesScanned,
    totalOrdersSeen: scan.totalOrdersSeen,
    deliveryOrdersFound: scan.deliveryOrdersFound,
    pickupOrdersIgnored: scan.pickupOrdersIgnored,
    unknownOrdersIgnored: scan.unknownOrdersIgnored,
    pagesConfigured: scan.pagesConfigured,
    itemsPerPage: scan.itemsPerPage,
    locationId,
  };
}

/**
 * Loads live Barnet orders (read-only GET across configured pages), normalizes delivery orders,
 * and upserts into Firestore. Document IDs are stable: barnet_<externalOrderId>.
 * Uses the shared sync orchestrator (operating hours + lock + run metrics).
 */
export async function syncLiveExternalOrders(options?: {
  actorId?: string | null;
  overrideQuietHours?: boolean;
}): Promise<ExternalOrderSyncResult & {
  skipped?: boolean;
  reason?: string;
  status?: string;
  nextEligibleAt?: string;
  unchangedOrders?: number;
  needsReview?: number;
  readyToDispatch?: number;
  enrichmentErrors?: number;
  syncErrors?: number;
  invalidOrders?: number;
  exclusionReasons?: Record<string, number>;
  durationMs?: number;
}> {
  const { executeBarnetSync } = await import(
    "@/lib/integrations/order-provider/execute-barnet-sync.server"
  );
  const result = await executeBarnetSync({
    source: "manual",
    actorId: options?.actorId,
    overrideQuietHours: options?.overrideQuietHours,
  });

  if ("skipped" in result && result.skipped) {
    return {
      pagesScanned: 0,
      totalOrdersSeen: 0,
      deliveryOrdersFound: 0,
      pickupOrdersIgnored: 0,
      unknownOrdersIgnored: 0,
      inserted: 0,
      updated: 0,
      total: 0,
      skipped: true,
      reason: result.reason,
      status: result.status,
      nextEligibleAt: "nextEligibleAt" in result ? result.nextEligibleAt : undefined,
      durationMs: result.durationMs,
    };
  }

  if (!result.ok) {
    throw new Error(result.safeErrorMessage);
  }

  return {
    pagesScanned: result.pagesScanned,
    totalOrdersSeen: result.ordersSeen,
    deliveryOrdersFound: result.deliveryCandidates,
    pickupOrdersIgnored: result.pickupOrdersIgnored,
    unknownOrdersIgnored: result.unknownOrdersIgnored,
    inserted: result.newDeliveries,
    updated: result.updatedDeliveries,
    total: result.newDeliveries + result.updatedDeliveries,
    status: result.status,
    unchangedOrders: result.unchangedOrders,
    needsReview: result.needsReview,
    readyToDispatch: result.readyToDispatch,
    enrichmentErrors: result.enrichmentErrors,
    syncErrors: result.syncErrors,
    invalidOrders: result.invalid,
    exclusionReasons: result.exclusionReasons,
    durationMs: result.durationMs,
  };
}

export async function listSyncedExternalOrders(
  limit = 50,
): Promise<SafeExternalOrder[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(COLLECTION)
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) =>
    toSafeExternalOrder(
      hydrateNormalizedExternalOrder(doc.data() as Record<string, unknown>),
    ),
  );
}

export async function listExternalOrderIntakeRows(
  limit = 100,
): Promise<ExternalOrderIntakeRow[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(COLLECTION)
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) =>
    toExternalOrderIntakeRow(
      hydrateNormalizedExternalOrder(doc.data() as Record<string, unknown>),
      { docId: doc.id },
    ),
  );
}

export async function getExternalOrderIntakeDetail(
  docId: string,
): Promise<ExternalOrderIntakeDetail> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTION).doc(docId).get();
  if (!snap.exists) {
    throw notFoundError("External order", docId);
  }

  return toExternalOrderIntakeDetail(
    hydrateNormalizedExternalOrder(snap.data() as Record<string, unknown>),
    { docId: snap.id },
  );
}

export async function assignExternalOrderDriver(
  docId: string,
  driverId: string,
  actor: AuthUser,
  options?: { overrideMissingFields?: boolean },
): Promise<ExternalOrderIntakeDetail> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTION).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw notFoundError("External order", docId);
  }

  const order = hydrateNormalizedExternalOrder(snap.data() as Record<string, unknown>);
  if (order.assignmentStatus === "assigned" && order.assignedDriverId) {
    throw new Error("This external order is already assigned to a driver");
  }

  const detail = toExternalOrderIntakeDetail(order, { docId });
  const missingRequired = !detail.dispatchChecks.deliveryOrderConfirmed
    || !detail.dispatchChecks.customerNamePresent
    || !detail.dispatchChecks.customerPhonePresent
    || !detail.dispatchChecks.deliveryAddressPresent
    || !detail.dispatchChecks.itemsPresent;

  if (missingRequired && !options?.overrideMissingFields) {
    throw new Error(
      "Required dispatch fields are missing. Confirm override to assign anyway.",
    );
  }

  const promoteResult = await promoteExternalOrderToDispatch(docId, actor, {
    overrideMissingFields: options?.overrideMissingFields,
  });

  const driver = await getDriverById(driverId);
  const now = nowIso();

  await assignDriver(promoteResult.order.id, driverId, actor);

  await ref.update({
    assignmentStatus: "assigned",
    dispatchStatus: "assigned",
    status: "assigned",
    assignedDriverId: driverId,
    assignedDriverName: driver.name,
    assignedAt: now,
    assignedBy: actor.uid,
    promoted: true,
    promotedOrderId: promoteResult.order.id,
    promotedAt: promoteResult.order.promotedAt ?? promoteResult.order.createdAt,
    updatedAt: now,
  });

  await writeAuditLog({
    action: "external_order.assign_driver",
    entityType: "order",
    entityId: docId,
    actorId: actor.uid,
    actorRole: actor.role,
    metadata: {
      driverId,
      dispatchOrderId: promoteResult.order.id,
      externalOrderId: order.externalOrderId,
      provider: order.provider,
    },
  });

  return getExternalOrderIntakeDetail(docId);
}

/**
 * Loads mock provider orders, normalizes them, and upserts into Firestore.
 * Uses externalOrderId as the stable document key.
 */
export async function syncMockExternalOrders(): Promise<ExternalOrderSyncResult> {
  const config = getExternalOrderProviderConfig();
  if (config.mode !== "mock") {
    throw new Error("Mock sync is only available when EXTERNAL_ORDER_PROVIDER_MODE=mock");
  }

  const provider = getMockProviderName();
  const rawOrders = fetchMockProviderOrders();
  const db = getAdminFirestore();
  const now = new Date().toISOString();

  let inserted = 0;
  let updated = 0;

  for (const rawOrder of rawOrders) {
    const docRef = db.collection(COLLECTION).doc(rawOrder.id);
    const existing = await docRef.get();
    const preserve = existing.exists
      ? {
          createdAt: (existing.data()?.createdAt as string | undefined) ?? now,
          updatedAt: now,
        }
      : undefined;

    const normalized = normalizeExternalOrder(provider, rawOrder, {
      now,
      preserveTimestamps: preserve,
    });

    await docRef.set(omitUndefined(normalized as unknown as Record<string, unknown>));

    if (existing.exists) {
      updated += 1;
    } else {
      inserted += 1;
    }
  }

  const result: ExternalOrderSyncResult = {
    pagesScanned: 1,
    totalOrdersSeen: rawOrders.length,
    deliveryOrdersFound: rawOrders.length,
    pickupOrdersIgnored: 0,
    unknownOrdersIgnored: 0,
    inserted,
    updated,
    total: inserted + updated,
  };

  console.info(
    `[order-provider] mock sync complete: inserted=${result.inserted} updated=${result.updated}`,
  );

  return result;
}

export {
  assertLiveOrdersReadsAllowed,
  assertLiveReadsAllowed,
  assertLiveSyncAllowed,
  getExternalOrderProviderConfig,
  getExternalOrderProviderSecrets,
} from "@/lib/integrations/order-provider/env.server";
export {
  fetchBarnetLocations,
  fetchBarnetOrderById,
  fetchBarnetOrderByNumber,
  fetchBarnetOrders,
  fetchBarnetUserById,
  fetchSafeBarnetLocations,
  getBarnetProviderName,
  normalizeBarnetLocationsResponse,
} from "@/lib/integrations/order-provider/barnet-client.server";
export {
  fetchMockProviderOrders,
  getMockProviderName,
} from "@/lib/integrations/order-provider/mock-client.server";
export {
  normalizeExternalOrder,
  normalizeExternalOrders,
} from "@/lib/integrations/order-provider/normalize-order";
export {
  diagnoseBarnetOrderRaw,
  diagnoseNormalizedExternalOrder,
} from "@/lib/integrations/order-provider/barnet-order-diagnostics";
export { findCustomerLinkFields } from "@/lib/integrations/order-provider/find-customer-link-fields";
export { diagnoseLiveOrderDetail } from "@/lib/integrations/order-provider/live-order-detail-diagnostics";
export { shouldTriggerExternalOrderCustomerSms } from "@/lib/integrations/order-provider/customer-messaging.server";
export {
  toSafeExternalOrder,
} from "@/lib/integrations/order-provider/safe-external-order";
export {
  barnetDocumentId,
  classifyBarnetOrder,
  isBarnetDeliveryOrder,
  normalizeBarnetOrder,
  normalizeBarnetOrders,
} from "@/lib/integrations/order-provider/normalize-barnet-order";
export type {
  BarnetLocationsMeta,
  BarnetLocationsRawShape,
  BarnetOrderDiagnostics,
  LiveOrderDetailDiagnostics,
  LiveOrderDetailResult,
  ExternalOrderProviderConfig,
  ExternalOrderProviderHealth,
  ExternalOrderProviderMode,
  ExternalOrderSyncResult,
  ExternalProviderOrder,
  LiveLocationsResult,
  LiveOrderPreviewResult,
  LiveOrderProviderHealth,
  NormalizedExternalOrder,
  SafeBarnetLocation,
  SafeExternalOrder,
} from "@/lib/integrations/order-provider/types";
