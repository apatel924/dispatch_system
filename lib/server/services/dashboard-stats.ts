import { getAppTimeZone, todayLocalDayKey } from "@/lib/app-timezone";
import {
  ACTIVE_DELIVERY_ORDER_STATUSES,
  AWAITING_ASSIGNMENT_ORDER_STATUSES,
  NEW_ORDER_STATUSES,
} from "@/lib/order-status-groups";
import { isDriverAvailable, isDriverBusy } from "@/lib/delivery-metrics";
import { isOnActiveRoster } from "@/lib/driver-status";
import { COLLECTIONS } from "@/lib/server/firestore/collections";
import { countQuery } from "@/lib/server/firestore/count";
import { docToDriver } from "@/lib/server/firestore/helpers";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { countTerminalOutcomesForLocalDay } from "@/lib/server/services/order-reporting-queries";

export interface DashboardStats {
  timeZone: string;
  today: string;
  newOrders: number;
  awaitingAssignment: number;
  activeDeliveries: number;
  completedToday: number;
  failedToday: number;
  returnedToday: number;
  failedReturnedToday: number;
  availableDrivers: number;
  busyDrivers: number;
  totalActiveDrivers: number;
  dataCoverage: {
    complete: boolean;
    legacyFallbackCount: number;
    message?: string;
  };
}

async function countOrdersByStatusIn(
  statuses: readonly string[],
): Promise<number> {
  const db = getAdminFirestore();
  return countQuery(
    db.collection(COLLECTIONS.orders).where("status", "in", [...statuses]),
  );
}

async function countNewOrders(): Promise<number> {
  const db = getAdminFirestore();
  return countQuery(
    db.collection(COLLECTIONS.orders).where("status", "==", NEW_ORDER_STATUSES[0]),
  );
}

async function countAwaitingAssignment(): Promise<number> {
  const db = getAdminFirestore();
  return countQuery(
    db
      .collection(COLLECTIONS.orders)
      .where("assignedDriverId", "==", null)
      .where("status", "in", [...AWAITING_ASSIGNMENT_ORDER_STATUSES]),
  );
}

async function countActiveDeliveries(): Promise<number> {
  return countOrdersByStatusIn(ACTIVE_DELIVERY_ORDER_STATUSES);
}

async function countDriverAvailability(): Promise<{
  availableDrivers: number;
  busyDrivers: number;
  totalActiveDrivers: number;
}> {
  const db = getAdminFirestore();
  const [driversSnap, activeOrdersSnap] = await Promise.all([
    db.collection(COLLECTIONS.drivers).get(),
    db
      .collection(COLLECTIONS.orders)
      .where("status", "in", [...ACTIVE_DELIVERY_ORDER_STATUSES])
      .get(),
  ]);

  const activeDeliveriesByDriver = new Map<string, number>();
  for (const doc of activeOrdersSnap.docs) {
    const driverId = doc.data().assignedDriverId as string | null | undefined;
    if (!driverId) continue;
    activeDeliveriesByDriver.set(
      driverId,
      (activeDeliveriesByDriver.get(driverId) ?? 0) + 1,
    );
  }

  let availableDrivers = 0;
  let busyDrivers = 0;
  let totalActiveDrivers = 0;

  for (const doc of driversSnap.docs) {
    const driver = docToDriver(doc.id, doc.data());
    if (!isOnActiveRoster(driver.status)) continue;

    totalActiveDrivers += 1;
    const activeCount = activeDeliveriesByDriver.get(driver.id) ?? 0;

    if (isDriverAvailable(driver.status, activeCount)) {
      availableDrivers += 1;
    } else if (isDriverBusy(driver.status, activeCount)) {
      busyDrivers += 1;
    }
  }

  return { availableDrivers, busyDrivers, totalActiveDrivers };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const timeZone = getAppTimeZone();
  const today = todayLocalDayKey(new Date(), timeZone);

  const [
    newOrders,
    awaitingAssignment,
    activeDeliveries,
    terminalCounts,
    driverCounts,
  ] = await Promise.all([
    countNewOrders(),
    countAwaitingAssignment(),
    countActiveDeliveries(),
    countTerminalOutcomesForLocalDay(today, timeZone),
    countDriverAvailability(),
  ]);

  const dataCoverage =
    terminalCounts.legacyFallbackCount === 0
      ? { complete: true, legacyFallbackCount: 0 }
      : {
          complete: false,
          legacyFallbackCount: terminalCounts.legacyFallbackCount,
          message: `${terminalCounts.legacyFallbackCount} today count(s) rely on legacy updatedAt fallbacks.`,
        };

  return {
    timeZone,
    today,
    newOrders,
    awaitingAssignment,
    activeDeliveries,
    completedToday: terminalCounts.completedToday,
    failedToday: terminalCounts.failedToday,
    returnedToday: terminalCounts.returnedToday,
    failedReturnedToday: terminalCounts.failedToday + terminalCounts.returnedToday,
    availableDrivers: driverCounts.availableDrivers,
    busyDrivers: driverCounts.busyDrivers,
    totalActiveDrivers: driverCounts.totalActiveDrivers,
    dataCoverage,
  };
}
