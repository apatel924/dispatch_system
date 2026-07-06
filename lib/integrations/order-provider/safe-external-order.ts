import { diagnoseNormalizedExternalOrder } from "@/lib/integrations/order-provider/barnet-order-diagnostics";
import type {
  BarnetOrderDiagnostics,
  NormalizedExternalOrder,
  SafeExternalOrder,
} from "@/lib/integrations/order-provider/types";

export type { SafeExternalOrder };

export function toSafeExternalOrder(
  order: NormalizedExternalOrder,
  diagnostics?: BarnetOrderDiagnostics,
): SafeExternalOrder {
  const { rawPayload: _rawPayload, items, ...rest } = order;

  return {
    ...rest,
    itemsCount: items.length,
    diagnostics: diagnostics ?? diagnoseNormalizedExternalOrder(order),
  };
}
