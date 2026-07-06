import { fetchBarnetOrders } from "@/lib/integrations/order-provider/barnet-client.server";
import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import { classifyBarnetOrder } from "@/lib/integrations/order-provider/normalize-barnet-order";
import { getExternalOrderSyncPaginationConfig, MAX_EXTERNAL_ORDER_SYNC_PAGES } from "@/lib/integrations/order-provider/sync-pagination.server";
import type { ExternalOrderScanStats } from "@/lib/integrations/order-provider/types";

export interface BarnetMultiPageScanResult extends ExternalOrderScanStats {
  deliveryOrders: BarnetOrderRaw[];
  itemsPerPage: number;
  pagesConfigured: number;
}

/**
 * Read-only Barnet GET /orders scan across multiple pages.
 * Classifies each order as delivery, pickup, or unknown (missing is_delivery).
 */
export async function scanBarnetOrderPages(
  options?: { pages?: number; itemsPerPage?: number },
): Promise<BarnetMultiPageScanResult> {
  const config = getExternalOrderSyncPaginationConfig();
  const pagesConfigured = Math.min(
    options?.pages ?? config.pages,
    MAX_EXTERNAL_ORDER_SYNC_PAGES,
  );
  const itemsPerPage = options?.itemsPerPage ?? config.itemsPerPage;

  let totalOrdersSeen = 0;
  let deliveryOrdersFound = 0;
  let pickupOrdersIgnored = 0;
  let unknownOrdersIgnored = 0;
  const deliveryOrders: BarnetOrderRaw[] = [];
  let pagesScanned = 0;

  for (let page = 1; page <= pagesConfigured; page++) {
    const rawOrders = await fetchBarnetOrders({ page, itemsOnPage: itemsPerPage });
    pagesScanned += 1;

    for (const order of rawOrders) {
      totalOrdersSeen += 1;
      const kind = classifyBarnetOrder(order);
      if (kind === "delivery") {
        deliveryOrdersFound += 1;
        deliveryOrders.push(order);
      } else if (kind === "pickup") {
        pickupOrdersIgnored += 1;
      } else {
        unknownOrdersIgnored += 1;
      }
    }
  }

  return {
    pagesScanned,
    totalOrdersSeen,
    deliveryOrdersFound,
    pickupOrdersIgnored,
    unknownOrdersIgnored,
    deliveryOrders,
    itemsPerPage,
    pagesConfigured,
  };
}
