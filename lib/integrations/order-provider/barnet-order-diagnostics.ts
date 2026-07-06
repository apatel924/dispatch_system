import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import type { BarnetOrderDiagnostics } from "@/lib/integrations/order-provider/types";

export type { BarnetOrderDiagnostics };

function coerceString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function isBarnetDeliveryFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

function resolveCustomerNameFromRaw(order: BarnetOrderRaw): string | null {
  const direct = coerceString(order.customer_name);
  if (direct) return direct;

  const customer = order.customer;
  if (customer && typeof customer === "object" && !Array.isArray(customer)) {
    const name = coerceString((customer as Record<string, unknown>).name);
    if (name) return name;
  }

  return coerceString(order.name);
}

function resolveCustomerPhoneFromRaw(order: BarnetOrderRaw): string | null {
  const direct = coerceString(order.customer_phone);
  if (direct) return direct;

  const customer = order.customer;
  if (customer && typeof customer === "object" && !Array.isArray(customer)) {
    const phone = coerceString((customer as Record<string, unknown>).phone);
    if (phone) return phone;
  }

  return coerceString(order.phone);
}

function hasRawItems(order: BarnetOrderRaw): boolean {
  return Array.isArray(order.items) && order.items.length > 0;
}

/**
 * Field-level diagnostics for a live Barnet order detail payload.
 * Uses raw address/city/state/zip and delivery_notes when available.
 */
export function diagnoseBarnetOrderRaw(order: BarnetOrderRaw): BarnetOrderDiagnostics {
  const hasAddress = Boolean(coerceString(order.address));
  const hasCity = Boolean(coerceString(order.city));
  const hasState = Boolean(coerceString(order.state));
  const hasZip = Boolean(coerceString(order.zip));
  const hasDeliveryAddress = hasAddress && hasCity && hasState && hasZip;
  const hasDeliveryInstructions = Boolean(coerceString(order.delivery_notes));
  const hasItems = hasRawItems(order);
  const hasCustomerName = Boolean(resolveCustomerNameFromRaw(order));
  const hasCustomerPhone = Boolean(resolveCustomerPhoneFromRaw(order));
  const isDelivery = isBarnetDeliveryFlag(order.is_delivery);

  const missingFields: string[] = [];
  if (!hasAddress) missingFields.push("address");
  if (!hasCity) missingFields.push("city");
  if (!hasState) missingFields.push("state");
  if (!hasZip) missingFields.push("zip");
  if (!hasDeliveryInstructions) missingFields.push("delivery_notes");
  if (!hasItems) missingFields.push("items");
  if (!hasCustomerName) missingFields.push("customer_name");
  if (!hasCustomerPhone) missingFields.push("customer_phone");

  return {
    hasDeliveryAddress,
    hasDeliveryInstructions,
    hasItems,
    hasCustomerName,
    hasCustomerPhone,
    dispatchReady: isDelivery && hasDeliveryAddress && hasItems,
    customerMessagingReady: hasCustomerPhone,
    missingFields,
  };
}

/**
 * Diagnostics derived from a normalized external order (e.g. synced Firestore docs).
 */
export function diagnoseNormalizedExternalOrder(order: {
  isDelivery: boolean;
  deliveryAddress: string | null;
  deliveryInstructions: string | null;
  items: unknown[];
  customerName: string | null;
  customerPhone: string | null;
}): BarnetOrderDiagnostics {
  const hasDeliveryAddress = Boolean(coerceString(order.deliveryAddress));
  const hasDeliveryInstructions = Boolean(coerceString(order.deliveryInstructions));
  const hasItems = order.items.length > 0;
  const hasCustomerName = Boolean(coerceString(order.customerName));
  const hasCustomerPhone = Boolean(coerceString(order.customerPhone));

  const missingFields: string[] = [];
  if (!hasDeliveryAddress) missingFields.push("delivery_address");
  if (!hasDeliveryInstructions) missingFields.push("delivery_instructions");
  if (!hasItems) missingFields.push("items");
  if (!hasCustomerName) missingFields.push("customer_name");
  if (!hasCustomerPhone) missingFields.push("customer_phone");

  return {
    hasDeliveryAddress,
    hasDeliveryInstructions,
    hasItems,
    hasCustomerName,
    hasCustomerPhone,
    dispatchReady: order.isDelivery && hasDeliveryAddress && hasItems,
    customerMessagingReady: hasCustomerPhone,
    missingFields,
  };
}
