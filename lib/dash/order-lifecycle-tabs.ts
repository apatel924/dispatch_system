import type { DashboardStatusGroup } from "@/lib/order-status";

/** Stable lifecycle tabs for the Orders page — maps to dashboardGroupForStatus. */
export const ORDER_LIFECYCLE_TABS = [
  { id: "all", label: "All", group: null },
  { id: "awaiting", label: "Awaiting", group: "awaiting_assignment" },
  { id: "active", label: "Active", group: "active" },
  { id: "completed", label: "Completed", group: "completed" },
  { id: "issues", label: "Issues", group: "issues" },
  { id: "closed", label: "Closed", group: "closed_unsuccessful" },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  group: DashboardStatusGroup | null;
}>;

export type OrderLifecycleTabId = (typeof ORDER_LIFECYCLE_TABS)[number]["id"];

export function isOrderLifecycleTabId(value: string): value is OrderLifecycleTabId {
  return ORDER_LIFECYCLE_TABS.some((tab) => tab.id === value);
}
