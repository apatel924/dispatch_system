import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import { resolveBarnetCustomerId } from "@/lib/integrations/order-provider/barnet-customer-enrichment.server";
import { isBarnetDeliveryOrder } from "@/lib/integrations/order-provider/classify-barnet-order";
import type {
  BarnetOrderDiagnostics,
  CustomerEnrichmentStatus,
} from "@/lib/integrations/order-provider/types";

export type { BarnetOrderDiagnostics };

function coerceString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function hasRawItems(order: BarnetOrderRaw): boolean {
  return Array.isArray(order.items) && order.items.length > 0;
}

function buildMissingFields(params: {
  hasAddress: boolean;
  hasCity: boolean;
  hasState: boolean;
  hasZip: boolean;
  hasDeliveryInstructions: boolean;
  hasItems: boolean;
  hasCustomerId: boolean;
  hasCustomerName: boolean;
  hasCustomerPhone: boolean;
  hasCustomerEmail: boolean;
  useOrderAddressKeys?: boolean;
}): string[] {
  const missingFields: string[] = [];
  if (!params.hasAddress) {
    missingFields.push(params.useOrderAddressKeys ? "address" : "delivery_address");
  }
  if (!params.hasCity) missingFields.push("city");
  if (!params.hasState) missingFields.push("state");
  if (!params.hasZip) missingFields.push("zip");
  if (!params.hasDeliveryInstructions) {
    missingFields.push(
      params.useOrderAddressKeys ? "delivery_notes" : "delivery_instructions",
    );
  }
  if (!params.hasItems) missingFields.push("items");
  if (!params.hasCustomerId) missingFields.push("customer_id");
  if (!params.hasCustomerName) missingFields.push("customer_name");
  if (!params.hasCustomerPhone) missingFields.push("customer_phone");
  if (!params.hasCustomerEmail) missingFields.push("customer_email");
  return missingFields;
}

/**
 * Field-level diagnostics for a live Barnet order detail payload.
 * Uses raw address/city/state/zip and delivery_notes when available.
 */
export function diagnoseBarnetOrderRaw(
  order: BarnetOrderRaw,
  enrichment?: {
    customerName?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    customerEnrichmentStatus?: CustomerEnrichmentStatus | null;
    customerMessagingReady?: boolean;
  },
): BarnetOrderDiagnostics {
  const hasAddress = Boolean(coerceString(order.address));
  const hasCity = Boolean(coerceString(order.city));
  const hasState = Boolean(coerceString(order.state));
  const hasZip = Boolean(coerceString(order.zip));
  const hasDeliveryAddress = hasAddress && hasCity && hasState && hasZip;
  const hasDeliveryInstructions = Boolean(coerceString(order.delivery_notes));
  const hasItems = hasRawItems(order);
  const hasCustomerId = Boolean(resolveBarnetCustomerId(order));
  const hasCustomerName = Boolean(coerceString(enrichment?.customerName));
  const hasCustomerPhone = Boolean(coerceString(enrichment?.customerPhone));
  const hasCustomerEmail = Boolean(coerceString(enrichment?.customerEmail));
  const isDelivery = isBarnetDeliveryOrder(order);

  const customerEnrichmentStatus =
    enrichment?.customerEnrichmentStatus ??
    (hasCustomerId ? null : "skipped");

  const customerMessagingReady =
    enrichment?.customerMessagingReady ?? hasCustomerPhone;

  return {
    hasDeliveryAddress,
    hasDeliveryInstructions,
    hasItems,
    hasCustomerId,
    customerEnrichmentAvailable: hasCustomerId,
    hasCustomerName,
    hasCustomerPhone,
    hasCustomerEmail,
    dispatchReady: isDelivery && hasDeliveryAddress && hasItems,
    customerMessagingReady,
    customerEnrichmentStatus,
    missingFields: buildMissingFields({
      hasAddress,
      hasCity,
      hasState,
      hasZip,
      hasDeliveryInstructions,
      hasItems,
      hasCustomerId,
      hasCustomerName,
      hasCustomerPhone,
      hasCustomerEmail,
      useOrderAddressKeys: true,
    }),
  };
}

/**
 * Diagnostics derived from a normalized external order (e.g. synced Firestore docs).
 */
export function diagnoseNormalizedExternalOrder(
  order: {
    isDelivery: boolean;
    deliveryAddress: string | null;
    deliveryInstructions: string | null;
    items: unknown[];
    externalCustomerId?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    customerMessagingReady?: boolean;
    customerEnrichmentStatus?: CustomerEnrichmentStatus | null;
    dispatchReady?: boolean;
  },
): BarnetOrderDiagnostics {
  const hasDeliveryAddress = Boolean(coerceString(order.deliveryAddress));
  const hasDeliveryInstructions = Boolean(coerceString(order.deliveryInstructions));
  const hasItems = order.items.length > 0;
  const hasCustomerId = Boolean(coerceString(order.externalCustomerId));
  const hasCustomerName = Boolean(coerceString(order.customerName));
  const hasCustomerPhone = Boolean(coerceString(order.customerPhone));
  const hasCustomerEmail = Boolean(coerceString(order.customerEmail));

  const dispatchReady =
    order.dispatchReady ?? (order.isDelivery && hasDeliveryAddress && hasItems);
  const customerMessagingReady =
    order.customerMessagingReady ?? hasCustomerPhone;
  const customerEnrichmentStatus =
    order.customerEnrichmentStatus ?? (hasCustomerId ? null : "skipped");

  return {
    hasDeliveryAddress,
    hasDeliveryInstructions,
    hasItems,
    hasCustomerId,
    customerEnrichmentAvailable: hasCustomerId,
    hasCustomerName,
    hasCustomerPhone,
    hasCustomerEmail,
    dispatchReady,
    customerMessagingReady,
    customerEnrichmentStatus,
    missingFields: buildMissingFields({
      hasAddress: hasDeliveryAddress,
      hasCity: hasDeliveryAddress,
      hasState: hasDeliveryAddress,
      hasZip: hasDeliveryAddress,
      hasDeliveryInstructions,
      hasItems,
      hasCustomerId,
      hasCustomerName,
      hasCustomerPhone,
      hasCustomerEmail,
      useOrderAddressKeys: false,
    }),
  };
}
