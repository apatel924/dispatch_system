import { diagnoseNormalizedExternalOrder } from "@/lib/integrations/order-provider/barnet-order-diagnostics";
import type {
  BarnetOrderDiagnostics,
  NormalizedExternalOrder,
  SafeExternalOrder,
} from "@/lib/integrations/order-provider/types";

export type { SafeExternalOrder };

export function toSafeExternalOrder(
  order: NormalizedExternalOrder,
  diagnostics?: BarnetOrderDiagnostics,
): SafeExternalOrder {
  const {
    rawPayload: _rawPayload,
    items,
    customerName: _customerName,
    customerPhone: _customerPhone,
    customerEmail: _customerEmail,
    customerEnrichmentError: _customerEnrichmentError,
    ...rest
  } = order;

  const resolvedDiagnostics = diagnostics ?? diagnoseNormalizedExternalOrder(order);

  return {
    provider: rest.provider,
    externalOrderId: rest.externalOrderId,
    externalOrderNumber: rest.externalOrderNumber,
    status: rest.status,
    deliveryStatus: rest.deliveryStatus,
    isDelivery: rest.isDelivery,
    total: rest.total,
    placedAt: rest.placedAt,
    externalCustomerId: rest.externalCustomerId,
    pickupAddress: rest.pickupAddress,
    deliveryAddress: rest.deliveryAddress,
    deliveryInstructions: rest.deliveryInstructions,
    itemsCount: items.length,
    customerMessagingReady: rest.customerMessagingReady,
    customerEnrichmentStatus: rest.customerEnrichmentStatus,
    dispatchReady: rest.dispatchReady,
    createdAt: rest.createdAt,
    updatedAt: rest.updatedAt,
    diagnostics: resolvedDiagnostics,
  };
}
