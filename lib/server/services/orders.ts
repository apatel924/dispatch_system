import type { Order, OrderStatus, OrderStatusEvent, UserRole } from "@/lib/types/backend";
import type { AuthUser } from "@/lib/server/auth";
import { notFoundError } from "@/lib/server/errors";
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
} from "@/lib/server/firestore/helpers";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { generateOrderId } from "@/lib/server/firestore/ids";
import { writeAuditLog } from "@/lib/server/services/audit";
import { getDriverById } from "@/lib/server/services/drivers";
import type {
  CreateOrderInput,
  DriverOrdersQuery,
  ListOrdersQuery,
  UpdateOrderInput,
} from "@/lib/server/validation/orders";
import type { DeliveryStepKey } from "@/lib/types/backend";

const ACTIVE_STATUSES: OrderStatus[] = [
  "Assigned",
  "Picked Up",
  "En Route",
  "Out for Delivery",
  "Scheduled",
];

const COMPLETED_STATUSES: OrderStatus[] = ["Delivered", "Failed", "Returned"];

export interface ActorContext {
  uid: string;
  role: UserRole | "system";
}

function actorFromUser(user: AuthUser | ActorContext): ActorContext {
  return { uid: user.uid, role: user.role };
}

export async function addStatusEvent(
  orderId: string,
  status: OrderStatus,
  actor: ActorContext,
  options?: { stepKey?: DeliveryStepKey; note?: string },
): Promise<OrderStatusEvent> {
  const db = getAdminFirestore();
  const ref = orderEventsCollection(db, orderId).doc();
  const createdAt = nowIso();

  const event: Omit<OrderStatusEvent, "id"> = {
    orderId,
    status,
    stepKey: options?.stepKey,
    note: options?.note,
    actorId: actor.uid,
    actorRole: actor.role,
    createdAt,
  };

  await ref.set(event);
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
  let status: OrderStatus = "New";

  if (assignedDriverId) {
    const driver = await getDriverById(assignedDriverId);
    assignedDriverName = driver.name;
    status = "Assigned";
  }

  const order: Order = {
    id,
    trackingId,
    externalOrderId: input.externalOrderId,
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

  await orderDoc(db, id).set(order);
  await addStatusEvent(id, status, act, { note: "Order created" });

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

export async function getOrderByTrackingId(trackingId: string): Promise<Order> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.orders)
    .where("trackingId", "==", trackingId)
    .limit(1)
    .get();

  if (snap.empty) throw notFoundError("Tracking", trackingId);
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
  const patch: Record<string, unknown> = {
    ...input,
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
    metadata: { fields: Object.keys(input) },
  });

  return updated;
}

export async function assignDriver(
  orderId: string,
  driverId: string,
  actor: AuthUser | ActorContext,
): Promise<Order> {
  const driver = await getDriverById(driverId);
  const act = actorFromUser(actor);
  const db = getAdminFirestore();
  const ref = orderDoc(db, orderId);
  const existing = await ref.get();
  if (!existing.exists) throw notFoundError("Order", orderId);

  const now = nowIso();
  await ref.update({
    assignedDriverId: driverId,
    assignedDriverName: driver.name,
    status: "Assigned",
    updatedAt: now,
  });

  await addStatusEvent(orderId, "Assigned", act, { note: `Assigned to ${driver.name}` });
  await writeAuditLog({
    action: "order.assign_driver",
    entityType: "order",
    entityId: orderId,
    actorId: act.uid,
    actorRole: act.role,
    metadata: { driverId },
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
  const now = nowIso();

  const completedSteps = [...current.completedSteps];
  if (options?.stepKey && !completedSteps.includes(options.stepKey)) {
    completedSteps.push(options.stepKey);
  }

  const patch: Record<string, unknown> = {
    status,
    completedSteps,
    updatedAt: now,
  };

  if (status === "Delivered") patch.deliveredAt = now;

  await ref.update(patch);
  const event = await addStatusEvent(orderId, status, act, options);

  await writeAuditLog({
    action: "order.status",
    entityType: "order",
    entityId: orderId,
    actorId: act.uid,
    actorRole: act.role,
    metadata: { status, stepKey: options?.stepKey },
  });

  return { order: await getOrderById(orderId), event };
}

export async function listOrdersForDriver(
  driverId: string,
  query: DriverOrdersQuery,
): Promise<Order[]> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.orders)
    .where("assignedDriverId", "==", driverId)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  let orders = snap.docs.map((doc) => docToOrder(doc.id, doc.data()));

  switch (query.scope) {
    case "active":
      orders = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
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
