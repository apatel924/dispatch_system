import type { Order, OrderStatus, OrderStatusEvent, UserRole } from "@/lib/types/backend";
import type { AuthUser } from "@/lib/server/auth";
import { notFoundError, ServiceError } from "@/lib/server/errors";
import {
  COLLECTIONS,
  orderDoc,
  orderEventsCollection,
} from "@/lib/server/firestore/collections";
import {
  docToOrder,
  docToStatusEvent,
  formatCentsToDisplay,
  nowIso,
  omitUndefined,
} from "@/lib/server/firestore/helpers";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { generateOrderId } from "@/lib/server/firestore/ids";
import { writeAuditLog } from "@/lib/server/services/audit";
import { getDriverById, validateDriverForAssignment } from "@/lib/server/services/drivers";
import {
  OrderStatusConflict,
  assertOrderStatusTransition,
  canUnassignDriver,
  isPostPickupStatus,
  isTerminalOrderStatus,
  normalizeOrderStatusForRead,
  orderNeedsStatusReview,
  resolveRequestedOrderStatus,
  type OrderStatusActionType,
} from "@/lib/order-status";
import { assertRequiredProofsForDelivery } from "@/lib/server/services/required-proofs";
import { createTrackingLinkForOrder } from "@/lib/server/services/tracking-links";
import { notifyCustomerOrderAssigned } from "@/lib/server/services/notifications";
import type { TrackingLinkNotificationResult } from "@/lib/server/services/notifications";
import type {
  CreateOrderInput,
  DriverOrdersQuery,
  ListOrdersQuery,
  UpdateOrderInput,
} from "@/lib/server/validation/orders";
import type { DeliveryStepKey } from "@/lib/types/backend";

export interface AssignDriverResult {
  order: Order;
  trackingNotification: TrackingLinkNotificationResult;
}

const COMPLETED_STATUSES: OrderStatus[] = ["Delivered", "Failed", "Returned"];

export interface ActorContext {
  uid: string;
  role: UserRole | "system";
}

function actorFromUser(user: AuthUser | ActorContext): ActorContext {
  return { uid: user.uid, role: user.role };
}

function asServiceError(err: unknown): never {
  if (err instanceof OrderStatusConflict) {
    throw new ServiceError(err.message, err.code, err.httpStatus);
  }
  throw err;
}

/** Blocks lifecycle actions until an unrecognized Firestore status is repaired. */
function assertOrderStatusActionable(order: Order): void {
  if (orderNeedsStatusReview(order)) {
    throw new ServiceError(
      "Order status needs review before lifecycle actions",
      "STATUS_NEEDS_REVIEW",
      409,
    );
  }
}

export async function addStatusEvent(
  orderId: string,
  status: OrderStatus,
  actor: ActorContext,
  options?: {
    stepKey?: DeliveryStepKey;
    note?: string;
    previousStatus?: OrderStatus;
    actionType?: OrderStatusActionType;
  },
): Promise<OrderStatusEvent> {
  const db = getAdminFirestore();
  const ref = orderEventsCollection(db, orderId).doc();
  const createdAt = nowIso();

  const event: Omit<OrderStatusEvent, "id"> = {
    orderId,
    status,
    previousStatus: options?.previousStatus,
    actionType: options?.actionType ?? "status_transition",
    stepKey: options?.stepKey,
    note: options?.note,
    actorId: actor.uid,
    actorRole: actor.role,
    createdAt,
  };

  await ref.set(omitUndefined(event));
  return { id: ref.id, ...event };
}

export async function getStatusEvents(orderId: string): Promise<OrderStatusEvent[]> {
  const db = getAdminFirestore();
  const snap = await orderEventsCollection(db, orderId)
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map((doc) => docToStatusEvent(doc.id, doc.data()));
}

