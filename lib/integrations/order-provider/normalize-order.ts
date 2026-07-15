import { diagnoseNormalizedExternalOrder } from "@/lib/integrations/order-provider/barnet-order-diagnostics";
import { evaluateNormalizedOrderReview } from "@/lib/integrations/order-provider/barnet-order-decision";
import type {
  ExternalProviderOrder,
  NormalizedExternalOrder,
} from "@/lib/integrations/order-provider/types";

/**
 * Converts a provider-specific order into the normalized internal shape.
 * Reusable for future live provider adapters.
 */
export function normalizeExternalOrder(
  provider: string,
  order: ExternalProviderOrder,
  options?: { now?: string; preserveTimestamps?: Partial<Pick<NormalizedExternalOrder, "createdAt" | "updatedAt">> },
): NormalizedExternalOrder {
  const now = options?.now ?? new Date().toISOString();
  const items = order.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    notes: item.notes,
  }));

  const draft: NormalizedExternalOrder = {
    provider,
    externalOrderId: order.id,
    externalOrderNumber: order.orderNumber ?? null,
    status: order.status,
    sourceStatus: order.status,
    deliveryStatus: order.deliveryStatus,
    paymentStatus: null,
    isDelivery: order.isDelivery,
    total: order.total,
    placedAt: order.placedAt,
    sourceLocationId: null,
    externalCustomerId: null,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    customerEmail: null,
    customer: {
      name: order.customer.name,
      phone: order.customer.phone,
      email: null,
    },
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    deliveryInstructions: order.deliveryInstructions,
    delivery: {
      address1: order.deliveryAddress,
      address2: null,
      city: null,
      province: null,
      postalCode: null,
      formattedAddress: order.deliveryAddress,
      notes: order.deliveryInstructions,
    },
    totals: {
      subtotal: null,
      tax: null,
      discount: null,
      total: order.total,
    },
    items,
    customerMessagingReady: false,
    customerEnrichmentStatus: "skipped",
    customerEnrichmentError: null,
    dispatchReady: false,
    needsReview: false,
    reviewReasons: [],
    missingFields: [],
    assignmentStatus: "unassigned",
    dispatchStatus: "pending",
    assignedDriverId: null,
    assignedDriverName: null,
    assignedAt: null,
    assignedBy: null,
    lastSyncedAt: null,
    promoted: false,
    promotedOrderId: null,
    promotedAt: null,
    rawPayload: order,
    createdAt: options?.preserveTimestamps?.createdAt ?? now,
    updatedAt: options?.preserveTimestamps?.updatedAt ?? now,
  };

  const diagnostics = diagnoseNormalizedExternalOrder(draft);
  const withDiagnostics = {
    ...draft,
    dispatchReady: diagnostics.dispatchReady,
    customerMessagingReady: diagnostics.customerMessagingReady,
    missingFields: diagnostics.missingFields,
    dispatchStatus: diagnostics.dispatchReady ? ("ready" as const) : ("needs_review" as const),
  };
  const review = evaluateNormalizedOrderReview(withDiagnostics);

  return {
    ...withDiagnostics,
    needsReview: review.needsReview,
    reviewReasons: review.reviewReasons,
  };
}

export function normalizeExternalOrders(
  provider: string,
  orders: ExternalProviderOrder[],
): NormalizedExternalOrder[] {
  const now = new Date().toISOString();
  return orders.map((order) => normalizeExternalOrder(provider, order, { now }));
}
