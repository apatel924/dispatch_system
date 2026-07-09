import type { Order, PaymentStatus } from "@/lib/types/backend";
import type { AuthUser } from "@/lib/server/auth";
import { ServiceError, notFoundError } from "@/lib/server/errors";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { writeAuditLog } from "@/lib/server/services/audit";
import {
  createOrder,
  findOrderByExternalOrderRef,
  findOrderByExternalReference,
  getOrderById,
} from "@/lib/server/services/orders";
import type { CreateOrderInput } from "@/lib/server/validation/orders";
import {
  hydrateNormalizedExternalOrder,
  toExternalOrderIntakeDetail,
} from "@/lib/integrations/order-provider/external-order-intake";
import type {
  ExternalOrderIntakeDetail,
  ExternalProviderOrderItem,
  NormalizedExternalOrder,
} from "@/lib/integrations/order-provider/types";

const COLLECTION = "externalOrders";

export interface PromoteExternalOrderResult {
  order: Order;
  externalOrder: ExternalOrderIntakeDetail;
  alreadyPromoted: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

function mapPaymentStatus(raw: string | null): PaymentStatus {
  if (!raw) return "Pending";
  const lower = raw.toLowerCase();
  if (lower.includes("paid")) return "Paid";
  if (lower.includes("unpaid")) return "Unpaid";
  return "Pending";
}

function formatItemsNotes(items: ExternalProviderOrderItem[]): string | undefined {
  if (items.length === 0) return undefined;
  return items.map((item) => `${item.quantity}x ${item.name}`).join("; ");
}

function resolvePickupName(order: NormalizedExternalOrder): string {
  if (order.sourceLocationId) {
    return `Location ${order.sourceLocationId}`;
  }
  return order.provider === "barnet" ? "Barnet Store" : "Store Pickup";
}

function resolvePickupAddress(order: NormalizedExternalOrder): string {
  return order.pickupAddress?.trim() || "Pickup at source location";
}

export function validateExternalOrderForPromotion(
  order: NormalizedExternalOrder,
  options?: { overrideMissingFields?: boolean },
): { ok: true } | { ok: false; missingFields: string[]; message: string } {
  const detail = toExternalOrderIntakeDetail(order);
  const missingFields: string[] = [];

  if (!order.provider?.trim()) missingFields.push("provider");
  if (!detail.dispatchChecks.customerNamePresent) missingFields.push("customer_name");
  if (!detail.dispatchChecks.customerPhonePresent) missingFields.push("customer_phone");
  if (!detail.dispatchChecks.deliveryAddressPresent) missingFields.push("delivery_address");
  if (!detail.dispatchChecks.itemsPresent) missingFields.push("items");

  if (missingFields.length > 0 && !options?.overrideMissingFields) {
    return {
      ok: false,
      missingFields,
      message: `Required dispatch fields are missing: ${missingFields.join(", ")}`,
    };
  }

  return { ok: true };
}

function externalOrderToCreateInput(
  order: NormalizedExternalOrder,
  docId: string,
  promotedAt: string,
): CreateOrderInput {
  const customerName = order.customer?.name ?? order.customerName ?? "";
  const customerPhone = order.customer?.phone ?? order.customerPhone ?? "";
  const customerEmail = order.customer?.email ?? order.customerEmail ?? undefined;
  const deliveryAddress =
    order.delivery?.formattedAddress ?? order.deliveryAddress ?? "";
  const totalCents = Math.max(0, Math.round(order.totals?.total ?? order.total ?? 0));

  return {
    customerName,
    customerPhone,
    customerEmail,
    pickupName: resolvePickupName(order),
    pickupAddress: resolvePickupAddress(order),
    deliveryAddress,
    deliveryUnit: order.delivery?.address2 ?? undefined,
    deliveryArea: order.delivery?.city ?? undefined,
    deliveryInstructions:
      order.delivery?.notes ?? order.deliveryInstructions ?? undefined,
    externalProvider: order.provider,
    externalOrderId: order.externalOrderId,
    externalOrderNumber: order.externalOrderNumber ?? undefined,
    externalOrderRef: docId,
    promotedAt,
    paymentStatus: mapPaymentStatus(order.paymentStatus),
    subtotalCents:
      order.totals?.subtotal != null
        ? Math.max(0, Math.round(order.totals.subtotal))
        : undefined,
    taxCents:
      order.totals?.tax != null ? Math.max(0, Math.round(order.totals.tax)) : undefined,
    totalCents,
    notes: formatItemsNotes(order.items),
    source: `external:${order.provider}`,
  };
}

async function resolveExistingPromotedOrder(
  order: NormalizedExternalOrder,
  docId: string,
): Promise<Order | null> {
  if (order.promoted && order.promotedOrderId) {
    try {
      return await getOrderById(order.promotedOrderId);
    } catch (err) {
      if (!(err instanceof ServiceError && err.code === "NOT_FOUND")) {
        throw err;
      }
    }
  }

  const byRef = await findOrderByExternalOrderRef(docId);
  if (byRef) return byRef;

  return findOrderByExternalReference({
    externalProvider: order.provider,
    externalOrderId: order.externalOrderId,
  });
}

async function markExternalOrderPromoted(
  docId: string,
  promotedOrderId: string,
  promotedAt: string,
): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(COLLECTION).doc(docId).update({
    promoted: true,
    promotedOrderId,
    promotedAt,
    status: "promoted",
    dispatchStatus: "promoted",
    updatedAt: promotedAt,
  });
}

export async function promoteExternalOrderToDispatch(
  docId: string,
  actor: AuthUser,
  options?: { overrideMissingFields?: boolean },
): Promise<PromoteExternalOrderResult> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTION).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw notFoundError("External order", docId);
  }

  const order = hydrateNormalizedExternalOrder(snap.data() as Record<string, unknown>);
  const validation = validateExternalOrderForPromotion(order, options);
  if (!validation.ok) {
    throw new ServiceError(validation.message, "VALIDATION_ERROR", 400);
  }

  const existing = await resolveExistingPromotedOrder(order, docId);
  if (existing) {
    const promotedAt = order.promotedAt ?? existing.promotedAt ?? existing.createdAt;
    if (!order.promoted || order.promotedOrderId !== existing.id) {
      await markExternalOrderPromoted(docId, existing.id, promotedAt);
    }
    return {
      order: existing,
      externalOrder: await getExternalOrderIntakeDetailAfterPromote(docId),
      alreadyPromoted: true,
    };
  }

  const promotedAt = nowIso();
  const createInput = externalOrderToCreateInput(order, docId, promotedAt);
  const dispatchOrder = await createOrder(createInput, actor);

  await markExternalOrderPromoted(docId, dispatchOrder.id, promotedAt);

  await writeAuditLog({
    action: "external_order.promote",
    entityType: "order",
    entityId: dispatchOrder.id,
    actorId: actor.uid,
    actorRole: actor.role,
    metadata: {
      externalOrderDocId: docId,
      externalOrderId: order.externalOrderId,
      provider: order.provider,
    },
  });

  return {
    order: dispatchOrder,
    externalOrder: await getExternalOrderIntakeDetailAfterPromote(docId),
    alreadyPromoted: false,
  };
}

async function getExternalOrderIntakeDetailAfterPromote(
  docId: string,
): Promise<ExternalOrderIntakeDetail> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTION).doc(docId).get();
  if (!snap.exists) {
    throw notFoundError("External order", docId);
  }
  return toExternalOrderIntakeDetail(
    hydrateNormalizedExternalOrder(snap.data() as Record<string, unknown>),
    { docId },
  );
}
