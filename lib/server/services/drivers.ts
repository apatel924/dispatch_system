import { FieldValue } from "firebase-admin/firestore";
import type { DriverProfile, OrderStatus } from "@/lib/types/backend";
import type { AuthUser } from "@/lib/server/auth";
import { notFoundError, ServiceError } from "@/lib/server/errors";
import { isDriverUnavailable, resolveStoredDriverStatus } from "@/lib/driver-status";
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
  AdminUpdateDriverInput,
  CreateDriverInput,
  DriverSelfUpdateInput,
  ListDriversQuery,
} from "@/lib/server/validation/drivers";
import {
  ACTIVE_ORDER_STATUSES,
  aggregateDriverMetricsFromOrders,
  emptyDriverOrderMetrics,
  type DriverOrderMetrics,
} from "@/lib/delivery-metrics";
import { TERMINAL_ORDER_STATUSES } from "@/lib/order-status-groups";

/** Statuses fetched in one query when batch-computing driver metrics. */
const METRIC_ORDER_STATUSES: OrderStatus[] = [
  ...ACTIVE_ORDER_STATUSES,
  ...TERMINAL_ORDER_STATUSES,
];

export type DriverMetrics = Pick<
  DriverOrderMetrics,
  "activeDeliveries" | "completedToday" | "failedToday" | "averageDeliveryTimeMs"
> & {
  totalDeliveries: number;
  successRate: number | null;
};

function metricsToDriverFields(metrics: DriverOrderMetrics): DriverMetrics {
  const terminal = metrics.successfulDeliveries + metrics.failedDeliveries;
  return {
    activeDeliveries: metrics.activeDeliveries,
    completedToday: metrics.completedToday,
    failedToday: metrics.failedToday,
    averageDeliveryTimeMs: metrics.averageDeliveryTimeMs,
    totalDeliveries: metrics.totalDeliveries,
    successRate:
      terminal > 0
        ? Math.round((metrics.successfulDeliveries / terminal) * 1000) / 10
        : null,
  };
}

function emptyDriverMetrics(): DriverMetrics {
  const base = emptyDriverOrderMetrics();
  return metricsToDriverFields(base);
}

export async function computeDriverMetrics(driverId: string): Promise<DriverMetrics> {
  const metrics = await computeDriverMetricsBatch([driverId]);
  return metrics.get(driverId) ?? emptyDriverMetrics();
}

/**
 * Compute delivery metrics for many drivers with a single Firestore read on
 * orders (status in active + delivered + failed), then aggregate in memory.
 */
export async function computeDriverMetricsBatch(
  driverIds: Iterable<string>,
): Promise<Map<string, DriverMetrics>> {
  const ids = [...driverIds];
  const result = new Map<string, DriverMetrics>();
  for (const id of ids) {
    result.set(id, emptyDriverMetrics());
  }

  if (ids.length === 0) return result;

  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.orders)
    .where("status", "in", METRIC_ORDER_STATUSES)
    .get();

  const orders = snap.docs.map((doc) => docToOrder(doc.id, doc.data()));

  const aggregated = aggregateDriverMetricsFromOrders(orders, ids);
  for (const [driverId, metrics] of aggregated) {
    result.set(driverId, metricsToDriverFields(metrics));
  }

  return result;
}

function applyMetrics(
  driver: DriverProfile,
  metricsMap: Map<string, DriverMetrics>,
): DriverProfile {
  const metrics = metricsMap.get(driver.id) ?? emptyDriverMetrics();
  return {
    ...driver,
    activeDeliveries: metrics.activeDeliveries,
    completedToday: metrics.completedToday,
    failedToday: metrics.failedToday,
    averageDeliveryTimeMs: metrics.averageDeliveryTimeMs ?? undefined,
    totalDeliveries: metrics.totalDeliveries,
    successRate: metrics.successRate ?? undefined,
    // Never surface stored mock ratings when computing live metrics.
    rating: undefined,
  };
}

