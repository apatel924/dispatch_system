/** Re-export query keys from the unified module for backward compatibility. */
export {
  adminQueryKeys,
  ORDERS_POLL_ROUTES,
  DRIVERS_POLL_ROUTES,
  DRIVER_ORDERS_POLL_ROUTES,
  routeMatchesPollList,
  shouldPollQuery,
  clearAuthenticatedQueryCache,
  invalidateAfterOrderLifecycle,
  dashboardKeys,
  orderKeys,
  driverKeys,
  assignmentKeys,
  reportKeys,
  integrationKeys,
  intakeKeys,
} from "@/lib/dash/query/query-keys";
