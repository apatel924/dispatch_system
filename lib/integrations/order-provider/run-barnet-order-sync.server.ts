import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { omitUndefined } from "@/lib/server/firestore/helpers";
import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import { fetchBarnetOrders } from "@/lib/integrations/order-provider/barnet-client.server";
import {
  enrichBarnetDeliveryOrder,
  type BarnetCustomerCache,
} from "@/lib/integrations/order-provider/barnet-customer-enrichment.server";
import {
  getBarnetEnrichmentConcurrency,
  getBarnetSyncConsecutiveKnownThreshold,
} from "@/lib/integrations/order-provider/barnet-sync-config.server";
import {
  computeBarnetOrderSourceHash,
  readStoredBarnetSourceHash,
} from "@/lib/integrations/order-provider/barnet-sync-hash.server";
import { classifyBarnetOrder } from "@/lib/integrations/order-provider/classify-barnet-order";
import { assertLiveSyncAllowed } from "@/lib/integrations/order-provider/env.server";
import { getExternalOrderProviderConfig } from "@/lib/integrations/order-provider/env.server";
import { hydrateNormalizedExternalOrder } from "@/lib/integrations/order-provider/external-order-intake";
import { mapWithConcurrency } from "@/lib/integrations/order-provider/map-with-concurrency.server";
import {
  barnetDocumentId,
  normalizeBarnetOrder,
} from "@/lib/integrations/order-provider/normalize-barnet-order";
import { getExternalOrderSyncPaginationConfig } from "@/lib/integrations/order-provider/sync-pagination.server";
import type { ExternalOrderSyncResult } from "@/lib/integrations/order-provider/types";

const COLLECTION = "externalOrders";
const SYNC_STATE_DOC = "integrationState/orderProvider";

export interface BarnetOrderSyncRunResult {
  pagesScanned: number;
  ordersSeen: number;
  deliveryCandidates: number;
  newDeliveries: number;
  updatedDeliveries: number;
  unchangedOrders: number;
  pickupOrdersIgnored: number;
  unknownOrdersIgnored: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function coerceExternalOrderId(order: BarnetOrderRaw): string {
  const id = order.id;
  if (id === undefined || id === null) return "unknown";
  const text = String(id).trim();
  return text.length > 0 ? text : "unknown";
}

function preserveAssignmentFields(
  toStore: ReturnType<typeof normalizeBarnetOrder>,
  existing: ReturnType<typeof hydrateNormalizedExternalOrder> | null,
) {
  if (!existing) return toStore;

  return {
    ...toStore,
    assignmentStatus: existing.assignmentStatus ?? "unassigned",
    assignedDriverId: existing.assignedDriverId ?? null,
    assignedDriverName: existing.assignedDriverName ?? null,
    assignedAt: existing.assignedAt ?? null,
    assignedBy: existing.assignedBy ?? null,
    promoted: existing.promoted ?? false,
    promotedOrderId: existing.promotedOrderId ?? null,
    promotedAt: existing.promotedAt ?? null,
    status:
      existing.assignmentStatus === "assigned"
        ? "assigned"
        : existing.promoted
          ? "promoted"
          : toStore.status,
    dispatchStatus:
      existing.assignmentStatus === "assigned"
        ? "assigned"
        : existing.promoted
          ? "promoted"
          : toStore.dispatchStatus,
    createdAt: existing.createdAt ?? toStore.createdAt,
  };
}

async function writeSyncStateSuccess(
  result: BarnetOrderSyncRunResult,
  now: string,
): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(SYNC_STATE_DOC).set(
    omitUndefined({
      lastSuccessfulSyncAt: now,
      lastError: null,
      lastSyncSummary: {
        inserted: result.newDeliveries,
        updated: result.updatedDeliveries,
        deliveryOrdersFound: result.deliveryCandidates,
        pagesScanned: result.pagesScanned,
      },
    }),
    { merge: true },
  );
}

async function writeSyncStateFailure(message: string): Promise<void> {
  const db = getAdminFirestore();
  const snap = await db.doc(SYNC_STATE_DOC).get();
  const data = snap.data() ?? {};

  await db.doc(SYNC_STATE_DOC).set(
    omitUndefined({
      lastSuccessfulSyncAt:
        typeof data.lastSuccessfulSyncAt === "string" ? data.lastSuccessfulSyncAt : null,
      lastError: message,
      lastSyncSummary:
        data.lastSyncSummary && typeof data.lastSyncSummary === "object"
          ? data.lastSyncSummary
          : null,
    }),
    { merge: true },
  );
}

interface DeliverySyncTask {
  rawOrder: BarnetOrderRaw;
  sourceHash: string;
  isNew: boolean;
}

/**
 * Incremental Barnet live sync:
 * - classifies pickup vs delivery before enrichment
 * - enriches only new or changed delivery orders
 * - stops after consecutive known orders (pickup or unchanged delivery)
 */
