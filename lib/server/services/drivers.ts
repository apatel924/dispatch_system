import type { DriverProfile, OrderStatus } from "@/lib/types/backend";
import type { AuthUser } from "@/lib/server/auth";
import { notFoundError } from "@/lib/server/errors";
import { COLLECTIONS } from "@/lib/server/firestore/collections";
import {
  docToDriver,
  docToOrder,
  initialsFromName,
  nowIso,
  omitUndefined,
} from "@/lib/server/firestore/helpers";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { writeAuditLog } from "@/lib/server/services/audit";
import { generateDriverId } from "@/lib/server/firestore/ids";
import type {
  CreateDriverInput,
  ListDriversQuery,
  UpdateDriverInput,
} from "@/lib/server/validation/drivers";

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "Assigned",
  "Picked Up",
  "En Route",
  "Out for Delivery",
  "Scheduled",
];

/** Statuses fetched in one query when batch-computing driver metrics. */
const METRIC_ORDER_STATUSES: OrderStatus[] = [
  ...ACTIVE_ORDER_STATUSES,
  "Delivered",
  "Failed",
];

export interface DriverMetrics {
  activeDeliveries: number;
  completedToday: number;
  failedToday: number;
}

function emptyDriverMetrics(): DriverMetrics {
  return { activeDeliveries: 0, completedToday: 0, failedToday: 0 };
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isOnOrAfterToday(iso?: string): boolean {
  if (!iso) return false;
  return new Date(iso) >= startOfTodayUtc();
}

export async function computeDriverMetrics(driverId: string): Promise<DriverMetrics> {
  const metrics = await computeDriverMetricsBatch([driverId]);
  return metrics.get(driverId) ?? emptyDriverMetrics();
}

/**
 * Compute delivery metrics for many drivers with a single Firestore read on
 * orders (status in active + delivered + failed), then aggregate in memory.
 * Avoids N+1 queries where each driver triggered its own orders lookup.
 */
export async function computeDriverMetricsBatch(
  driverIds: Iterable<string>,
): Promise<Map<string, DriverMetrics>> {
  const metrics = new Map<string, DriverMetrics>();
  for (const id of driverIds) {
    metrics.set(id, emptyDriverMetrics());
  }

  if (metrics.size === 0) return metrics;

  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.orders)
    .where("status", "in", METRIC_ORDER_STATUSES)
    .get();

  for (const doc of snap.docs) {
    const order = docToOrder(doc.id, doc.data());
    const driverId = order.assignedDriverId;
    if (!driverId || !metrics.has(driverId)) continue;

    const row = metrics.get(driverId)!;

    if (ACTIVE_ORDER_STATUSES.includes(order.status)) {
      row.activeDeliveries += 1;
    }
    if (
      order.status === "Delivered" &&
      isOnOrAfterToday(order.deliveredAt ?? order.updatedAt)
    ) {
      row.completedToday += 1;
    }
    if (order.status === "Failed" && isOnOrAfterToday(order.updatedAt)) {
      row.failedToday += 1;
    }
  }

  return metrics;
}

function applyMetrics(
  driver: DriverProfile,
  metricsMap: Map<string, DriverMetrics>,
): DriverProfile {
  return { ...driver, ...(metricsMap.get(driver.id) ?? emptyDriverMetrics()) };
}

export async function getDriverById(id: string): Promise<DriverProfile> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.drivers).doc(id).get();
  if (!snap.exists) throw notFoundError("Driver", id);
  const driver = docToDriver(snap.id, snap.data()!);
  const metricsMap = await computeDriverMetricsBatch([driver.id]);
  return applyMetrics(driver, metricsMap);
}

export async function getDriverByUserId(userId: string): Promise<DriverProfile | null> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.drivers)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  const driver = docToDriver(doc.id, doc.data());
  const metricsMap = await computeDriverMetricsBatch([driver.id]);
  return applyMetrics(driver, metricsMap);
}

function matchesDriverSearch(driver: DriverProfile, search: string): boolean {
  const q = search.toLowerCase();
  return (
    driver.id.toLowerCase().includes(q) ||
    driver.name.toLowerCase().includes(q) ||
    driver.email.toLowerCase().includes(q) ||
    driver.phone.toLowerCase().includes(q)
  );
}

export async function listDrivers(
  query: ListDriversQuery,
): Promise<{ drivers: DriverProfile[]; nextCursor?: string }> {
  const db = getAdminFirestore();
  let ref: FirebaseFirestore.Query = db
    .collection(COLLECTIONS.drivers)
    .orderBy("name", "asc");

  if (query.status) ref = ref.where("status", "==", query.status);

  const fetchLimit = query.search ? 200 : query.limit + 1;

  if (query.cursor) {
    const cursorSnap = await db.collection(COLLECTIONS.drivers).doc(query.cursor).get();
    if (cursorSnap.exists) ref = ref.startAfter(cursorSnap);
  }

  const snap = await ref.limit(fetchLimit).get();
  let drivers = snap.docs.map((doc) => docToDriver(doc.id, doc.data()));

  // One batched orders read for all drivers on this page — not one query per driver.
  const metricsMap = await computeDriverMetricsBatch(drivers.map((d) => d.id));
  drivers = drivers.map((driver) => applyMetrics(driver, metricsMap));

  if (query.search) {
    drivers = drivers.filter((d) => matchesDriverSearch(d, query.search!));
  }

  const hasMore = drivers.length > query.limit;
  const page = hasMore ? drivers.slice(0, query.limit) : drivers;

  return {
    drivers: page,
    nextCursor: hasMore ? page[page.length - 1]?.id : undefined,
  };
}

export async function createDriver(
  input: CreateDriverInput,
  actor: AuthUser,
): Promise<DriverProfile> {
  const db = getAdminFirestore();
  const id = await generateDriverId();
  const now = nowIso();

  const driver: DriverProfile = {
    id,
    userId: input.userId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    status: input.status ?? "Inactive",
    vehicle: input.vehicle,
    avatarColor: input.avatarColor ?? "bg-info-soft text-info",
    initials: initialsFromName(input.name),
    activeDeliveries: 0,
    completedToday: 0,
    failedToday: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.drivers).doc(id).set(driver);

  await writeAuditLog({
    action: "driver.create",
    entityType: "driver",
    entityId: id,
    actorId: actor.uid,
    actorRole: actor.role,
  });

  return driver;
}

export async function updateDriver(
  id: string,
  input: UpdateDriverInput,
  actor: AuthUser,
): Promise<DriverProfile> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.drivers).doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw notFoundError("Driver", id);

  const patch: Record<string, unknown> = omitUndefined({
    ...input,
    updatedAt: nowIso(),
  });

  if (input.name) patch.initials = initialsFromName(input.name);

  await ref.update(patch);

  await writeAuditLog({
    action: "driver.update",
    entityType: "driver",
    entityId: id,
    actorId: actor.uid,
    actorRole: actor.role,
    metadata: { fields: Object.keys(input) },
  });

  return getDriverById(id);
}