export async function createOrder(
  input: CreateOrderInput,
  actor: AuthUser | ActorContext,
): Promise<Order> {
  const db = getAdminFirestore();
  const id = await generateOrderId();
  const trackingId = input.trackingId ?? id;
  const now = nowIso();
  const act = actorFromUser(actor);

  let assignedDriverId: string | null = input.assignedDriverId ?? null;
  let assignedDriverName: string | null = null;
  let assignedAt: string | undefined;
  let status: OrderStatus = "New";

  if (assignedDriverId) {
    const driver = await getDriverById(assignedDriverId);
    validateDriverForAssignment(driver);
    assignedDriverName = driver.name;
    assignedAt = now;
    status = "Assigned";
  }

  const order: Order = {
    id,
    trackingId,
    externalProvider: input.externalProvider,
    externalOrderId: input.externalOrderId,
    externalOrderNumber: input.externalOrderNumber,
    externalOrderRef: input.externalOrderRef,
    promotedAt: input.promotedAt,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    companyName: input.companyName,
    pickupName: input.pickupName,
    pickupAddress: input.pickupAddress,
    deliveryAddress: input.deliveryAddress,
    deliveryUnit: input.deliveryUnit,
    deliveryArea: input.deliveryArea,
    deliveryInstructions: input.deliveryInstructions,
    deliveryWindow: input.deliveryWindow,
    assignedDriverId,
    assignedDriverName,
    assignedAt,
    status,
    paymentStatus: input.paymentStatus ?? "Pending",
    paymentMethod: input.paymentMethod,
    subtotalCents: input.subtotalCents,
    deliveryFeeCents: input.deliveryFeeCents,
    taxCents: input.taxCents,
    totalCents: input.totalCents,
    totalDisplay: formatCentsToDisplay(input.totalCents),
    eta: input.eta,
    notes: input.notes,
    completedSteps: [],
    createdAt: now,
    updatedAt: now,
    scheduledFor: input.scheduledFor,
    createdBy: act.uid,
    source: input.source ?? "manual",
  };

  await orderDoc(db, id).set(omitUndefined(order as unknown as Record<string, unknown>));
  await addStatusEvent(id, status, act, { note: "Order created" });

  const trackingLink = await createTrackingLinkForOrder(id, trackingId);
  await orderDoc(db, id).update(
    omitUndefined({
      trackingLinkVersion: trackingLink.version,
      trackingLinkIssuedAt: trackingLink.createdAt,
      updatedAt: nowIso(),
    }),
  );
  order.trackingLinkVersion = trackingLink.version;
  order.trackingLinkIssuedAt = trackingLink.createdAt;

  if (assignedDriverId) {
    await notifyCustomerOrderAssigned(order);
  }

  await writeAuditLog({
    action: "order.create",
    entityType: "order",
    entityId: id,
    actorId: act.uid,
    actorRole: act.role,
  });

  return order;
}

export async function getOrderById(id: string): Promise<Order> {
  const db = getAdminFirestore();
  const snap = await orderDoc(db, id).get();
  if (!snap.exists) throw notFoundError("Order", id);
  return docToOrder(snap.id, snap.data()!);
}

export async function findOrderByExternalReference(params: {
  externalProvider: string;
  externalOrderId: string;
}): Promise<Order | null> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.orders)
    .where("externalProvider", "==", params.externalProvider)
    .where("externalOrderId", "==", params.externalOrderId)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return docToOrder(doc.id, doc.data());
}

export async function findOrderByExternalOrderRef(
  externalOrderRef: string,
): Promise<Order | null> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.orders)
    .where("externalOrderRef", "==", externalOrderRef)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return docToOrder(doc.id, doc.data());
}

function matchesSearch(order: Order, search: string): boolean {
  const q = search.toLowerCase();
  return (
    order.id.toLowerCase().includes(q) ||
    order.trackingId.toLowerCase().includes(q) ||
    order.customerName.toLowerCase().includes(q) ||
    order.customerPhone.toLowerCase().includes(q) ||
    (order.assignedDriverName?.toLowerCase().includes(q) ?? false) ||
    order.deliveryAddress.toLowerCase().includes(q) ||
    (order.externalOrderId?.toLowerCase().includes(q) ?? false)
  );
}

function matchesDateRange(order: Order, dateFrom?: string, dateTo?: string): boolean {
  if (dateFrom && order.createdAt < dateFrom) return false;
  if (dateTo && order.createdAt > dateTo) return false;
  return true;
}

