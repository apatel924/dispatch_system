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

  return {
    provider,
    externalOrderId: order.id,
    externalOrderNumber: order.orderNumber ?? null,
    status: order.status,
    deliveryStatus: order.deliveryStatus,
    isDelivery: order.isDelivery,
    total: order.total,
    placedAt: order.placedAt,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    deliveryInstructions: order.deliveryInstructions,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      notes: item.notes,
    })),
    rawPayload: order,
    createdAt: options?.preserveTimestamps?.createdAt ?? now,
    updatedAt: options?.preserveTimestamps?.updatedAt ?? now,
  };
}

export function normalizeExternalOrders(
  provider: string,
  orders: ExternalProviderOrder[],
): NormalizedExternalOrder[] {
  const now = new Date().toISOString();
  return orders.map((order) => normalizeExternalOrder(provider, order, { now }));
}
