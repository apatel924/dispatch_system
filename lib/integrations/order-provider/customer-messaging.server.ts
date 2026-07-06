import { getExternalOrderProviderConfig } from "@/lib/integrations/order-provider/env.server";
import type {
  BarnetOrderDiagnostics,
  NormalizedExternalOrder,
} from "@/lib/integrations/order-provider/types";
import { diagnoseNormalizedExternalOrder } from "@/lib/integrations/order-provider/barnet-order-diagnostics";

/**
 * Returns true only when customer SMS automation is explicitly enabled
 * and the order has a confirmed customer phone.
 */
export function shouldTriggerExternalOrderCustomerSms(
  order: NormalizedExternalOrder,
  diagnostics?: BarnetOrderDiagnostics,
): boolean {
  const config = getExternalOrderProviderConfig();
  if (!config.customerMessagingEnabled) return false;

  const resolved = diagnostics ?? diagnoseNormalizedExternalOrder(order);
  return resolved.customerMessagingReady;
}