export async function listOrders(
  query: ListOrdersQuery,
): Promise<{ orders: Order[]; total: number; nextCursor?: string }> {
  const db = getAdminFirestore();
  let ref: FirebaseFirestore.Query = db
    .collection(COLLECTIONS.orders)
    .orderBy("createdAt", "desc");

  if (query.status) ref = ref.where("status", "==", query.status);
  if (query.driverId) ref = ref.where("assignedDriverId", "==", query.driverId);
  if (query.payment) ref = ref.where("paymentStatus", "==", query.payment);

  const fetchLimit = query.search || query.dateFrom || query.dateTo ? 200 : query.limit + 1;

  if (query.cursor) {
    const cursorSnap = await orderDoc(db, query.cursor).get();
    if (cursorSnap.exists) ref = ref.startAfter(cursorSnap);
  }

  const snap = await ref.limit(fetchLimit).get();
  let orders = snap.docs.map((doc) => docToOrder(doc.id, doc.data()));

  if (query.search) orders = orders.filter((o) => matchesSearch(o, query.search!));
  if (query.dateFrom || query.dateTo) {
    orders = orders.filter((o) => matchesDateRange(o, query.dateFrom, query.dateTo));
  }

  const hasMore = orders.length > query.limit;
  const page = hasMore ? orders.slice(0, query.limit) : orders;

  return {
    orders: page,
    total: page.length,
    nextCursor: hasMore ? page[page.length - 1]?.id : undefined,
  };
}

export async function updateOrder(
  id: string,
  input: UpdateOrderInput,
  actor: AuthUser | ActorContext,
): Promise<Order> {
  const db = getAdminFirestore();
  const ref = orderDoc(db, id);
  const existing = await ref.get();
  if (!existing.exists) throw notFoundError("Order", id);

  const act = actorFromUser(actor);

  if (input.status !== undefined) {
    throw new ServiceError(
      "Use the status endpoint to change order status",
      "INVALID_STATUS_TRANSITION",
      409,
    );
  }

  const { status: _ignoredStatus, ...safeInput } = input;
  const patch: Record<string, unknown> = {
    ...safeInput,
    updatedAt: nowIso(),
  };

  if (input.totalCents !== undefined) {
    patch.totalDisplay = formatCentsToDisplay(input.totalCents);
  }

  await ref.update(patch);
  const updated = await getOrderById(id);

  await writeAuditLog({
    action: "order.update",
    entityType: "order",
    entityId: id,
    actorId: act.uid,
    actorRole: act.role,
    metadata: { fields: Object.keys(safeInput) },
  });

  return updated;
}

