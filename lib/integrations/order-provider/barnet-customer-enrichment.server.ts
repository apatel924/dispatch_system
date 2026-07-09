import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import { fetchBarnetUserById } from "@/lib/integrations/order-provider/barnet-client.server";
import { diagnoseNormalizedExternalOrder } from "@/lib/integrations/order-provider/barnet-order-diagnostics";
import { normalizeBarnetCustomer } from "@/lib/integrations/order-provider/normalize-barnet-customer";
import type {
  CustomerEnrichmentStatus,
  NormalizedExternalOrder,
} from "@/lib/integrations/order-provider/types";

export type BarnetCustomerCache = Map<string, CustomerEnrichmentCacheEntry>;

export interface CustomerEnrichmentCacheEntry {
  status: "success" | "failed";
  error?: string;
  customer?: ReturnType<typeof normalizeBarnetCustomer>;
}

function coerceString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function resolveBarnetCustomerId(order: BarnetOrderRaw): string | null {
  return coerceString(order.customer_id);
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Customer lookup failed";
}

export async function lookupBarnetCustomer(
  customerId: string,
  cache: BarnetCustomerCache,
): Promise<CustomerEnrichmentCacheEntry> {
  const cached = cache.get(customerId);
  if (cached) return cached;

  try {
    const raw = await fetchBarnetUserById(customerId);
    if (!raw) {
      const entry: CustomerEnrichmentCacheEntry = {
        status: "failed",
        error: "Customer not found",
      };
      cache.set(customerId, entry);
      return entry;
    }

    const entry: CustomerEnrichmentCacheEntry = {
      status: "success",
      customer: normalizeBarnetCustomer(raw),
    };
    cache.set(customerId, entry);
    return entry;
  } catch (err) {
    const entry: CustomerEnrichmentCacheEntry = {
      status: "failed",
      error: safeErrorMessage(err),
    };
    cache.set(customerId, entry);
    return entry;
  }
}

export function applyCustomerEnrichment(
  order: NormalizedExternalOrder,
  enrichment: CustomerEnrichmentCacheEntry | null,
): NormalizedExternalOrder {
  if (!enrichment) {
    const diagnostics = diagnoseNormalizedExternalOrder(order);
    return {
      ...order,
      customerMessagingReady: false,
      customerEnrichmentStatus: "skipped",
      customerEnrichmentError: null,
      dispatchReady: diagnostics.dispatchReady,
      missingFields: diagnostics.missingFields,
      dispatchStatus: diagnostics.dispatchReady ? "ready" : "needs_review",
    };
  }

  if (enrichment.status === "failed") {
    const diagnostics = diagnoseNormalizedExternalOrder(order);
    return {
      ...order,
      customerMessagingReady: false,
      customerEnrichmentStatus: "failed",
      customerEnrichmentError: enrichment.error ?? "Customer lookup failed",
      dispatchReady: diagnostics.dispatchReady,
      missingFields: diagnostics.missingFields,
      dispatchStatus: diagnostics.dispatchReady ? "ready" : "needs_review",
    };
  }

  const customer = enrichment.customer!;
  const enriched: NormalizedExternalOrder = {
    ...order,
    customerName: customer.customerName,
    customerPhone: customer.customerPhone,
    customerEmail: customer.customerEmail,
    customer: {
      name: customer.customerName,
      phone: customer.customerPhone,
      email: customer.customerEmail,
    },
  };

  const diagnostics = diagnoseNormalizedExternalOrder(enriched);

  return {
    ...enriched,
    customerMessagingReady: diagnostics.customerMessagingReady,
    customerEnrichmentStatus: "success" satisfies CustomerEnrichmentStatus,
    customerEnrichmentError: null,
    dispatchReady: diagnostics.dispatchReady,
    missingFields: diagnostics.missingFields,
    dispatchStatus: diagnostics.dispatchReady ? "ready" : "needs_review",
  };
}

export async function enrichBarnetDeliveryOrder(
  order: NormalizedExternalOrder,
  rawOrder: BarnetOrderRaw,
  cache: BarnetCustomerCache,
): Promise<NormalizedExternalOrder> {
  const customerId = resolveBarnetCustomerId(rawOrder);
  if (!customerId) {
    return applyCustomerEnrichment(order, null);
  }

  const enrichment = await lookupBarnetCustomer(customerId, cache);
  return applyCustomerEnrichment(order, enrichment);
}
