import type { QueryClient } from "@tanstack/react-query";
import { isAccountDisabledSession } from "@/lib/dash/api/account-disabled";

/**
 * Shared TanStack Query key factories.
 * Same resource ⇒ same key; include every parameter that changes the response.
 */

export const dashboardKeys = {
  all: ["admin", "dashboard"] as const,
  stats: () => [...dashboardKeys.all, "stats"] as const,
};

export const integrationKeys = {
  all: ["admin", "integrations"] as const,
  barnetSyncHealth: () => [...integrationKeys.all, "barnet-sync-health"] as const,
};

export const orderKeys = {
  all: ["admin", "orders"] as const,
  lists: () => [...orderKeys.all, "list"] as const,
  list: (params?: { driverId?: string; status?: string; search?: string }) =>
    [...orderKeys.lists(), params ?? {}] as const,
  details: () => [...orderKeys.all, "detail"] as const,
  detail: (orderId: string) => [...orderKeys.details(), orderId] as const,
};

export const driverKeys = {
  all: ["admin", "drivers"] as const,
  lists: () => [...driverKeys.all, "list"] as const,
  list: () => [...driverKeys.lists()] as const,
  detail: (driverId: string) => [...driverKeys.all, "detail", driverId] as const,
  /** Authenticated driver portal session (profile). */
  sessionRoot: ["driver", "session"] as const,
  session: (driverId: string) => [...driverKeys.sessionRoot, driverId] as const,
  authClaims: () => ["driver", "authClaims"] as const,
  ordersRoot: ["driver", "orders"] as const,
  orders: (driverId: string, scope: "active" | "completed" | "route" | "today") =>
    [...driverKeys.ordersRoot, driverId, scope] as const,
  orderDetail: (driverId: string, orderId: string) =>
    ["driver", "order", driverId, orderId] as const,
};

export const assignmentKeys = {
  all: ["admin", "assignments"] as const,
  /** Recent assignments share the orders list filtered by recency on the client. */
  recent: () => [...assignmentKeys.all, "recent"] as const,
};

export const reportKeys = {
  all: ["admin", "reports"] as const,
  overview: () => [...reportKeys.all, "overview"] as const,
};

export const intakeKeys = {
  all: ["admin", "live-intake"] as const,
  imported: (limit = 100) => [...intakeKeys.all, "imported", limit] as const,
};

/** @deprecated Prefer dashboardKeys / orderKeys / driverKeys — kept for existing imports. */
export const adminQueryKeys = {
  orders: {
    all: orderKeys.all,
    list: orderKeys.list,
  },
  drivers: {
    all: driverKeys.all,
    list: driverKeys.list,
    detail: driverKeys.detail,
  },
  reports: {
    all: reportKeys.all,
    overview: reportKeys.overview,
  },
  dashboard: {
    all: dashboardKeys.all,
    stats: dashboardKeys.stats,
  },
};

/** Admin routes where orders list polling should run. */
export const ORDERS_POLL_ROUTES = [
  "/dashboard",
  "/orders",
  "/create-order",
  "/drivers",
] as const;

/** Admin routes where drivers list polling should run. */
export const DRIVERS_POLL_ROUTES = ["/dashboard", "/drivers", "/create-order"] as const;

/** Driver routes where active-order polling should run. */
export const DRIVER_ORDERS_POLL_ROUTES = [
  "/driver-dashboard",
  "/driver-orders",
  "/driver-route",
] as const;

export function routeMatchesPollList(
  pathname: string,
  routes: readonly string[],
): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function shouldPollQuery(
  pathname: string,
  routes: readonly string[],
): boolean {
  if (typeof document !== "undefined" && document.hidden) return false;
  if (isAccountDisabledSession()) return false;
  return routeMatchesPollList(pathname, routes);
}

/** Clear authenticated dash caches so Driver A / Admin A data never flashes for B. */
export function clearAuthenticatedQueryCache(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: ["admin"] });
  queryClient.removeQueries({ queryKey: ["driver"] });
  queryClient.removeQueries({ queryKey: assignmentKeys.all });
  queryClient.removeQueries({ queryKey: reportKeys.all });
  queryClient.removeQueries({ queryKey: integrationKeys.all });
}

/**
 * After order lifecycle mutations: refresh lists, detail, and dashboard counts.
 * Does not wipe proof localStorage or unrelated caches.
 */
export async function invalidateAfterOrderLifecycle(
  queryClient: QueryClient,
  options?: {
    orderId?: string;
    driverId?: string;
    previousDriverId?: string | null;
  },
): Promise<void> {
  const tasks: Promise<unknown>[] = [
    queryClient.invalidateQueries({ queryKey: orderKeys.all }),
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    queryClient.invalidateQueries({ queryKey: reportKeys.all }),
    queryClient.invalidateQueries({ queryKey: driverKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: intakeKeys.all }),
  ];
  if (options?.orderId) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: orderKeys.detail(options.orderId),
      }),
    );
  }
  const driverIds = new Set<string>();
  if (options?.driverId) driverIds.add(options.driverId);
  if (options?.previousDriverId) driverIds.add(options.previousDriverId);

  if (driverIds.size > 0) {
    for (const id of driverIds) {
      tasks.push(
        queryClient.invalidateQueries({
          queryKey: driverKeys.detail(id),
        }),
        queryClient.invalidateQueries({
          queryKey: driverKeys.orders(id, "active"),
        }),
        queryClient.invalidateQueries({
          queryKey: driverKeys.orders(id, "today"),
        }),
        queryClient.invalidateQueries({
          queryKey: driverKeys.orders(id, "route"),
        }),
      );
      if (options?.orderId) {
        tasks.push(
          queryClient.invalidateQueries({
            queryKey: driverKeys.orderDetail(id, options.orderId),
          }),
        );
      }
    }
  }

  tasks.push(
    queryClient.invalidateQueries({ queryKey: driverKeys.ordersRoot }),
  );

  await Promise.all(tasks);
}
