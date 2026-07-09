import { fetchBarnetOrders } from "@/lib/integrations/order-provider/barnet-client.server";
import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import { classifyBarnetOrder } from "@/lib/integrations/order-provider/classify-barnet-order";
import {
  getExternalOrderSyncPaginationConfig,
  MAX_EXTERNAL_ORDER_SYNC_PAGES,
} from "@/lib/integrations/order-provider/sync-pagination.server";
import type { ExternalOrderScanStats } from "@/lib/integrations/order-provider/types";

export interface BarnetMultiPageScanResult extends ExternalOrderScanStats {
  deliveryOrders: BarnetOrderRaw[];
  itemsPerPage: number;
  pagesConfigured: number;
}

function classifyOrdersOnPage(orders: BarnetOrderRaw[]): {
  deliveryOrders: BarnetOrderRaw[];
  deliveryOrdersFound: number;
  pickupOrdersIgnored: number;
  unknownOrdersIgnored: number;
} {
  const deliveryOrders: BarnetOrderRaw[] = [];
  let deliveryOrdersFound = 0;
  let pickupOrdersIgnored = 0;
  let unknownOrdersIgnored = 0;

  for (const order of orders) {
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

  return {
    deliveryOrders,
    deliveryOrdersFound,
    pickupOrdersIgnored,
    unknownOrdersIgnored,
  };
}

/**
 * Read-only Barnet GET /orders scan across multiple pages.
 * Fetches one page at a time (Barnet is slow and parallel page fetches cause
 * timeouts). Stops only when a page returns zero orders.
 */
export async function scanBarnetOrderPages(
  options?: { pages?: number; itemsPerPage?: number },
): Promise<BarnetMultiPageScanResult> {
  const startedAt = Date.now();
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

  for (let page = 1; page <= pagesConfigured; page += 1) {
    const orders = await fetchBarnetOrders({ page, itemsOnPage: itemsPerPage });
    pagesScanned += 1;
    totalOrdersSeen += orders.length;

    const classified = classifyOrdersOnPage(orders);
    deliveryOrdersFound += classified.deliveryOrdersFound;
    pickupOrdersIgnored += classified.pickupOrdersIgnored;
    unknownOrdersIgnored += classified.unknownOrdersIgnored;
    deliveryOrders.push(...classified.deliveryOrders);

    if (orders.length === 0) {
      console.info(`[order-provider] scan stopping early: page ${page} returned 0 orders`);
      break;
    }
  }

  console.info(
    `[order-provider] scan complete: pages=${pagesScanned}/${pagesConfigured} seen=${totalOrdersSeen} delivery=${deliveryOrdersFound} durationMs=${Date.now() - startedAt}`,
  );

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
