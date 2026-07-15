import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { deepOmitUndefined } from "@/lib/server/firestore/helpers";
import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import { fetchBarnetOrders } from "@/lib/integrations/order-provider/barnet-client.server";
import {
  enrichBarnetDeliveryOrder,
  type BarnetCustomerCache,
} from "@/lib/integrations/order-provider/barnet-customer-enrichment.server";
import {
  evaluateBarnetOrderDecision,
  type BarnetOrderExclusionReason,
} from "@/lib/integrations/order-provider/barnet-order-decision";
import {
  getBarnetEnrichmentConcurrency,
  getBarnetSyncConsecutiveKnownThreshold,
} from "@/lib/integrations/order-provider/barnet-sync-config.server";
import {
  computeBarnetOrderSourceHash,
  readStoredBarnetSourceHash,
} from "@/lib/integrations/order-provider/barnet-sync-hash.server";
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

export interface BarnetOrderSyncRunResult {
  pagesScanned: number;
  ordersSeen: number;
  deliveryCandidates: number;
  newDeliveries: number;
  updatedDeliveries: number;
  unchangedOrders: number;
  needsReview: number;
  readyToDispatch: number;
  pickupOrdersIgnored: number;
  unknownOrdersIgnored: number;
  invalidOrders: number;
  enrichmentErrors: number;
  syncErrors: number;
  exclusionReasons: Record<string, number>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function bumpExclusion(
  result: BarnetOrderSyncRunResult,
  reason: BarnetOrderExclusionReason,
): void {
  result.exclusionReasons[reason] = (result.exclusionReasons[reason] ?? 0) + 1;
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

interface DeliverySyncTask {
  rawOrder: BarnetOrderRaw;
  sourceHash: string;
  isNew: boolean;
  externalOrderId: string;
}

/**
 * Incremental Barnet live sync:
 * - classifies pickup vs delivery before enrichment (shared decision helper)
 * - persists reviewable deliveries even when not dispatch-ready
 * - enriches only new or changed delivery orders
 * - stops after consecutive *unchanged delivery* orders (pickups do not count)
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
    needsReview: 0,
    readyToDispatch: 0,
    pickupOrdersIgnored: 0,
    unknownOrdersIgnored: 0,
    invalidOrders: 0,
    enrichmentErrors: 0,
    syncErrors: 0,
    exclusionReasons: {},
  };

  let consecutiveKnown = 0;
  let stopScanning = false;

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

        const decision = evaluateBarnetOrderDecision(rawOrder);

        if (decision.classification === "pickup") {
          result.pickupOrdersIgnored += 1;
          bumpExclusion(result, "pickup");
          // Pickups are never stored — do not count toward consecutive-known
          // early stop, or rare deliveries on later pages are skipped.
          continue;
        }

        if (decision.classification === "unknown") {
          result.unknownOrdersIgnored += 1;
          bumpExclusion(result, decision.exclusionReason ?? "unknown_fulfillment");
          consecutiveKnown = 0;
          continue;
        }

        if (!decision.persistable || !decision.externalOrderId) {
          result.invalidOrders += 1;
          bumpExclusion(
            result,
            decision.exclusionReason ?? "malformed_payload",
          );
          consecutiveKnown = 0;
          continue;
        }

        result.deliveryCandidates += 1;
        const externalId = decision.externalOrderId;

        const docRef = db.collection(COLLECTION).doc(barnetDocumentId(externalId));
        const existingSnap = await docRef.get();
        let sourceHash: string;
        try {
          sourceHash = computeBarnetOrderSourceHash(rawOrder, { now });
        } catch {
          result.invalidOrders += 1;
          bumpExclusion(result, "malformed_payload");
          consecutiveKnown = 0;
          continue;
        }

        if (existingSnap.exists) {
          const existing = hydrateNormalizedExternalOrder(
            existingSnap.data() as Record<string, unknown>,
          );
          const storedHash = readStoredBarnetSourceHash(existing);
          if (storedHash === sourceHash) {
            result.unchangedOrders += 1;
            if (existing.needsReview || !existing.dispatchReady) {
              result.needsReview += 1;
            } else {
              result.readyToDispatch += 1;
            }
            consecutiveKnown += 1;
            if (consecutiveKnown >= consecutiveKnownThreshold) {
              stopScanning = true;
              break;
            }
            continue;
          }

          deliveryTasks.push({
            rawOrder,
            sourceHash,
            isNew: false,
            externalOrderId: externalId,
          });
        } else {
          deliveryTasks.push({
            rawOrder,
            sourceHash,
            isNew: true,
            externalOrderId: externalId,
          });
        }

        consecutiveKnown = 0;
      }

      if (deliveryTasks.length > 0) {
        await mapWithConcurrency(
          deliveryTasks,
          enrichmentConcurrency,
          async (task) => {
            try {
              const docRef = db
                .collection(COLLECTION)
                .doc(barnetDocumentId(task.externalOrderId));
              const existingSnap = await docRef.get();
              const existingData = existingSnap.exists
                ? hydrateNormalizedExternalOrder(
                    existingSnap.data() as Record<string, unknown>,
                  )
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
                deepOmitUndefined(toStore as unknown as Record<string, unknown>),
              );

              if (task.isNew) {
                result.newDeliveries += 1;
              } else {
                result.updatedDeliveries += 1;
              }

              if (toStore.needsReview || !toStore.dispatchReady) {
                result.needsReview += 1;
              } else {
                result.readyToDispatch += 1;
              }
            } catch (orderErr) {
              result.enrichmentErrors += 1;
              result.syncErrors += 1;
              console.warn(
                `[order-provider] order sync failed for externalId=${task.externalOrderId}: ${
                  orderErr instanceof Error ? orderErr.message : "unknown"
                }`,
              );
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

  console.info(
    `[order-provider] live sync complete: pages=${result.pagesScanned} seen=${result.ordersSeen} delivery=${result.deliveryCandidates} new=${result.newDeliveries} updated=${result.updatedDeliveries} unchanged=${result.unchangedOrders} needsReview=${result.needsReview} ready=${result.readyToDispatch} enrichmentErrors=${result.enrichmentErrors}`,
  );

  return result;
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
    unchangedOrders: run.unchangedOrders,
    needsReview: run.needsReview,
    readyToDispatch: run.readyToDispatch,
    invalidOrders: run.invalidOrders,
    enrichmentErrors: run.enrichmentErrors,
    syncErrors: run.syncErrors,
    exclusionReasons: run.exclusionReasons,
  };
}
