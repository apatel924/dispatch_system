import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import { diagnoseBarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-order-diagnostics";
import { findCustomerLinkFields } from "@/lib/integrations/order-provider/find-customer-link-fields";
import type {
  CustomerEnrichmentStatus,
  LiveOrderDetailDiagnostics,
} from "@/lib/integrations/order-provider/types";

export type { LiveOrderDetailDiagnostics };

function coerceString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

/**
 * Field-level diagnostics for a single live Barnet order detail payload.
 * Separates dispatch/messaging readiness from customer-link candidate scanning.
 */
export function diagnoseLiveOrderDetail(
  order: BarnetOrderRaw,
  enrichment?: {
    customerName?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    customerEnrichmentStatus?: CustomerEnrichmentStatus | null;
    customerMessagingReady?: boolean;
  },
): LiveOrderDetailDiagnostics {
  const barnetDiagnostics = diagnoseBarnetOrderRaw(order, enrichment);
  const customerLink = findCustomerLinkFields(order);

  return {
    ...barnetDiagnostics,
    externalOrderId: coerceString(order.id) ?? "unknown",
    externalOrderNumber: coerceString(order.number),
    topLevelKeys: Object.keys(order),
    possibleCustomerKeyPaths: customerLink.possibleCustomerKeyPaths,
    ignoredCustomerLikePaths: customerLink.ignoredCustomerLikePaths,
    hasUserIdCandidate: customerLink.hasUserIdCandidate,
    hasPhoneCandidate: customerLink.hasPhoneCandidate,
    hasUsableCustomerLink: customerLink.hasUsableCustomerLink,
  };
}
