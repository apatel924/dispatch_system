import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { omitUndefined } from "@/lib/server/firestore/helpers";
import { getExternalOrderProviderConfig } from "@/lib/integrations/order-provider/env.server";
import {
  fetchMockProviderOrders,
  getMockProviderName,
} from "@/lib/integrations/order-provider/mock-client.server";
import { normalizeExternalOrder } from "@/lib/integrations/order-provider/normalize-order";
import type {
  ExternalOrderProviderHealth,
  ExternalOrderSyncResult,
  NormalizedExternalOrder,
} from "@/lib/integrations/order-provider/types";

const COLLECTION = "externalOrders";

export function getOrderProviderHealth(): ExternalOrderProviderHealth {
  const config = getExternalOrderProviderConfig();
  return {
    ok: true,
    mode: config.mode,
    configured: config.configured,
  };
}

export async function listSyncedExternalOrders(
  limit = 50,
): Promise<NormalizedExternalOrder[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(COLLECTION)
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => doc.data() as NormalizedExternalOrder);
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
  getExternalOrderProviderConfig,
  getExternalOrderProviderSecrets,
} from "@/lib/integrations/order-provider/env.server";
export {
  fetchMockProviderOrders,
  getMockProviderName,
} from "@/lib/integrations/order-provider/mock-client.server";
export {
  normalizeExternalOrder,
  normalizeExternalOrders,
} from "@/lib/integrations/order-provider/normalize-order";
export type {
  ExternalOrderProviderConfig,
  ExternalOrderProviderHealth,
  ExternalOrderProviderMode,
  ExternalOrderSyncResult,
  ExternalProviderOrder,
  NormalizedExternalOrder,
} from "@/lib/integrations/order-provider/types";
