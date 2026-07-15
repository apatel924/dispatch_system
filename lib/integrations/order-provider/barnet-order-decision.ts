import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import {
  diagnoseBarnetOrderRaw,
  diagnoseNormalizedExternalOrder,
} from "@/lib/integrations/order-provider/barnet-order-diagnostics";
import {
  classifyBarnetOrder,
  type BarnetOrderKind,
} from "@/lib/integrations/order-provider/classify-barnet-order";
import type {
  CustomerEnrichmentStatus,
  NormalizedExternalOrder,
} from "@/lib/integrations/order-provider/types";

export type BarnetOrderExclusionReason =
  | "pickup"
  | "unknown_fulfillment"
  | "missing_provider_order_id"
  | "malformed_payload";

export type BarnetReviewReason =
  | "missing_address"
  | "missing_items"
  | "missing_customer_name"
  | "missing_customer_phone"
  | "customer_enrichment_failed"
  | "unknown_source_status";

export interface BarnetOrderDecision {
  classification: BarnetOrderKind;
  /** Safe to upsert into externalOrders (reviewable or ready). */
  persistable: boolean;
  dispatchReady: boolean;
  needsReview: boolean;
  reviewReasons: BarnetReviewReason[];
  exclusionReason: BarnetOrderExclusionReason | null;
  externalOrderId: string | null;
}

function coerceString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function resolveBarnetProviderOrderId(
  order: BarnetOrderRaw | Record<string, unknown>,
): string | null {
  return coerceString(order.id);
}

/**
 * Map diagnostics / missing fields into stable review reason codes.
 * Address component gaps collapse to a single missing_address reason.
 */
export function buildBarnetReviewReasons(input: {
  isDelivery: boolean;
  dispatchReady: boolean;
  hasDeliveryAddress: boolean;
  hasItems: boolean;
  hasCustomerName: boolean;
  hasCustomerPhone: boolean;
  customerEnrichmentStatus?: CustomerEnrichmentStatus | null;
  sourceStatus?: string | null;
  missingFields?: string[];
}): BarnetReviewReason[] {
  if (!input.isDelivery || input.dispatchReady) return [];

  const reasons: BarnetReviewReason[] = [];
  const missing = input.missingFields ?? [];
  const addressMissing =
    !input.hasDeliveryAddress ||
    missing.some((f) =>
      ["address", "delivery_address", "city", "state", "zip"].includes(f),
    );

  if (addressMissing) reasons.push("missing_address");
  if (!input.hasItems || missing.includes("items")) reasons.push("missing_items");
  if (!input.hasCustomerName || missing.includes("customer_name")) {
    reasons.push("missing_customer_name");
  }
  if (!input.hasCustomerPhone || missing.includes("customer_phone")) {
    reasons.push("missing_customer_phone");
  }
  if (input.customerEnrichmentStatus === "failed") {
    reasons.push("customer_enrichment_failed");
  }
  if (
    !input.sourceStatus ||
    input.sourceStatus === "unknown" ||
    missing.includes("source_status")
  ) {
    // Only flag unknown status when readiness already failed for other reasons
    // or status is explicitly unknown — avoid noise on ready orders (handled above).
    if (input.sourceStatus === "unknown") {
      reasons.push("unknown_source_status");
    }
  }

  return [...new Set(reasons)];
}

/**
 * Shared preview/sync decision: classification, persistence, and readiness.
 * Preview and sync must agree on delivery vs pickup vs invalid.
 */
export function evaluateBarnetOrderDecision(
  rawOrder: BarnetOrderRaw,
  enrichment?: {
    customerName?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    customerEnrichmentStatus?: CustomerEnrichmentStatus | null;
    customerMessagingReady?: boolean;
  },
): BarnetOrderDecision {
  let classification: BarnetOrderKind;
  try {
    classification = classifyBarnetOrder(rawOrder);
  } catch {
    return {
      classification: "unknown",
      persistable: false,
      dispatchReady: false,
      needsReview: false,
      reviewReasons: [],
      exclusionReason: "malformed_payload",
      externalOrderId: resolveBarnetProviderOrderId(rawOrder),
    };
  }

  const externalOrderId = resolveBarnetProviderOrderId(rawOrder);

  if (classification === "pickup") {
    return {
      classification,
      persistable: false,
      dispatchReady: false,
      needsReview: false,
      reviewReasons: [],
      exclusionReason: "pickup",
      externalOrderId,
    };
  }

  if (classification === "unknown") {
    return {
      classification,
      persistable: false,
      dispatchReady: false,
      needsReview: false,
      reviewReasons: [],
      exclusionReason: "unknown_fulfillment",
      externalOrderId,
    };
  }

  if (!externalOrderId) {
    return {
      classification: "delivery",
      persistable: false,
      dispatchReady: false,
      needsReview: false,
      reviewReasons: [],
      exclusionReason: "missing_provider_order_id",
      externalOrderId: null,
    };
  }

  const diagnostics = diagnoseBarnetOrderRaw(rawOrder, enrichment);
  const reviewReasons = buildBarnetReviewReasons({
    isDelivery: true,
    dispatchReady: diagnostics.dispatchReady,
    hasDeliveryAddress: diagnostics.hasDeliveryAddress,
    hasItems: diagnostics.hasItems,
    hasCustomerName: diagnostics.hasCustomerName,
    hasCustomerPhone: diagnostics.hasCustomerPhone,
    customerEnrichmentStatus: diagnostics.customerEnrichmentStatus,
    sourceStatus: coerceString(rawOrder.status_display) ?? coerceString(rawOrder.p_status),
    missingFields: diagnostics.missingFields,
  });

  return {
    classification: "delivery",
    persistable: true,
    dispatchReady: diagnostics.dispatchReady,
    needsReview: !diagnostics.dispatchReady,
    reviewReasons,
    exclusionReason: null,
    externalOrderId,
  };
}

/** Recalculate review state from a normalized (possibly enriched) order. */
export function evaluateNormalizedOrderReview(
  order: NormalizedExternalOrder,
): Pick<
  BarnetOrderDecision,
  "dispatchReady" | "needsReview" | "reviewReasons"
> {
  const diagnostics = diagnoseNormalizedExternalOrder(order);
  const dispatchReady = Boolean(diagnostics.dispatchReady);
  const reviewReasons = buildBarnetReviewReasons({
    isDelivery: order.isDelivery,
    dispatchReady,
    hasDeliveryAddress: diagnostics.hasDeliveryAddress,
    hasItems: diagnostics.hasItems,
    hasCustomerName: diagnostics.hasCustomerName,
    hasCustomerPhone: diagnostics.hasCustomerPhone,
    customerEnrichmentStatus: order.customerEnrichmentStatus,
    sourceStatus: order.sourceStatus ?? order.status,
    missingFields: diagnostics.missingFields,
  });

  return {
    dispatchReady,
    needsReview: order.isDelivery && !dispatchReady,
    reviewReasons,
  };
}
