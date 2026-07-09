import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import {
  buildBarnetClassificationDebug as buildBarnetClassificationDebugRaw,
  classifyBarnetOrder as classifyBarnetOrderRaw,
  collectBarnetClassificationSignals as collectBarnetClassificationSignalsRaw,
  isBarnetDeliveryOrder as isBarnetDeliveryOrderRaw,
} from "@/lib/integrations/order-provider/classify-barnet-order.mjs";

export type BarnetOrderKind = "delivery" | "pickup" | "unknown";

export type BarnetClassificationSignal = {
  field: string;
  value: unknown;
  signal: "delivery" | "pickup";
};

export type BarnetClassificationDebug = {
  classification: BarnetOrderKind;
  fieldsUsed: BarnetClassificationSignal[];
  hasCustomerId: boolean;
  hasAddress: boolean;
  itemCount: number;
};

export function collectBarnetClassificationSignals(
  order: BarnetOrderRaw,
): BarnetClassificationSignal[] {
  return collectBarnetClassificationSignalsRaw(order as Record<string, unknown>);
}

/** Classifies Barnet fulfillment using flags, type/method fields, status text, and address hints. */
export function classifyBarnetOrder(order: BarnetOrderRaw): BarnetOrderKind {
  return classifyBarnetOrderRaw(order as Record<string, unknown>);
}

export function isBarnetDeliveryOrder(order: BarnetOrderRaw): boolean {
  return isBarnetDeliveryOrderRaw(order as Record<string, unknown>);
}

export function buildBarnetClassificationDebug(
  order: BarnetOrderRaw,
): BarnetClassificationDebug {
  return buildBarnetClassificationDebugRaw(order as Record<string, unknown>);
}
