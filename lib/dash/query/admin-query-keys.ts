/** Shared TanStack Query keys for admin dashboard data. */

export const adminQueryKeys = {
  orders: {
    all: ["admin", "orders"] as const,
    list: (params?: { driverId?: string }) =>
      [...adminQueryKeys.orders.all, "list", params ?? {}] as const,
  },
  drivers: {
    all: ["admin", "drivers"] as const,
    list: () => [...adminQueryKeys.drivers.all, "list"] as const,
    detail: (id: string) => [...adminQueryKeys.drivers.all, "detail", id] as const,
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
  return routeMatchesPollList(pathname, routes);
}
