import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { omitUndefined } from "@/lib/server/firestore/helpers";
import {
  assertLiveOrdersReadsAllowed,
  assertLiveSyncAllowed,
  getExternalOrderProviderConfig,
} from "@/lib/integrations/order-provider/env.server";
import { diagnoseBarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-order-diagnostics";
import { fetchBarnetOrders } from "@/lib/integrations/order-provider/barnet-client.server";
import {
  fetchMockProviderOrders,
  getMockProviderName,
} from "@/lib/integrations/order-provider/mock-client.server";
import { normalizeExternalOrder } from "@/lib/integrations/order-provider/normalize-order";
import {
  barnetDocumentId,
  isBarnetDeliveryOrder,
  normalizeBarnetOrder,
} from "@/lib/integrations/order-provider/normalize-barnet-order";
import { toSafeExternalOrder } from "@/lib/integrations/order-provider/safe-external-order";
import type {
  ExternalOrderProviderHealth,
  ExternalOrderSyncResult,
  LiveOrderPreviewResult,
  LiveOrderProviderHealth,
  NormalizedExternalOrder,
  SafeExternalOrder,
} from "@/lib/integrations/order-provider/types";

const COLLECTION = "externalOrders";

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

export async function previewLiveExternalOrders(
  options?: { page?: number; itemsOnPage?: number },
): Promise<LiveOrderPreviewResult> {
  assertLiveOrdersReadsAllowed();

  const config = getExternalOrderProviderConfig();
  const locationId = config.locationId;
  if (!locationId) {
    throw new Error("EXTERNAL_ORDER_LOCATION_ID is required for live preview");
  }

  const page = options?.page ?? 1;
  const itemsOnPage = options?.itemsOnPage ?? 10;
  const rawOrders = await fetchBarnetOrders({ page, itemsOnPage });
  const deliveryOrders = rawOrders.filter(isBarnetDeliveryOrder);
  const orders: SafeExternalOrder[] = deliveryOrders.map((rawOrder) => {
    const normalized = normalizeBarnetOrder(rawOrder);
    const diagnostics = diagnoseBarnetOrderRaw(rawOrder);
    return toSafeExternalOrder(normalized, diagnostics);
  });

  return {
    ok: true,
    mode: "live",
    orders,
    total: orders.length,
    page,
    itemsOnPage,
    locationId,
  };
}

/**
 * Loads live Barnet orders (read-only GET), normalizes delivery orders, and upserts into Firestore.
 * Document IDs are stable: barnet_<externalOrderId>.
 */
export async function syncLiveExternalOrders(
  options?: { page?: number; itemsOnPage?: number },
): Promise<ExternalOrderSyncResult> {
  assertLiveSyncAllowed();

  const page = options?.page ?? 1;
  const itemsOnPage = options?.itemsOnPage ?? 50;
  const rawOrders = await fetchBarnetOrders({ page, itemsOnPage });
  const deliveryOrders = rawOrders.filter(isBarnetDeliveryOrder);

  const db = getAdminFirestore();
  const now = new Date().toISOString();

  let inserted = 0;
  let updated = 0;

  for (const rawOrder of deliveryOrders) {
    const normalized = normalizeBarnetOrder(rawOrder, { now });
    const docRef = db.collection(COLLECTION).doc(barnetDocumentId(normalized.externalOrderId));
    const existing = await docRef.get();
    const preserve = existing.exists
      ? {
          createdAt: (existing.data()?.createdAt as string | undefined) ?? now,
          updatedAt: now,
        }
      : undefined;

    const toStore = normalizeBarnetOrder(rawOrder, {
      now,
      preserveTimestamps: preserve,
    });

    await docRef.set(omitUndefined(toStore as unknown as Record<string, unknown>));

    if (existing.exists) {
      updated += 1;
    } else {
      inserted += 1;
    }
  }

  const result: ExternalOrderSyncResult = {
    inserted,
    updated,
    total: inserted + updated,
  };

  console.info(
    `[order-provider] live sync complete: inserted=${result.inserted} updated=${result.updated}`,
  );

  return result;
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
    toSafeExternalOrder(doc.data() as NormalizedExternalOrder),
  );
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
export { shouldTriggerExternalOrderCustomerSms } from "@/lib/integrations/order-provider/customer-messaging.server";
export {
  toSafeExternalOrder,
} from "@/lib/integrations/order-provider/safe-external-order";
export {
  barnetDocumentId,
  isBarnetDeliveryOrder,
  normalizeBarnetOrder,
  normalizeBarnetOrders,
} from "@/lib/integrations/order-provider/normalize-barnet-order";
export type {
  BarnetLocationsMeta,
  BarnetLocationsRawShape,
  BarnetOrderDiagnostics,
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
