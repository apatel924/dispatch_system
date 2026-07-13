import type { Order, OrderStatus } from "@/lib/types/backend";
import {
  getAppTimeZone,
  isOnLocalDay,
  localDayKey,
  todayLocalDayKey,
} from "@/lib/app-timezone";
import {
  orderDeliveredAt,
  orderFailedAt,
} from "@/lib/order-timestamps";
import {
  ACTIVE_ORDER_STATUSES,
  TERMINAL_ORDER_STATUSES,
} from "@/lib/order-status-groups";

export { ACTIVE_ORDER_STATUSES } from "@/lib/order-status-groups";

const TERMINAL_STATUSES: OrderStatus[] = [...TERMINAL_ORDER_STATUSES];

const FAILED_TODAY_STATUSES: OrderStatus[] = ["Failed"];

export {
  getAppTimeZone,
  localDayKey,
  todayLocalDayKey,
  isOnLocalDay,
  isOnOrAfterLocalDay,
  startOfLocalDay,
} from "@/lib/app-timezone";

export { DEFAULT_APP_TIMEZONE } from "@/lib/app-timezone";

/**
 * Delivery duration from assignment to delivery.
 * Requires both assignedAt and deliveredAt with end > start.
 */
export function deliveryDurationMs(order: Order): number | null {
  const startIso = order.assignedAt;
  const endIso = order.deliveredAt;
  if (!startIso || !endIso || order.status !== "Delivered") return null;

  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

  return end - start;
}

export function averageMs(durations: number[]): number | null {
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((sum, ms) => sum + ms, 0) / durations.length);
}

export function formatAvgMs(ms: number | null): string {
  if (ms == null) return "—";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins === 0) return `${secs}s`;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function formatPercentChange(value: number | null): string {
  if (value == null) return "No comparison data";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}

export interface DriverOrderMetrics {
  activeDeliveries: number;
  completedToday: number;
  failedToday: number;
  averageDeliveryTimeMs: number | null;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
}

export function emptyDriverOrderMetrics(): DriverOrderMetrics {
  return {
    activeDeliveries: 0,
    completedToday: 0,
    failedToday: 0,
    averageDeliveryTimeMs: null,
    totalDeliveries: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
  };
}

export function aggregateDriverMetricsFromOrders(
  orders: Order[],
  driverIds: Iterable<string>,
  timeZone = getAppTimeZone(),
  todayKey = todayLocalDayKey(new Date(), timeZone),
): Map<string, DriverOrderMetrics> {
  const metrics = new Map<string, DriverOrderMetrics>();
  for (const id of driverIds) {
    metrics.set(id, emptyDriverOrderMetrics());
  }

  const durationsByDriver = new Map<string, number[]>();

  for (const order of orders) {
    const driverId = order.assignedDriverId;
    if (!driverId || !metrics.has(driverId)) continue;

    const row = metrics.get(driverId)!;

    if (ACTIVE_ORDER_STATUSES.includes(order.status)) {
      row.activeDeliveries += 1;
    }

    const deliveredAt = orderDeliveredAt(order);
    if (
      order.status === "Delivered" &&
      deliveredAt &&
      isOnLocalDay(deliveredAt, todayKey, timeZone)
    ) {
      row.completedToday += 1;
    }

    const failedAt = orderFailedAt(order);
    if (
      FAILED_TODAY_STATUSES.includes(order.status) &&
      failedAt &&
      isOnLocalDay(failedAt, todayKey, timeZone)
    ) {
      row.failedToday += 1;
    }

    if (TERMINAL_STATUSES.includes(order.status)) {
      row.totalDeliveries += 1;
      if (order.status === "Delivered") row.successfulDeliveries += 1;
      if (order.status === "Failed") row.failedDeliveries += 1;
    }

    const duration = deliveryDurationMs(order);
    if (duration != null) {
      const list = durationsByDriver.get(driverId) ?? [];
      list.push(duration);
      durationsByDriver.set(driverId, list);
    }
  }

  for (const [driverId, durations] of durationsByDriver) {
    const row = metrics.get(driverId);
    if (row) row.averageDeliveryTimeMs = averageMs(durations);
  }

  return metrics;
}

export function isDriverBusy(
  status: string,
  activeDeliveries: number,
): boolean {
  return status === "Busy" || activeDeliveries > 0;
}

export function isDriverAvailable(
  status: string,
  activeDeliveries: number,
): boolean {
  return status === "Available" && activeDeliveries === 0;
}
