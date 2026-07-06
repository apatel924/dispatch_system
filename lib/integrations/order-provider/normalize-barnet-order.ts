import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import type { NormalizedExternalOrder } from "@/lib/integrations/order-provider/types";

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

/**
 * Maps a Barnet order summary into the normalized internal shape.
 * Tolerant of missing fields in summary responses.
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

  return {
    provider: BARNET_PROVIDER,
    externalOrderId,
    externalOrderNumber: coerceString(order.number),
    status: resolveStatus(order),
    deliveryStatus: coerceString(order.delivery_status),
    isDelivery: coerceBoolean(order.is_delivery),
    total: coerceNumber(order.total),
    placedAt: resolvePlacedAt(order, now),
    customerName: coerceString(order.customer_name),
    customerPhone: coerceString(order.customer_phone),
    pickupAddress: null,
    deliveryAddress: coerceString(order.delivery_address),
    deliveryInstructions: null,
    items: [],
    rawPayload: order,
    createdAt: options?.preserveTimestamps?.createdAt ?? now,
    updatedAt: options?.preserveTimestamps?.updatedAt ?? now,
  };
}

export function normalizeBarnetOrders(orders: BarnetOrderRaw[]): NormalizedExternalOrder[] {
  const now = new Date().toISOString();
  return orders.map((order) => normalizeBarnetOrder(order, { now }));
}

export function barnetDocumentId(externalOrderId: string): string {
  return `barnet_${externalOrderId}`;
}
