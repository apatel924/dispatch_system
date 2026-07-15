import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { deepOmitUndefined } from "@/lib/server/firestore/helpers";
import type { AuthUser } from "@/lib/server/auth";
import type { ActorContext } from "@/lib/server/services/orders";
import type { BarnetFetchRetryOptions } from "@/lib/integrations/order-provider/barnet-client.server";
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
  assertBarnetExecutionBudgetForAttempt,
  createBarnetExecutionBudget,
  getBarnetExecutionRemainingMs,
} from "@/lib/integrations/order-provider/barnet-execution-budget.server";
import { getBarnetEnrichmentConcurrency } from "@/lib/integrations/order-provider/barnet-sync-config.server";
import {
  buildPageBatchDiagnostics,
  classifyBarnetFetchError,
  BarnetSyncFailureError,
  type PageBatchDiagnostics,
  type PageFetchOutcomeDiagnostics,
} from "@/lib/integrations/order-provider/barnet-sync-errors.server";
import {
  computeBarnetOrderSourceHash,
  readStoredBarnetSourceHash,
} from "@/lib/integrations/order-provider/barnet-sync-hash.server";
import { assertLiveSyncAllowed } from "@/lib/integrations/order-provider/env.server";
import { getExternalOrderProviderConfig } from "@/lib/integrations/order-provider/env.server";
import { finalizeBarnetDeliveryImport } from "@/lib/integrations/order-provider/finalize-barnet-import.server";
import { hydrateNormalizedExternalOrder } from "@/lib/integrations/order-provider/external-order-intake";
import { mapWithConcurrency } from "@/lib/integrations/order-provider/map-with-concurrency.server";
import {
  barnetDocumentId,
  normalizeBarnetOrder,
} from "@/lib/integrations/order-provider/normalize-barnet-order";
import {
  getExternalOrderSyncPageConcurrencyConfig,
  getExternalOrderSyncPaginationConfig,
} from "@/lib/integrations/order-provider/sync-pagination.server";
import type { ExternalOrderSyncResult } from "@/lib/integrations/order-provider/types";
import { isBarnetUpstreamTimeoutError } from "@/lib/integrations/order-provider/barnet-client.server";

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
  /** Newly created (or reconciled) unassigned dispatch orders. */
  dispatchOrdersCreated: number;
  adminNotificationsCreated: number;
  exclusionReasons: Record<string, number>;
  failedPages: number[];
  pageFetchErrors: number;
  pageBatchDiagnostics?: PageBatchDiagnostics;
}

export interface RunBarnetOrderSyncOptions {
  trigger?: "cron" | "manual";
  actor?: AuthUser | ActorContext | null;
  /** Invoked after each page-fetch batch (for lease heartbeat / logging). */
  onPageBatchComplete?: (info: {
    pagesCompleted: number;
    batchSize: number;
    durationMs: number;
    failedPages: number[];
    pageBatchDiagnostics: PageBatchDiagnostics;
  }) => Promise<void> | void;
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

interface PageFetchOutcome {
  page: number;
  orders: BarnetOrderRaw[] | null;
  diagnostics: PageFetchOutcomeDiagnostics;
}

function buildRetryOptions(
  budget: ReturnType<typeof createBarnetExecutionBudget>,
  attemptsUsed: { count: number },
): BarnetFetchRetryOptions {
  return {
    getRemainingBudgetMs: () => getBarnetExecutionRemainingMs(budget),
    cleanupBufferMs: budget.cleanupBufferMs,
    attemptsUsed,
  };
}

async function fetchPageWithDiagnostics(
  page: number,
  itemsPerPage: number,
  budget: ReturnType<typeof createBarnetExecutionBudget>,
): Promise<PageFetchOutcome> {
  const startedAtMs = Date.now();
  const attemptsUsed = { count: 0 };

  try {
    assertBarnetExecutionBudgetForAttempt(budget);
    const orders = await fetchBarnetOrders(
      { page, itemsOnPage: itemsPerPage },
      buildRetryOptions(budget, attemptsUsed),
    );
    return {
      page,
      orders,
      diagnostics: {
        page,
        success: true,
        timedOut: false,
        attempts: attemptsUsed.count || 1,
        durationMs: Date.now() - startedAtMs,
      },
    };
  } catch (error) {
    const failureCode = classifyBarnetFetchError(error);
    return {
      page,
      orders: null,
      diagnostics: {
        page,
        success: false,
        timedOut:
          failureCode === "provider_timeout" ||
          isBarnetUpstreamTimeoutError(error),
        attempts: attemptsUsed.count || 1,
        durationMs: Date.now() - startedAtMs,
        failureCode,
      },
    };
  }
}

function throwPageFetchFailure(
  diagnostics: PageBatchDiagnostics,
  primaryCode?: PageFetchOutcomeDiagnostics["failureCode"],
): never {
  const code =
    primaryCode ??
    diagnostics.pageOutcomes.find((outcome) => !outcome.success)?.failureCode ??
    "unknown_sync_error";
  throw new BarnetSyncFailureError(
    code,
    `Barnet page fetch failed for page(s): ${diagnostics.failedPages.join(", ")}`,
    { pageBatchDiagnostics: diagnostics },
  );
}

/**
 * Incremental Barnet live sync:
 * - probes page 1 alone before any concurrent batch
 * - classifies pickup vs delivery before enrichment (shared decision helper)
 * - persists reviewable deliveries even when not dispatch-ready
 * - enriches only new or changed delivery orders
 * - scans configured pages with bounded concurrency after the probe
 * - promotes newly imported deliveries to unassigned dispatch orders
 */
export async function runBarnetOrderSync(
  options?: RunBarnetOrderSyncOptions,
): Promise<BarnetOrderSyncRunResult> {
  assertLiveSyncAllowed();

  const trigger = options?.trigger ?? "manual";
  const actor = options?.actor ?? null;
  const config = getExternalOrderProviderConfig();
  const locationId = config.locationId;
  const pagination = getExternalOrderSyncPaginationConfig();
  const concurrencyConfig = getExternalOrderSyncPageConcurrencyConfig();
  const pageConcurrency = concurrencyConfig.effectiveConcurrency;
  const enrichmentConcurrency = getBarnetEnrichmentConcurrency();
  const syncStartedAtMs = Date.now();
  const executionBudget = createBarnetExecutionBudget(syncStartedAtMs);
  const allPageOutcomes: PageFetchOutcomeDiagnostics[] = [];

  console.info(
    `[order-provider] sync tuning requestedConcurrency=${concurrencyConfig.requestedConcurrency} effectiveConcurrency=${pageConcurrency}`,
  );

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
    dispatchOrdersCreated: 0,
    adminNotificationsCreated: 0,
    exclusionReasons: {},
    failedPages: [],
    pageFetchErrors: 0,
  };