/** Sanitized driver DTO returned from admin APIs. */
export function toDriverDto(driver: DriverProfile): DriverProfile {
  return {
    ...driver,
    rating: undefined,
  };
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
  for (const field of ["authUid", "userId"] as const) {
    const snap = await db
      .collection(COLLECTIONS.drivers)
      .where(field, "==", userId)
      .limit(1)
      .get();

    if (!snap.empty) {
      const doc = snap.docs[0];
      const driver = docToDriver(doc.id, doc.data());
      const metricsMap = await computeDriverMetricsBatch([driver.id]);
      return applyMetrics(driver, metricsMap);
    }
  }

  return null;
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

  const metricsMap = await computeDriverMetricsBatch(drivers.map((d) => d.id));
  drivers = drivers.map((driver) => applyMetrics(driver, metricsMap));

  if (query.search) {
    drivers = drivers.filter((d) => matchesDriverSearch(d, query.search!));
  }

  const hasMore = drivers.length > query.limit;
  const page = hasMore ? drivers.slice(0, query.limit) : drivers;

  return {
    drivers: page.map(toDriverDto),
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
    authUid: input.userId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    status: input.status ?? "Inactive",
    vehicle: input.vehicle ?? undefined,
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

export async function updateDriverAdmin(
  id: string,
  input: AdminUpdateDriverInput,
  actor: AuthUser,
): Promise<DriverProfile> {
  const { acknowledgeActiveAssignments, ...fields } = input;
  const existing = await getDriverById(id);

  if (
    fields.status &&
    isDriverUnavailable(fields.status) &&
    existing.activeDeliveries > 0 &&
    !acknowledgeActiveAssignments
  ) {
    throw new ServiceError(
      `This driver has ${existing.activeDeliveries} active assignment(s). Confirm to deactivate while keeping those orders assigned.`,
      "ACTIVE_ASSIGNMENTS",
      409,
    );
  }

  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.drivers).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw notFoundError("Driver", id);

  const patch: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedByUid: actor.uid,
  };

  if (fields.name !== undefined) {
    patch.name = fields.name;
    patch.initials = initialsFromName(fields.name);
  }
  if (fields.phone !== undefined) patch.phone = fields.phone;
  if (fields.vehicle !== undefined) {
    patch.vehicle = fields.vehicle === null ? FieldValue.delete() : fields.vehicle;
  }
  if (fields.adminNote !== undefined) {
    patch.adminNote = fields.adminNote === null ? FieldValue.delete() : fields.adminNote;
  }
  if (fields.status !== undefined) {
    patch.status = resolveStoredDriverStatus(fields.status, existing.activeDeliveries);
  }

  await ref.update(patch);

  await writeAuditLog({
    action: "driver.update",
    entityType: "driver",
    entityId: id,
    actorId: actor.uid,
    actorRole: actor.role,
    metadata: { fields: Object.keys(fields) },
  });

  return toDriverDto(await getDriverById(id));
}

export async function updateDriverSelf(
  id: string,
  input: DriverSelfUpdateInput,
  actor: AuthUser,
): Promise<DriverProfile> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.drivers).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw notFoundError("Driver", id);

  const existing = await getDriverById(id);
  const patch: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedByUid: actor.uid,
  };

  if (input.name !== undefined) {
    patch.name = input.name;
    patch.initials = initialsFromName(input.name);
  }
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.email !== undefined) patch.email = input.email;
  if (input.avatarColor !== undefined) patch.avatarColor = input.avatarColor;
  if (input.vehicle !== undefined) {
    patch.vehicle = input.vehicle === null ? FieldValue.delete() : input.vehicle;
  }
  if (input.status !== undefined) {
    patch.status = resolveStoredDriverStatus(input.status, existing.activeDeliveries);
  }

  await ref.update(patch);

  await writeAuditLog({
    action: "driver.update",
    entityType: "driver",
    entityId: id,
    actorId: actor.uid,
    actorRole: actor.role,
    metadata: { fields: Object.keys(input) },
  });

  return toDriverDto(await getDriverById(id));
}

export function assertDriverAssignable(driver: DriverProfile): void {
  if (driver.status !== "Available" && driver.status !== "Busy") {
    throw new ServiceError(
      `${driver.name} is ${driver.status} and cannot receive new assignments.`,
      "DRIVER_UNAVAILABLE",
      409,
    );
  }
}

/** Shared validation for assignDriver and createOrder with assignedDriverId. */
export function validateDriverForAssignment(driver: DriverProfile): void {
  if (driver.accountDisabled) {
    throw new ServiceError(
      "This driver's login account is disabled. Re-enable account access before assigning orders.",
      "DRIVER_ACCOUNT_DISABLED",
      409,
    );
  }
  assertDriverAssignable(driver);
}
