import type { BarnetUserRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import { normalizeBarnetCustomer } from "@/lib/integrations/order-provider/normalize-barnet-customer";

export interface LiveCustomerDetailDiagnostics {
  customerId: string;
  hasCustomerName: boolean;
  hasCustomerPhone: boolean;
  hasCustomerEmail: boolean;
  hasShippingAddress: boolean;
  topLevelKeys: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Safe diagnostics for a Barnet user response — no PII values or raw payload.
 */
export function diagnoseLiveCustomerDetail(
  customerId: string,
  raw: BarnetUserRaw | null,
): LiveCustomerDetailDiagnostics {
  if (!raw) {
    return {
      customerId,
      hasCustomerName: false,
      hasCustomerPhone: false,
      hasCustomerEmail: false,
      hasShippingAddress: false,
      topLevelKeys: [],
    };
  }

  const normalized = normalizeBarnetCustomer(raw);

  return {
    customerId,
    hasCustomerName: Boolean(normalized.customerName),
    hasCustomerPhone: Boolean(normalized.customerPhone),
    hasCustomerEmail: Boolean(normalized.customerEmail),
    hasShippingAddress: Boolean(normalized.customerAddress),
    topLevelKeys: isRecord(raw) ? Object.keys(raw).sort() : [],
  };
}
