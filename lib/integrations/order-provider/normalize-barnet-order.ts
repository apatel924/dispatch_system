import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import { evaluateBarnetOrderDecision } from "@/lib/integrations/order-provider/barnet-order-decision";
import { diagnoseBarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-order-diagnostics";
import {
  classifyBarnetOrder,
  isBarnetDeliveryOrder,
} from "@/lib/integrations/order-provider/classify-barnet-order";
import type {
  ExternalOrderDelivery,
  ExternalProviderOrderItem,
  NormalizedExternalOrder,
} from "@/lib/integrations/order-provider/types";

const BARNET_PROVIDER = "barnet";

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

function resolveCustomerId(order: BarnetOrderRaw): string | null {
  return coerceString(order.customer_id);
}

function buildDeliveryFields(order: BarnetOrderRaw): ExternalOrderDelivery {
  const address1 = coerceString(order.address);
  const city = coerceString(order.city);
  const province = coerceString(order.state);
  const postalCode = coerceString(order.zip);
  const notes = coerceString(order.delivery_notes);
  const parts = [address1, city, province, postalCode].filter(
    (part): part is string => part !== null,
  );
  const formattedAddress =
    parts.length > 0 ? parts.join(", ") : coerceString(order.delivery_address);

  return {
    address1,
    address2: null,
    city,
    province,
    postalCode,
    formattedAddress,
    notes,
  };
}

function buildDeliveryAddress(order: BarnetOrderRaw): string | null {
  return buildDeliveryFields(order).formattedAddress;
}

function resolvePaymentStatus(order: BarnetOrderRaw): string | null {
  return coerceString(order.p_status) ?? coerceString(order.payment_status);
}

function resolveSourceLocationId(order: BarnetOrderRaw): string | null {
  return coerceString(order.store_id) ?? coerceString(order.location_id);
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
      sku: coerceString(item.sku ?? item.product_sku),
      category: coerceString(item.category ?? item.product_category),
    };
  });
}

export type { BarnetOrderKind } from "@/lib/integrations/order-provider/classify-barnet-order";
export { classifyBarnetOrder, isBarnetDeliveryOrder } from "@/lib/integrations/order-provider/classify-barnet-order";

/**
 * Maps a Barnet order detail payload into the normalized internal shape.
 * Customer contact fields remain null until enrichment via GET /user/{customer_id}.
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
  const delivery = buildDeliveryFields(order);
  const status = resolveStatus(order);
  const diagnostics = diagnoseBarnetOrderRaw(order);
  const decision = evaluateBarnetOrderDecision(order);

  return {
    provider: BARNET_PROVIDER,
    externalOrderId,
    externalOrderNumber: coerceString(order.number),
    status,
    sourceStatus: status,
    deliveryStatus: coerceString(order.delivery_status),
    paymentStatus: resolvePaymentStatus(order),
    isDelivery: isBarnetDeliveryOrder(order),
    total: coerceNumber(order.total),
    placedAt: resolvePlacedAt(order, now),
    sourceLocationId: resolveSourceLocationId(order),
    externalCustomerId: resolveCustomerId(order),
    customerName: null,
    customerPhone: null,
    customerEmail: null,
    customer: { name: null, phone: null, email: null },
    pickupAddress: null,
    deliveryAddress: delivery.formattedAddress,
    deliveryInstructions: delivery.notes,
    delivery,
    totals: {
      subtotal: coerceNullableNumber(order.subtotal),
      tax: coerceNullableNumber(order.tax),
      discount: coerceNullableNumber(order.discount),
      total: coerceNumber(order.total),
    },
    items,
    customerMessagingReady: false,
    customerEnrichmentStatus: null,
    customerEnrichmentError: null,
    dispatchReady: diagnostics.dispatchReady,
    needsReview: decision.needsReview,
    reviewReasons: decision.reviewReasons,
    missingFields: diagnostics.missingFields,
    assignmentStatus: "unassigned",
    dispatchStatus: diagnostics.dispatchReady ? "ready" : "needs_review",
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