export async function runBarnetOrderSync(): Promise<BarnetOrderSyncRunResult> {
  assertLiveSyncAllowed();

  const config = getExternalOrderProviderConfig();
  const locationId = config.locationId;
  const pagination = getExternalOrderSyncPaginationConfig();
  const consecutiveKnownThreshold = getBarnetSyncConsecutiveKnownThreshold();
  const enrichmentConcurrency = getBarnetEnrichmentConcurrency();

  const db = getAdminFirestore();
  const now = nowIso();
  const customerCache: BarnetCustomerCache = new Map();

  const result: BarnetOrderSyncRunResult = {
    pagesScanned: 0,
    ordersSeen: 0,
    deliveryCandidates: 0,
    newDeliveries: 0,
    updatedDeliveries: 0,
    unchangedOrders: 0,
    pickupOrdersIgnored: 0,
    unknownOrdersIgnored: 0,
  };

  let consecutiveKnown = 0;
  let stopScanning = false;

  try {
    for (let page = 1; page <= pagination.pages && !stopScanning; page += 1) {
      const orders = await fetchBarnetOrders({
        page,
        itemsOnPage: pagination.itemsPerPage,
      });
      result.pagesScanned += 1;

      if (orders.length === 0) {
        console.info(`[order-provider] sync stopping early: page ${page} returned 0 orders`);
        break;
      }

      const deliveryTasks: DeliverySyncTask[] = [];

      for (const rawOrder of orders) {
        result.ordersSeen += 1;
        const kind = classifyBarnetOrder(rawOrder);

        if (kind === "pickup") {
          result.pickupOrdersIgnored += 1;
          result.unchangedOrders += 1;
          consecutiveKnown += 1;
          if (consecutiveKnown >= consecutiveKnownThreshold) {
            stopScanning = true;
            break;
          }
          continue;
        }

        if (kind === "unknown") {
          result.unknownOrdersIgnored += 1;
          result.unchangedOrders += 1;
          consecutiveKnown = 0;
          continue;
        }

        result.deliveryCandidates += 1;
        const docRef = db
          .collection(COLLECTION)
          .doc(barnetDocumentId(coerceExternalOrderId(rawOrder)));
        const existingSnap = await docRef.get();
        const sourceHash = computeBarnetOrderSourceHash(rawOrder, { now });

        if (existingSnap.exists) {
          const existing = hydrateNormalizedExternalOrder(
            existingSnap.data() as Record<string, unknown>,
          );
          const storedHash = readStoredBarnetSourceHash(existing);
          if (storedHash === sourceHash) {
            result.unchangedOrders += 1;
            consecutiveKnown += 1;
            if (consecutiveKnown >= consecutiveKnownThreshold) {
              stopScanning = true;
              break;
            }
            continue;
          }

          deliveryTasks.push({ rawOrder, sourceHash, isNew: false });
        } else {
          deliveryTasks.push({ rawOrder, sourceHash, isNew: true });
        }

        consecutiveKnown = 0;
      }

      if (deliveryTasks.length > 0) {
        await mapWithConcurrency(
          deliveryTasks,
          enrichmentConcurrency,
          async (task) => {
            const docRef = db
              .collection(COLLECTION)
              .doc(barnetDocumentId(coerceExternalOrderId(task.rawOrder)));
            const existingSnap = await docRef.get();
            const existingData = existingSnap.exists
              ? hydrateNormalizedExternalOrder(existingSnap.data() as Record<string, unknown>)
              : null;
            const preserve = existingData
              ? {
                  createdAt: existingData.createdAt ?? now,
                  updatedAt: now,
                }
              : undefined;

            const base = normalizeBarnetOrder(task.rawOrder, {
              now,
              preserveTimestamps: preserve,
            });
            const enriched = await enrichBarnetDeliveryOrder(
              base,
              task.rawOrder,
              customerCache,
            );
            const toStore = preserveAssignmentFields(
              {
                ...enriched,
                sourceLocationId: enriched.sourceLocationId ?? locationId,
                syncSourceHash: task.sourceHash,
                lastSyncedAt: now,
                updatedAt: now,
              },
              existingData,
            );

            await docRef.set(
              omitUndefined(toStore as unknown as Record<string, unknown>),
            );

            if (task.isNew) {
              result.newDeliveries += 1;
            } else {
              result.updatedDeliveries += 1;
            }
          },
        );
      }

      if (consecutiveKnown >= consecutiveKnownThreshold) {
        console.info(
          `[order-provider] sync stopping early: consecutive known threshold ${consecutiveKnownThreshold} reached`,
        );
        break;
      }
    }

    await writeSyncStateSuccess(result, now);

    console.info(
      `[order-provider] live sync complete: pages=${result.pagesScanned} seen=${result.ordersSeen} delivery=${result.deliveryCandidates} new=${result.newDeliveries} updated=${result.updatedDeliveries} unchanged=${result.unchangedOrders}`,
    );

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Live sync failed";
    await writeSyncStateFailure(message);
    throw err;
  }
}

export function toExternalOrderSyncResult(
  run: BarnetOrderSyncRunResult,
): ExternalOrderSyncResult {
  return {
    pagesScanned: run.pagesScanned,
    totalOrdersSeen: run.ordersSeen,
    deliveryOrdersFound: run.deliveryCandidates,
    pickupOrdersIgnored: run.pickupOrdersIgnored,
    unknownOrdersIgnored: run.unknownOrdersIgnored,
    inserted: run.newDeliveries,
    updated: run.updatedDeliveries,
    total: run.newDeliveries + run.updatedDeliveries,
  };
}
