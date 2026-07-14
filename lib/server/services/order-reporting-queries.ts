import type { Order } from "@/lib/types/backend";
import { getAppTimeZone, utcRangeForLocalDayKeys } from "@/lib/app-timezone";
import { orderUsesLegacyReportingTimestamp } from "@/lib/order-timestamps";
import { COLLECTIONS } from "@/lib/server/firestore/collections";
import { docToOrder } from "@/lib/server/firestore/helpers";
import { getAdminFirestore } from "@/lib/server/firebase-admin";

const TERMINAL_STATUSES = ["Delivered", "Failed", "Returned"] as const;

export interface ReportingOrderFetchResult {
  orders: Order[];
  legacyFallbackCount: number;
}

function mergeOrders(
  target: Map<string, Order>,
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
): void {
  for (const doc of docs) {
    target.set(doc.id, docToOrder(doc.id, doc.data()));
  }
}

function isMissingIndexError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? err.code : undefined;
  const message = "message" in err ? String(err.message) : "";
  return (
    code === 9 ||
    code === "failed-precondition" ||
    message.includes("FAILED_PRECONDITION") ||
    message.includes("requires an index")
  );
}

/**
 * Fetch terminal orders whose status-entered timestamps fall in a local-day UTC range.
 * Includes a legacy pass for orders missing dedicated timestamp fields.
 *
 * The legacy `status` + `updatedAt` query needs a composite index. If that index is
 * missing, continue with dedicated timestamp queries so dashboard/reports stay up.
 */
export async function fetchTerminalOrdersInUtcRange(
  startUtcIso: string,
  endExclusiveUtcIso: string,
): Promise<ReportingOrderFetchResult> {
  const db = getAdminFirestore();

  const [deliveredSnap, failedSnap, returnedSnap] = await Promise.all([
    db
      .collection(COLLECTIONS.orders)
      .where("deliveredAt", ">=", startUtcIso)
      .where("deliveredAt", "<", endExclusiveUtcIso)
      .get(),
    db
      .collection(COLLECTIONS.orders)
      .where("failedAt", ">=", startUtcIso)
      .where("failedAt", "<", endExclusiveUtcIso)
      .get(),
    db
      .collection(COLLECTIONS.orders)
      .where("returnedAt", ">=", startUtcIso)
      .where("returnedAt", "<", endExclusiveUtcIso)
      .get(),
  ]);

  const byId = new Map<string, Order>();
  mergeOrders(byId, deliveredSnap.docs);
  mergeOrders(byId, failedSnap.docs);
  mergeOrders(byId, returnedSnap.docs);

  let legacyDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  try {
    const legacySnap = await db
      .collection(COLLECTIONS.orders)
      .where("status", "in", [...TERMINAL_STATUSES])
      .where("updatedAt", ">=", startUtcIso)
      .where("updatedAt", "<", endExclusiveUtcIso)
      .get();
    legacyDocs = legacySnap.docs;
  } catch (err) {
    if (isMissingIndexError(err)) {
      console.warn(
        "[order-reporting] Skipping legacy updatedAt fallback — deploy orders(status, updatedAt) index.",
      );
    } else {
      throw err;
    }
  }

  let legacyFallbackCount = 0;
  for (const doc of legacyDocs) {
    const order = docToOrder(doc.id, doc.data());
    if (byId.has(order.id)) continue;
    if (!orderUsesLegacyReportingTimestamp(order)) continue;
    byId.set(order.id, order);
    legacyFallbackCount += 1;
  }

  return { orders: [...byId.values()], legacyFallbackCount };
}

/** Fetch terminal orders for an inclusive local calendar day range. */
export async function fetchTerminalOrdersForLocalDayRange(
  fromDayKey: string,
  toDayKey: string,
  timeZone = getAppTimeZone(),
): Promise<ReportingOrderFetchResult> {
  const { startUtcIso, endExclusiveUtcIso } = utcRangeForLocalDayKeys(
    fromDayKey,
    toDayKey,
    timeZone,
  );
  return fetchTerminalOrdersInUtcRange(startUtcIso, endExclusiveUtcIso);
}

export interface TodayTerminalCounts {
  completedToday: number;
  failedToday: number;
  returnedToday: number;
  legacyFallbackCount: number;
}

/** Count terminal outcomes for the current local calendar day in the app timezone. */
export async function countTerminalOutcomesForLocalDay(
  dayKey: string,
  timeZone = getAppTimeZone(),
): Promise<TodayTerminalCounts> {
  const { orders, legacyFallbackCount } = await fetchTerminalOrdersForLocalDayRange(
    dayKey,
    dayKey,
    timeZone,
  );

  let completedToday = 0;
  let failedToday = 0;
  let returnedToday = 0;

  for (const order of orders) {
    if (order.status === "Delivered") completedToday += 1;
    else if (order.status === "Failed") failedToday += 1;
    else if (order.status === "Returned") returnedToday += 1;
  }

  return { completedToday, failedToday, returnedToday, legacyFallbackCount };
}