export async function assignDriver(
  orderId: string,
  driverId: string,
  actor: AuthUser | ActorContext,
  options?: { retryFailed?: boolean },
): Promise<AssignDriverResult> {
  const driver = await getDriverById(driverId);
  validateDriverForAssignment(driver);
  const act = actorFromUser(actor);
  const db = getAdminFirestore();
  const ref = orderDoc(db, orderId);
  const existing = await ref.get();
  if (!existing.exists) throw notFoundError("Order", orderId);

  const current = docToOrder(existing.id, existing.data()!);
  assertOrderStatusActionable(current);
  const currentStatus = normalizeOrderStatusForRead(current.status).status;
  const now = nowIso();

  // Idempotent same-driver assign
  if (current.assignedDriverId === driverId) {
    if (currentStatus === "Assigned" || isPostPickupStatus(currentStatus)) {
      return {
        order: current,
        trackingNotification: {
          linkCreated: false,
          smsAttempted: false,
          smsSent: false,
          message: "Driver already assigned",
        },
      };
    }
  }

  if (isTerminalOrderStatus(currentStatus) && currentStatus !== "Failed") {
    throw new ServiceError(
      "Cannot assign a driver to a terminal order",
      "TERMINAL_ORDER",
      409,
    );
  }

  if (currentStatus === "Failed" && !options?.retryFailed) {
    throw new ServiceError(
      "Retrying a failed order requires an explicit retry action",
      "INVALID_STATUS_TRANSITION",
      409,
    );
  }

  let nextStatus = currentStatus;
  let actionType: OrderStatusActionType = "reassignment";
  let statusChanged = false;
  let shouldNotify = true;

  if (currentStatus === "New" || currentStatus === "Scheduled") {
    try {
      assertOrderStatusTransition(currentStatus, "Assigned");
    } catch (err) {
      asServiceError(err);
    }
    nextStatus = "Assigned";
    actionType = "assignment";
    statusChanged = true;
  } else if (currentStatus === "Failed" && options?.retryFailed) {
    try {
      assertOrderStatusTransition("Failed", "Assigned");
    } catch (err) {
      asServiceError(err);
    }
    nextStatus = "Assigned";
    actionType = "retry";
    statusChanged = true;
  } else if (currentStatus === "Assigned") {
    nextStatus = "Assigned";
    actionType = "reassignment";
    statusChanged = false;
  } else if (isPostPickupStatus(currentStatus)) {
    // Preserve Picked Up / Out for Delivery — driver change only.
    nextStatus = currentStatus;
    actionType = "reassignment";
    statusChanged = false;
  } else {
    throw new ServiceError(
      `Cannot assign a driver while order is ${currentStatus}`,
      "INVALID_STATUS_TRANSITION",
      409,
    );
  }

  await ref.update(
    omitUndefined({
      assignedDriverId: driverId,
      assignedDriverName: driver.name,
      assignedAt: now,
      status: nextStatus,
      updatedAt: now,
    }),
  );

  if (statusChanged) {
    await addStatusEvent(orderId, nextStatus, act, {
      note: `Assigned to ${driver.name}`,
      previousStatus: currentStatus,
      actionType,
    });
  } else {
    // Reassignment at same lifecycle status — audit only, no fake status restart.
    await addStatusEvent(orderId, nextStatus, act, {
      note: `Reassigned to ${driver.name}`,
      previousStatus: currentStatus,
      actionType: "reassignment",
    });
  }

  await writeAuditLog({
    action: actionType === "retry" ? "order.retry_assign" : "order.assign_driver",
    entityType: "order",
    entityId: orderId,
    actorId: act.uid,
    actorRole: act.role,
    metadata: {
      driverId,
      previousStatus: currentStatus,
      status: nextStatus,
      statusChanged,
      actionType,
    },
  });

  const order = await getOrderById(orderId);
  const trackingNotification = shouldNotify
    ? await notifyCustomerOrderAssigned(order)
    : {
        linkCreated: false,
        smsAttempted: false,
        smsSent: false,
        message: "Notification skipped",
      };

  return { order, trackingNotification };
}

/** Explicit Failed → Assigned retry + assign. */
export async function retryFailedAndAssignDriver(
  orderId: string,
  driverId: string,
  actor: AuthUser | ActorContext,
): Promise<AssignDriverResult> {
  return assignDriver(orderId, driverId, actor, { retryFailed: true });
}

