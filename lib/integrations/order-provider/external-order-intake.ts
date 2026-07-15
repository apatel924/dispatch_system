import { diagnoseNormalizedExternalOrder } from "@/lib/integrations/order-provider/barnet-order-diagnostics";
import { evaluateNormalizedOrderReview } from "@/lib/integrations/order-provider/barnet-order-decision";
import type {
  ExternalOrderDispatchStatus,
  ExternalOrderIntakeDetail,
  ExternalOrderIntakeRow,
  NormalizedExternalOrder,
} from "@/lib/integrations/order-provider/types";

function resolveDispatchStatus(order: NormalizedExternalOrder): ExternalOrderDispatchStatus {
  if (order.promoted) return "promoted";
  if (order.assignmentStatus === "assigned" || order.dispatchStatus === "assigned") {
    return "assigned";
  }
  if (order.dispatchReady) return "ready";
  if ((order.missingFields?.length ?? 0) > 0 || order.needsReview) return "needs_review";
  return order.dispatchStatus ?? "pending";
}

function resolveMissingFields(order: NormalizedExternalOrder): string[] {
  if (order.missingFields?.length) return order.missingFields;
  return diagnoseNormalizedExternalOrder(order).missingFields;
}

function resolveReviewState(order: NormalizedExternalOrder): {
  needsReview: boolean;
  reviewReasons: string[];
} {
  if (typeof order.needsReview === "boolean" && Array.isArray(order.reviewReasons)) {
    return {
      needsReview: order.needsReview,
      reviewReasons: order.reviewReasons,
    };
  }
  const review = evaluateNormalizedOrderReview(order);
  return {
    needsReview: review.needsReview,
    reviewReasons: review.reviewReasons,
  };
}

export function resolveExternalOrderDocId(order: NormalizedExternalOrder): string {
  if (order.provider === "barnet") {
    return `barnet_${order.externalOrderId}`;
  }
  return order.externalOrderId;
}

export function toExternalOrderIntakeRow(
  order: NormalizedExternalOrder,
  options?: { docId?: string; isPreview?: boolean; alreadyImported?: boolean },
): ExternalOrderIntakeRow {
  const missingFields = resolveMissingFields(order);
  const review = resolveReviewState(order);
  return {
    id: options?.docId ?? resolveExternalOrderDocId(order),
    provider: order.provider,
    externalOrderId: order.externalOrderId,
    externalOrderNumber: order.externalOrderNumber,
    customerName: order.customer?.name ?? order.customerName,
    customerPhone: order.customer?.phone ?? order.customerPhone,
    deliveryAddress: order.delivery?.formattedAddress ?? order.deliveryAddress,
    itemsCount: order.items.length,
    total: order.total,
    sourceStatus: order.sourceStatus ?? order.status,
    dispatchReady: order.dispatchReady,
    needsReview: review.needsReview,
    reviewReasons: review.reviewReasons,
    customerMessagingReady: order.customerMessagingReady,
    missingFields,
    assignmentStatus: order.assignmentStatus ?? "unassigned",
    dispatchStatus: resolveDispatchStatus(order),
    assignedDriverId: order.assignedDriverId ?? null,
    assignedDriverName: order.assignedDriverName ?? null,
    isPreview: options?.isPreview ?? false,
    alreadyImported: options?.alreadyImported ?? false,
    promoted: order.promoted ?? false,
    promotedOrderId: order.promotedOrderId ?? null,
    promotedAt: order.promotedAt ?? null,
    updatedAt: order.updatedAt,
    lastSyncedAt: order.lastSyncedAt ?? null,
  };
}

