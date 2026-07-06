import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import type {
  ExternalProviderOrderItem,
  NormalizedExternalOrder,
} from "@/lib/integrations/order-provider/types";

const BARNET_PROVIDER = "barnet";

function coerceBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

function coerceString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function coerceNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function coerceNullableNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function resolveStatus(order: BarnetOrderRaw): string {
  const statusDisplay = coerceString(order.status_display);
  if (statusDisplay) return statusDisplay;
  const pStatus = coerceString(order.p_status);
  if (pStatus) return pStatus;
  return "unknown";
}

function resolvePlacedAt(order: BarnetOrderRaw, fallback: string): string {
  const timestamp = coerceString(order.timestamp);
  return timestamp ?? fallback;
}

function resolveCustomerName(order: BarnetOrderRaw): string | null {
  const direct = coerceString(order.customer_name);
  if (direct) return direct;

  const customer = order.customer;
  if (customer && typeof customer === "object" && !Array.isArray(customer)) {
    const name = coerceString((customer as Record<string, unknown>).name);
    if (name) return name;
  }

  return coerceString(order.name);
}

function resolveCustomerPhone(order: BarnetOrderRaw): string | null {
  const direct = coerceString(order.customer_phone);
  if (direct) return direct;

  const customer = order.customer;
  if (customer && typeof customer === "object" && !Array.isArray(customer)) {
    const phone = coerceString((customer as Record<string, unknown>).phone);
    if (phone) return phone;
  }

  return coerceString(order.phone);
}

function buildDeliveryAddress(order: BarnetOrderRaw): string | null {
  const parts = [
    coerceString(order.address),
    coerceString(order.city),
    coerceString(order.state),
    coerceString(order.zip),
  ].filter((part): part is string => part !== null);

  if (parts.length > 0) return parts.join(", ");

  return coerceString(order.delivery_address);
}

function normalizeBarnetItems(rawItems: unknown): ExternalProviderOrderItem[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return {
        name: "Unknown item",
        quantity: 1,
        unitPrice: null,
        notes: null,
      };
    }

    const item = entry as Record<string, unknown>;
    const quantity = coerceNumber(item.quantity ?? item.qty) || 1;

    return {
      name:
        coerceString(item.name) ??
        coerceString(item.product_name) ??
        coerceString(item.title) ??
        "Unknown item",
      quantity,
      unitPrice: coerceNullableNumber(item.unit_price ?? item.price ?? item.unitPrice),
      notes: coerceString(item.notes ?? item.note),
    };
  });
}

export type BarnetOrderKind = "delivery" | "pickup" | "unknown";

/** Strict Barnet order classification based on is_delivery. */
export function classifyBarnetOrder(order: BarnetOrderRaw): BarnetOrderKind {
  if (order.is_delivery === undefined || order.is_delivery === null) return "unknown";
  return coerceBoolean(order.is_delivery) ? "delivery" : "pickup";
}

export function isBarnetDeliveryOrder(order: BarnetOrderRaw): boolean {
  return classifyBarnetOrder(order) === "delivery";
}

/**
 * Maps a Barnet order detail payload into the normalized internal shape.
 * Tolerant of missing fields; customer name/phone remain null when absent.
 */
export function normalizeBarnetOrder(
  order: BarnetOrderRaw,
  options?: {
    now?: string;
    preserveTimestamps?: Partial<Pick<NormalizedExternalOrder, "createdAt" | "updatedAt">>;
  },
): NormalizedExternalOrder {
  const now = options?.now ?? new Date().toISOString();
  const externalOrderId = coerceString(order.id) ?? "unknown";
  const items = normalizeBarnetItems(order.items);

  return {
    provider: BARNET_PROVIDER,
    externalOrderId,
    externalOrderNumber: coerceString(order.number),
    status: resolveStatus(order),
    deliveryStatus: coerceString(order.delivery_status),
    isDelivery: isBarnetDeliveryOrder(order),
    total: coerceNumber(order.total),
    placedAt: resolvePlacedAt(order, now),
    customerName: resolveCustomerName(order),
    customerPhone: resolveCustomerPhone(order),
    pickupAddress: null,
    deliveryAddress: buildDeliveryAddress(order),
    deliveryInstructions: coerceString(order.delivery_notes),
    items,
    rawPayload: order,
    createdAt: options?.preserveTimestamps?.createdAt ?? now,
    updatedAt: options?.preserveTimestamps?.updatedAt ?? now,
  };
}

export function normalizeBarnetOrders(orders: BarnetOrderRaw[]): NormalizedExternalOrder[] {
  const now = new Date().toISOString();
  return orders
    .filter(isBarnetDeliveryOrder)
    .map((order) => normalizeBarnetOrder(order, { now }));
}

export function barnetDocumentId(externalOrderId: string): string {
  return `barnet_${externalOrderId}`;
}