/** Unassign driver before pickup (Assigned → New). */
export async function unassignDriver(
  orderId: string,
  actor: AuthUser | ActorContext,
): Promise<Order> {
  const act = actorFromUser(actor);
  const db = getAdminFirestore();
  const ref = orderDoc(db, orderId);
  const existing = await ref.get();
  if (!existing.exists) throw notFoundError("Order", orderId);

  const current = docToOrder(existing.id, existing.data()!);
  assertOrderStatusActionable(current);
  const currentStatus = normalizeOrderStatusForRead(current.status).status;

  if (!canUnassignDriver(currentStatus)) {
    throw new ServiceError(
      "Unassign is only permitted before pickup",
      "INVALID_STATUS_TRANSITION",
      409,
    );
  }

  try {
    assertOrderStatusTransition(currentStatus, "New");
  } catch (err) {
    asServiceError(err);
  }

  const now = nowIso();
  await ref.update({
    assignedDriverId: null,
    assignedDriverName: null,
    assignedAt: null,
    status: "New",
    updatedAt: now,
  });

  await addStatusEvent(orderId, "New", act, {
    note: "Driver unassigned",
    previousStatus: currentStatus,
    actionType: "unassign",
  });

  await writeAuditLog({
    action: "order.unassign_driver",
    entityType: "order",
    entityId: orderId,
    actorId: act.uid,
    actorRole: act.role,
    metadata: { previousStatus: currentStatus },
  });

  return getOrderById(orderId);
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  actor: AuthUser | ActorContext,
  options?: { stepKey?: DeliveryStepKey; note?: string },
): Promise<{ order: Order; event: OrderStatusEvent }> {
  const db = getAdminFirestore();
  const ref = orderDoc(db, orderId);
  const existing = await ref.get();
  if (!existing.exists) throw notFoundError("Order", orderId);

  const act = actorFromUser(actor);
  const current = docToOrder(existing.id, existing.data()!);
  assertOrderStatusActionable(current);
  const currentStatus = normalizeOrderStatusForRead(current.status).status;
  const now = nowIso();

  let intended: OrderStatus;
  try {
    intended = resolveRequestedOrderStatus(currentStatus, status, options?.stepKey);
    assertOrderStatusTransition(currentStatus, intended);
  } catch (err) {
    return asServiceError(err);
  }

  // Idempotent: no status change → no duplicate event (Delivered keeps Phase A path)
  if (intended === currentStatus) {
    if (intended === "Delivered") {
      return markOrderDeliveredIdempotent(orderId, act, {
        ...options,
        previousStatus: currentStatus,
      });
    }
    const events = await getStatusEvents(orderId);
    const last = [...events].reverse().find((e) => e.status === currentStatus);
    return {
      order: current,
      event: last ?? {
        id: "noop",
        orderId,
        status: currentStatus,
        actorId: act.uid,
        actorRole: act.role,
        createdAt: current.updatedAt,
        actionType: "status_transition",
        previousStatus: currentStatus,
      },
    };
  }

  const completedSteps = [...current.completedSteps];
  if (options?.stepKey && !completedSteps.includes(options.stepKey)) {
    completedSteps.push(options.stepKey);
  }

  if (intended === "Delivered") {
    return markOrderDeliveredIdempotent(orderId, act, {
      ...options,
      previousStatus: currentStatus,
    });
  }

  const patch: Record<string, unknown> = {
    status: intended,
    completedSteps,
    updatedAt: now,
  };

  if (intended === "Picked Up" && !current.pickedUpAt) {
    patch.pickedUpAt = now;
  }
  if (options?.stepKey === "pickedUp" && !current.pickedUpAt) {
    patch.pickedUpAt = now;
  }
  if (intended === "Failed" && !current.failedAt) {
    patch.failedAt = now;
  }
  if (intended === "Returned" && !current.returnedAt) {
    patch.returnedAt = now;
  }

  await ref.update(patch);
  const event = await addStatusEvent(orderId, intended, act, {
    ...options,
    previousStatus: currentStatus,
    actionType: "status_transition",
  });

  await writeAuditLog({
    action: "order.status",
    entityType: "order",
    entityId: orderId,
    actorId: act.uid,
    actorRole: act.role,
    metadata: {
      previousStatus: currentStatus,
      status: intended,
      stepKey: options?.stepKey,
    },
  });

  return { order: await getOrderById(orderId), event };
}

/**
 * First transition to Delivered validates proofs, writes status + deliveredAt,
 * and appends exactly one history event (Firestore transaction).
 * Repeat / concurrent Delivered requests are idempotent.
 */
