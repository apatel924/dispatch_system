import { createHash } from "node:crypto";
import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import { normalizeBarnetOrder } from "@/lib/integrations/order-provider/normalize-barnet-order";
import type { NormalizedExternalOrder } from "@/lib/integrations/order-provider/types";

function stableSerialize(value: unknown): string {
  return JSON.stringify(value, (_key, current) => {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      return Object.keys(current as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (current as Record<string, unknown>)[key];
          return acc;
        }, {});
    }
    return current;
  });
}

/**
 * Stable hash of Barnet source fields used to detect order changes before enrichment.
 */
export function computeBarnetOrderSourceHash(
  rawOrder: BarnetOrderRaw,
  options?: { now?: string },
): string {
  const normalized = normalizeBarnetOrder(rawOrder, { now: options?.now });
  const payload = {
    externalOrderId: normalized.externalOrderId,
    externalOrderNumber: normalized.externalOrderNumber,
    sourceStatus: normalized.sourceStatus,
    deliveryStatus: normalized.deliveryStatus,
    paymentStatus: normalized.paymentStatus,
    total: normalized.total,
    placedAt: normalized.placedAt,
    sourceLocationId: normalized.sourceLocationId,
    externalCustomerId: normalized.externalCustomerId,
    deliveryAddress: normalized.deliveryAddress,
    deliveryInstructions: normalized.deliveryInstructions,
    delivery: normalized.delivery,
    items: normalized.items,
    totals: normalized.totals,
  };

  return createHash("sha256").update(stableSerialize(payload)).digest("hex");
}

export function readStoredBarnetSourceHash(
  order: NormalizedExternalOrder,
): string | null {
  if (typeof order.syncSourceHash === "string" && order.syncSourceHash.length > 0) {
    return order.syncSourceHash;
  }

  if (order.rawPayload && typeof order.rawPayload === "object") {
    return computeBarnetOrderSourceHash(order.rawPayload as BarnetOrderRaw, {
      now: order.createdAt,
    });
  }

  return null;
}
