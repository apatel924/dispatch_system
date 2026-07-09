/**
 * Shared Barnet order fulfillment classifier (delivery / pickup / unknown).
 * Used by the live scan script and server-side preview/sync via classify-barnet-order.ts.
 */

const FULFILLMENT_FLAG_KEYS = ["is_delivery", "delivery"];

const FULFILLMENT_TYPE_KEYS = [
  "order_type",
  "orderType",
  "type",
  "fulfillment_type",
  "fulfillmentType",
  "shipping_method",
  "delivery_method",
  "method",
];

const STATUS_KEYS = ["sourceStatus", "status", "status_display", "p_status", "delivery_status"];

function coerceString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function hasDeliveryAddress(order) {
  return Boolean(
    coerceString(order.address) &&
      coerceString(order.city) &&
      coerceString(order.state) &&
      coerceString(order.zip),
  );
}

function hasPartialAddress(order) {
  return Boolean(
    coerceString(order.address) ||
      coerceString(order.delivery_address) ||
      coerceString(order.city) ||
      coerceString(order.state) ||
      coerceString(order.zip),
  );
}

/**
 * @param {unknown} value
 * @returns {"delivery" | "pickup" | null}
 */
function interpretScalarFulfillmentValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? "delivery" : "pickup";
  if (typeof value === "number") return value !== 0 ? "delivery" : "pickup";
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return "delivery";
    if (normalized === "false" || normalized === "0" || normalized === "no") return "pickup";
    if (normalized.includes("delivery") || normalized.includes("deliver")) return "delivery";
    if (
      normalized.includes("pickup") ||
      normalized.includes("pick-up") ||
      normalized.includes("pick up") ||
      normalized.includes("pick_up") ||
      normalized.includes("in-store") ||
      normalized.includes("instore") ||
      normalized.includes("in store") ||
      normalized.includes("carryout") ||
      normalized.includes("carry-out") ||
      normalized.includes("takeout") ||
      normalized.includes("take-out")
    ) {
      return "pickup";
    }
  }
  return null;
}

/**
 * @param {Record<string, unknown>} order
 * @returns {Array<{ field: string, value: unknown, signal: "delivery" | "pickup" }>}
 */
export function collectBarnetClassificationSignals(order) {
  /** @type {Array<{ field: string, value: unknown, signal: "delivery" | "pickup" }>} */
  const signals = [];

  for (const key of FULFILLMENT_FLAG_KEYS) {
    if (!(key in order)) continue;
    const signal = interpretScalarFulfillmentValue(order[key]);
    if (signal) signals.push({ field: key, value: order[key], signal });
  }

  for (const key of FULFILLMENT_TYPE_KEYS) {
    if (!(key in order)) continue;
    const signal = interpretScalarFulfillmentValue(order[key]);
    if (signal) signals.push({ field: key, value: order[key], signal });
  }

  for (const key of STATUS_KEYS) {
    if (!(key in order)) continue;
    const signal = interpretScalarFulfillmentValue(order[key]);
    if (signal) signals.push({ field: key, value: order[key], signal });
  }

  if (hasDeliveryAddress(order)) {
    signals.push({ field: "address", value: "complete", signal: "delivery" });
  } else if (hasPartialAddress(order)) {
    signals.push({ field: "address", value: "partial", signal: "delivery" });
  }

  return signals;
}

/**
 * @param {Record<string, unknown>} order
 * @returns {"delivery" | "pickup" | "unknown"}
 */
export function classifyBarnetOrder(order) {
  const signals = collectBarnetClassificationSignals(order);
  if (signals.length === 0) return "unknown";

  let deliveryScore = 0;
  let pickupScore = 0;

  for (const entry of signals) {
    if (entry.signal === "delivery") deliveryScore += 1;
    if (entry.signal === "pickup") pickupScore += 1;
  }

  if (deliveryScore > pickupScore) return "delivery";
  if (pickupScore > deliveryScore) return "pickup";

  const explicitFlag = signals.find((entry) =>
    FULFILLMENT_FLAG_KEYS.includes(entry.field),
  );
  if (explicitFlag) return explicitFlag.signal;

  const typeSignal = signals.find((entry) => FULFILLMENT_TYPE_KEYS.includes(entry.field));
  if (typeSignal) return typeSignal.signal;

  if (deliveryScore > 0 && pickupScore > 0) return "unknown";
  if (deliveryScore > 0) return "delivery";
  if (pickupScore > 0) return "pickup";

  return "unknown";
}

/**
 * @param {Record<string, unknown>} order
 * @returns {boolean}
 */
export function isBarnetDeliveryOrder(order) {
  return classifyBarnetOrder(order) === "delivery";
}

/**
 * Safe debug snapshot for classification (no PII).
 * @param {Record<string, unknown>} order
 * @returns {{
 *   classification: "delivery" | "pickup" | "unknown",
 *   fieldsUsed: Array<{ field: string, value: unknown, signal: "delivery" | "pickup" }>,
 *   hasCustomerId: boolean,
 *   hasAddress: boolean,
 *   itemCount: number,
 * }}
 */
export function buildBarnetClassificationDebug(order) {
  const customerId = coerceString(order.customer_id);
  const itemCount = Array.isArray(order.items) ? order.items.length : 0;

  return {
    classification: classifyBarnetOrder(order),
    fieldsUsed: collectBarnetClassificationSignals(order),
    hasCustomerId: Boolean(customerId),
    hasAddress: hasDeliveryAddress(order) || hasPartialAddress(order),
    itemCount,
  };
}