async function markOrderDeliveredIdempotent(
  orderId: string,
  actor: ActorContext,
  options?: {
    stepKey?: DeliveryStepKey;
    note?: string;
    previousStatus?: OrderStatus;
  },
): Promise<{ order: Order; event: OrderStatusEvent }> {
  const db = getAdminFirestore();
  const ref = orderDoc(db, orderId);

  const peek = await ref.get();
  if (!peek.exists) throw notFoundError("Order", orderId);
  const peekOrder = docToOrder(peek.id, peek.data()!);
  const peekStatus = normalizeOrderStatusForRead(peekOrder.status).status;

  if (peekStatus === "Delivered") {
    return loadExistingDeliveredResult(orderId, actor, peekOrder);
  }

  assertOrderStatusActionable(peekOrder);

  await assertRequiredProofsForDelivery(orderId);

  let wroteEvent = false;
  let racedToAlreadyDelivered = false;
  let transactionResult: {
    eventId: string;
    eventPayload: Omit<OrderStatusEvent, "id">;
  } | null = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFoundError("Order", orderId);
    const current = docToOrder(snap.id, snap.data()!);
    const currentStatus = normalizeOrderStatusForRead(current.status).status;

    if (currentStatus === "Delivered") {
      racedToAlreadyDelivered = true;
      return;
    }

    const completedSteps = [...current.completedSteps];
    if (options?.stepKey && !completedSteps.includes(options.stepKey)) {
      completedSteps.push(options.stepKey);
    }

    const now = nowIso();
    const patch = omitUndefined({
      status: "Delivered" as const,
      completedSteps,
      updatedAt: now,
      deliveredAt: current.deliveredAt ?? now,
    });

    const eventRef = orderEventsCollection(db, orderId).doc();
    const eventPayload = omitUndefined({
      orderId,
      status: "Delivered" as const,
      previousStatus: options?.previousStatus ?? currentStatus,
      actionType: "status_transition" as const,
      stepKey: options?.stepKey,
      note: options?.note,
      actorId: actor.uid,
      actorRole: actor.role,
      createdAt: now,
    }) as Omit<OrderStatusEvent, "id">;

    tx.update(ref, patch);
    tx.set(eventRef, eventPayload);
    wroteEvent = true;
    transactionResult = { eventId: eventRef.id, eventPayload };
  });

  const order = await getOrderById(orderId);

  if (racedToAlreadyDelivered || (order.status === "Delivered" && !wroteEvent)) {
    return loadExistingDeliveredResult(orderId, actor, order);
  }

  if (!wroteEvent || !transactionResult) {
    throw new ServiceError("Failed to mark order delivered", "INTERNAL_ERROR", 500);
  }

  const deliveredWrite = transactionResult as {
    eventId: string;
    eventPayload: Omit<OrderStatusEvent, "id">;
  };

  await writeAuditLog({
    action: "order.status",
    entityType: "order",
    entityId: orderId,
    actorId: actor.uid,
    actorRole: actor.role,
    metadata: {
      status: "Delivered",
      previousStatus: options?.previousStatus,
      stepKey: options?.stepKey,
    },
  });

  return {
    order,
    event: { id: deliveredWrite.eventId, ...deliveredWrite.eventPayload },
  };
}

async function loadExistingDeliveredResult(
  orderId: string,
  actor: ActorContext,
  order: Order,
): Promise<{ order: Order; event: OrderStatusEvent }> {
  const events = await getStatusEvents(orderId);
  const deliveredEvent = [...events].reverse().find((e) => e.status === "Delivered");
  if (deliveredEvent) {
    return { order, event: deliveredEvent };
  }
  // Legacy Delivered row without a history event — do not invent a write.
  return {
    order,
    event: {
      id: "legacy-delivered",
      orderId,
      status: "Delivered",
      actorId: actor.uid,
      actorRole: actor.role,
      createdAt: order.deliveredAt ?? order.updatedAt,
    },
  };
}

export async function listOrdersForDriver(
  driverId: string,
  query: DriverOrdersQuery,
): Promise<Order[]> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.orders)
    .where("assignedDriverId", "==", driverId)
    .limit(100)
    .get();

  let orders = snap.docs
    .map((doc) => docToOrder(doc.id, doc.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  switch (query.scope) {
    case "active":
      orders = orders.filter((o) => {
        const s = normalizeOrderStatusForRead(o.status).status;
        return s === "Assigned" || s === "Picked Up" || s === "Out for Delivery";
      });
      break;
    case "completed":
      orders = orders.filter((o) => COMPLETED_STATUSES.includes(o.status));
      break;
    case "route":
      orders = orders.filter(
        (o) => o.status !== "Delivered" && o.status !== "Failed" && o.status !== "Returned",
      );
      break;
    case "today":
    default:
      break;
  }

  return orders.slice(0, query.limit);
}

export async function assertDriverOwnsOrder(
  orderId: string,
  driverId: string,
): Promise<Order> {
  const order = await getOrderById(orderId);
  if (order.assignedDriverId !== driverId) {
    throw notFoundError("Order", orderId);
  }
  return order;
}