export function toExternalOrderIntakeDetail(
  order: NormalizedExternalOrder,
  options?: { docId?: string },
): ExternalOrderIntakeDetail {
  const missingFields = resolveMissingFields(order);
  const review = resolveReviewState(order);
  const customerName = order.customer?.name ?? order.customerName;
  const customerPhone = order.customer?.phone ?? order.customerPhone;
  const customerEmail = order.customer?.email ?? order.customerEmail;
  const deliveryAddress =
    order.delivery?.formattedAddress ?? order.deliveryAddress;

  return {
    id: options?.docId ?? resolveExternalOrderDocId(order),
    provider: order.provider,
    externalOrderId: order.externalOrderId,
    externalOrderNumber: order.externalOrderNumber,
    sourceLocationId: order.sourceLocationId ?? null,
    sourceStatus: order.sourceStatus ?? order.status,
    deliveryStatus: order.deliveryStatus,
    paymentStatus: order.paymentStatus,
    placedAt: order.placedAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    lastSyncedAt: order.lastSyncedAt ?? null,
    isDelivery: order.isDelivery,
    customer: {
      externalCustomerId: order.externalCustomerId,
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
    },
    delivery: order.delivery ?? {
      address1: null,
      address2: null,
      city: null,
      province: null,
      postalCode: null,
      formattedAddress: deliveryAddress,
      notes: order.deliveryInstructions,
    },
    items: order.items,
    totals: order.totals ?? {
      subtotal: null,
      tax: null,
      discount: null,
      total: order.total,
    },
    dispatchReady: order.dispatchReady,
    needsReview: review.needsReview,
    reviewReasons: review.reviewReasons,
    customerMessagingReady: order.customerMessagingReady,
    customerEnrichmentStatus: order.customerEnrichmentStatus,
    missingFields,
    assignmentStatus: order.assignmentStatus ?? "unassigned",
    dispatchStatus: resolveDispatchStatus(order),
    assignedDriverId: order.assignedDriverId ?? null,
    assignedDriverName: order.assignedDriverName ?? null,
    assignedAt: order.assignedAt ?? null,
    assignedBy: order.assignedBy ?? null,
    promoted: order.promoted ?? false,
    promotedOrderId: order.promotedOrderId ?? null,
    promotedAt: order.promotedAt ?? null,
    dispatchChecks: {
      deliveryOrderConfirmed: order.isDelivery,
      customerNamePresent: Boolean(customerName),
      customerPhonePresent: Boolean(customerPhone),
      deliveryAddressPresent: Boolean(deliveryAddress),
      itemsPresent: order.items.length > 0,
      notAlreadyAssigned: (order.assignmentStatus ?? "unassigned") !== "assigned",
    },
  };
}

/** Backfill structured fields on legacy Firestore documents. */
export function hydrateNormalizedExternalOrder(
  data: Record<string, unknown>,
): NormalizedExternalOrder {
  const order = data as unknown as NormalizedExternalOrder;
  const status = order.status ?? "unknown";
  const diagnostics = diagnoseNormalizedExternalOrder(order);
  const review = evaluateNormalizedOrderReview({
    ...order,
    missingFields: order.missingFields ?? diagnostics.missingFields,
    dispatchReady: order.dispatchReady ?? diagnostics.dispatchReady,
  });

  return {
    ...order,
    sourceStatus: order.sourceStatus ?? status,
    status,
    paymentStatus: order.paymentStatus ?? null,
    sourceLocationId: order.sourceLocationId ?? null,
    customer: order.customer ?? {
      name: order.customerName ?? null,
      phone: order.customerPhone ?? null,
      email: order.customerEmail ?? null,
    },
    delivery: order.delivery ?? {
      address1: null,
      address2: null,
      city: null,
      province: null,
      postalCode: null,
      formattedAddress: order.deliveryAddress ?? null,
      notes: order.deliveryInstructions ?? null,
    },
    totals: order.totals ?? {
      subtotal: null,
      tax: null,
      discount: null,
      total: order.total ?? 0,
    },
    missingFields: order.missingFields ?? diagnostics.missingFields,
    needsReview: order.needsReview ?? review.needsReview,
    reviewReasons: order.reviewReasons ?? review.reviewReasons,
    assignmentStatus: order.assignmentStatus ?? "unassigned",
    dispatchStatus: order.dispatchStatus ?? (order.dispatchReady ? "ready" : "pending"),
    assignedDriverId: order.assignedDriverId ?? null,
    assignedDriverName: order.assignedDriverName ?? null,
    assignedAt: order.assignedAt ?? null,
    assignedBy: order.assignedBy ?? null,
    lastSyncedAt: order.lastSyncedAt ?? null,
    promoted: order.promoted ?? false,
    promotedOrderId: order.promotedOrderId ?? null,
    promotedAt: order.promotedAt ?? null,
  };
}