  const pageNumbers = Array.from(
    { length: pagination.pages },
    (_, index) => index + 1,
  );

  let stopAfterEmptyPage = false;

  async function processPageOutcome(outcome: PageFetchOutcome): Promise<boolean> {
    if (outcome.diagnostics.success === false || !outcome.orders) {
      result.pageFetchErrors += 1;
      result.failedPages.push(outcome.page);
      result.syncErrors += 1;
      console.warn(
        `[order-provider] page fetch failed page=${outcome.page} code=${outcome.diagnostics.failureCode ?? "unknown"} attempts=${outcome.diagnostics.attempts} durationMs=${outcome.diagnostics.durationMs}`,
      );
      return false;
    }

    const orders = outcome.orders;
    result.pagesScanned += 1;

    if (orders.length === 0) {
      console.info(
        `[order-provider] sync stopping early: page ${outcome.page} returned 0 orders`,
      );
      return false;
    }

    const deliveryTasks: DeliverySyncTask[] = [];

    for (const rawOrder of orders) {
      result.ordersSeen += 1;

      const decision = evaluateBarnetOrderDecision(rawOrder);

      if (decision.classification === "pickup") {
        result.pickupOrdersIgnored += 1;
        bumpExclusion(result, "pickup");
        continue;
      }

      if (decision.classification === "unknown") {
        result.unknownOrdersIgnored += 1;
        bumpExclusion(result, decision.exclusionReason ?? "unknown_fulfillment");
        continue;
      }

      if (!decision.persistable || !decision.externalOrderId) {
        result.invalidOrders += 1;
        bumpExclusion(
          result,
          decision.exclusionReason ?? "malformed_payload",
        );
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

          if (!existing.promoted) {
            const finalize = await finalizeBarnetDeliveryImport({
              docId: barnetDocumentId(externalId),
              externalOrderId: externalId,
              externalOrderNumber: existing.externalOrderNumber,
              isNew: false,
              trigger,
              actor,
            });
            if (finalize.failed) {
              result.syncErrors += 1;
            } else if (!finalize.alreadyPromoted && finalize.dispatchOrderId) {
              result.dispatchOrdersCreated += 1;
            }
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
                assignedDriverId: null,
                assignedDriverName: null,
                assignedAt: null,
                assignedBy: null,
                assignmentStatus: existingData?.assignmentStatus === "assigned"
                  ? "assigned"
                  : "unassigned",
              },
              existingData,
            );

            if (task.isNew) {
              toStore.assignmentStatus = "unassigned";
              toStore.assignedDriverId = null;
              toStore.assignedDriverName = null;
              toStore.assignedAt = null;
              toStore.assignedBy = null;
            }

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

            const shouldPromote = task.isNew || !toStore.promoted;
            if (shouldPromote) {
              const finalize = await finalizeBarnetDeliveryImport({
                docId: barnetDocumentId(task.externalOrderId),
                externalOrderId: task.externalOrderId,
                externalOrderNumber: toStore.externalOrderNumber,
                isNew: task.isNew,
                trigger,
                actor,
              });
              if (finalize.failed) {
                result.syncErrors += 1;
              } else {
                if (!finalize.alreadyPromoted && finalize.dispatchOrderId) {
                  result.dispatchOrdersCreated += 1;
                }
                if (finalize.notificationCreated) {
                  result.adminNotificationsCreated += 1;
                }
              }
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

    return true;
  }

  async function finalizeBatch(
    batchOutcomes: PageFetchOutcome[],
    batchStartedAtMs: number,
  ): Promise<void> {
    const diagnostics = buildPageBatchDiagnostics(
      batchOutcomes.map((outcome) => outcome.diagnostics),
      Date.now() - batchStartedAtMs,
    );
    result.pageBatchDiagnostics = diagnostics;
    allPageOutcomes.push(...diagnostics.pageOutcomes);

    if (options?.onPageBatchComplete) {
      await options.onPageBatchComplete({
        pagesCompleted: result.pagesScanned,
        batchSize: batchOutcomes.length,
        durationMs: Date.now() - syncStartedAtMs,
        failedPages: [...result.failedPages],
        pageBatchDiagnostics: diagnostics,
      });
    }
  }

  // Phase 1: page-1 provider-health probe (never concurrent with other pages).
  const probeBatchStartedAtMs = Date.now();
  const probeOutcome = await fetchPageWithDiagnostics(
    1,
    pagination.itemsPerPage,
    executionBudget,
  );

  if (!probeOutcome.diagnostics.success) {
    const probeDiagnostics = buildPageBatchDiagnostics(
      [probeOutcome.diagnostics],
      Date.now() - probeBatchStartedAtMs,
    );
    result.pageBatchDiagnostics = probeDiagnostics;
    result.failedPages = [...probeDiagnostics.failedPages];
    result.pageFetchErrors = probeDiagnostics.failedPages.length;
    await finalizeBatch([probeOutcome], probeBatchStartedAtMs);
    throwPageFetchFailure(probeDiagnostics, probeOutcome.diagnostics.failureCode);
  }

  const probeProcessed = await processPageOutcome(probeOutcome);
  if (!probeProcessed) {
    stopAfterEmptyPage = true;
  }
  await finalizeBatch([probeOutcome], probeBatchStartedAtMs);

  // Phase 2: remaining pages in bounded concurrent batches (page 1 is not refetched).
  const remainingPages = pageNumbers.slice(1);
  for (
    let batchStart = 0;
    batchStart < remainingPages.length && !stopAfterEmptyPage;
    batchStart += pageConcurrency
  ) {
    const batch = remainingPages.slice(batchStart, batchStart + pageConcurrency);
    const batchStartedAtMs = Date.now();

    const batchOutcomes = await mapWithConcurrency(
      batch,
      pageConcurrency,
      async (page) =>
        fetchPageWithDiagnostics(page, pagination.itemsPerPage, executionBudget),
    );
    batchOutcomes.sort((a, b) => a.page - b.page);

    let batchFailed = false;
    for (const outcome of batchOutcomes) {
      if (stopAfterEmptyPage || batchFailed) {
        break;
      }

      if (!outcome.diagnostics.success) {
        batchFailed = true;
        console.warn(
          `[order-provider] page fetch failed page=${outcome.page} code=${outcome.diagnostics.failureCode ?? "unknown"} attempts=${outcome.diagnostics.attempts} durationMs=${outcome.diagnostics.durationMs}`,
        );
        continue;
      }

      const processed = await processPageOutcome(outcome);
      if (!processed) {
        stopAfterEmptyPage = true;
        break;
      }
    }

    if (batchFailed) {
      for (const outcome of batchOutcomes) {
        if (!outcome.diagnostics.success) {
          if (!result.failedPages.includes(outcome.page)) {
            result.failedPages.push(outcome.page);
            result.pageFetchErrors += 1;
            result.syncErrors += 1;
          }
        }
      }
      result.failedPages.sort((a, b) => a - b);
    }

    await finalizeBatch(batchOutcomes, batchStartedAtMs);

    if (batchFailed) {
      const cumulativeDiagnostics = buildPageBatchDiagnostics(
        allPageOutcomes,
        Date.now() - syncStartedAtMs,
      );
      result.pageBatchDiagnostics = cumulativeDiagnostics;
      throwPageFetchFailure(
        cumulativeDiagnostics,
        batchOutcomes.find((outcome) => !outcome.diagnostics.success)?.diagnostics
          .failureCode,
      );
    }
  }

  console.info(
    `[order-provider] live sync complete: pages=${result.pagesScanned} seen=${result.ordersSeen} delivery=${result.deliveryCandidates} new=${result.newDeliveries} updated=${result.updatedDeliveries} unchanged=${result.unchangedOrders} needsReview=${result.needsReview} ready=${result.readyToDispatch} dispatchCreated=${result.dispatchOrdersCreated} enrichmentErrors=${result.enrichmentErrors}`,
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
