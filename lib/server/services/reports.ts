import { getAppTimeZone, addLocalDays, isInLocalDayRange, localDayKey, todayLocalDayKey } from "@/lib/app-timezone";
import type { Order } from "@/lib/types/backend";
import { listDrivers } from "@/lib/server/services/drivers";
import type { ReportsOverviewQuery } from "@/lib/server/validation/reports";
import {
  averageMs,
  deliveryDurationMs,
  percentChange,
} from "@/lib/delivery-metrics";
import {
  orderDeliveredAt,
  orderFailedAt,
  orderReturnedAt,
} from "@/lib/order-timestamps";
import { fetchTerminalOrdersForLocalDayRange } from "@/lib/server/services/order-reporting-queries";

export interface ReportsPeriodTotals {
  deliveries: number;
  completed: number;
  failed: number;
  returned: number;
  avgDeliveryTimeMs: number | null;
}

export interface ReportsComparisons {
  deliveries: number | null;
  completed: number | null;
  failed: number | null;
  returned: number | null;
  avgDeliveryTimeMs: number | null;
}

export interface ReportsDataCoverage {
  /** False when legacy updatedAt fallbacks were used for some orders in the result set. */
  complete: boolean;
  message?: string;
  legacyFallbackCount: number;
}

export interface ReportsOverview {
  period: { from: string; to: string };
  comparePeriod: { from: string; to: string } | null;
  totals: ReportsPeriodTotals;
  comparisons: ReportsComparisons | null;
  dataCoverage: ReportsDataCoverage;
  breakdowns: {
    status: Record<string, number>;
    drivers: {
      driverId: string;
      name: string;
      deliveries: number;
      completed: number;
      failed: number;
      avgDeliveryTimeMs: number | null;
      successRate: number | null;
    }[];
  };
  trends: {
    daily: { date: string; deliveries: number; completed: number; failed: number }[];
    compareDaily: { date: string; deliveries: number }[] | null;
  };
}

function defaultPeriod(): { from: string; to: string } {
  const timeZone = getAppTimeZone();
  const today = todayLocalDayKey(new Date(), timeZone);
  return { from: addLocalDays(today, -6), to: today };
}

function defaultComparePeriod(from: string): { from: string; to: string } {
  const spanDays = 7;
  return { from: addLocalDays(from, -spanDays), to: addLocalDays(from, -1) };
}

function emptyDailyMap(
  from: string,
  to: string,
): Map<string, { deliveries: number; completed: number; failed: number }> {
  const daily = new Map<string, { deliveries: number; completed: number; failed: number }>();
  for (let d = from; d <= to; d = addLocalDays(d, 1)) {
    daily.set(d, { deliveries: 0, completed: 0, failed: 0 });
  }
  return daily;
}

function aggregateOrdersForPeriod(
  orders: Order[],
  from: string,
  to: string,
  timeZone: string,
): ReportsPeriodTotals & {
  status: Record<string, number>;
  drivers: Record<
    string,
    {
      driverId: string;
      name: string;
      deliveries: number;
      completed: number;
      failed: number;
      durations: number[];
    }
  >;
  daily: Map<string, { deliveries: number; completed: number; failed: number }>;
} {
  const status: Record<string, number> = {};
  const drivers: Record<
    string,
    {
      driverId: string;
      name: string;
      deliveries: number;
      completed: number;
      failed: number;
      durations: number[];
    }
  > = {};
  const daily = emptyDailyMap(from, to);

  let completed = 0;
  let failed = 0;
  let returned = 0;
  const durations: number[] = [];

  for (const order of orders) {
    const deliveredAt = orderDeliveredAt(order);
    const failedAt = orderFailedAt(order);
    const returnedAt = orderReturnedAt(order);

    if (
      deliveredAt &&
      isInLocalDayRange(deliveredAt, from, to, timeZone) &&
      order.status === "Delivered"
    ) {
      status[order.status] = (status[order.status] ?? 0) + 1;
      completed += 1;
      const dk = localDayKey(deliveredAt, timeZone);
      const row = daily.get(dk);
      if (row) {
        row.completed += 1;
        row.deliveries += 1;
      }
      const duration = deliveryDurationMs(order);
      if (duration != null) durations.push(duration);
      if (order.assignedDriverId) {
        const key = order.assignedDriverId;
        if (!drivers[key]) {
          drivers[key] = {
            driverId: key,
            name: order.assignedDriverName ?? key,
            deliveries: 0,
            completed: 0,
            failed: 0,
            durations: [],
          };
        }
        drivers[key].deliveries += 1;
        drivers[key].completed += 1;
        if (duration != null) drivers[key].durations.push(duration);
      }
    }

    if (
      failedAt &&
      isInLocalDayRange(failedAt, from, to, timeZone) &&
      order.status === "Failed"
    ) {
      status[order.status] = (status[order.status] ?? 0) + 1;
      failed += 1;
      const dk = localDayKey(failedAt, timeZone);
      const row = daily.get(dk);
      if (row) {
        row.failed += 1;
        row.deliveries += 1;
      }
      if (order.assignedDriverId) {
        const key = order.assignedDriverId;
        if (!drivers[key]) {
          drivers[key] = {
            driverId: key,
            name: order.assignedDriverName ?? key,
            deliveries: 0,
            completed: 0,
            failed: 0,
            durations: [],
          };
        }
        drivers[key].deliveries += 1;
        drivers[key].failed += 1;
      }
    }

    if (
      returnedAt &&
      isInLocalDayRange(returnedAt, from, to, timeZone) &&
      order.status === "Returned"
    ) {
      status[order.status] = (status[order.status] ?? 0) + 1;
      returned += 1;
      const dk = localDayKey(returnedAt, timeZone);
      const row = daily.get(dk);
      if (row) {
        row.deliveries += 1;
      }
      if (order.assignedDriverId) {
        const key = order.assignedDriverId;
        if (!drivers[key]) {
          drivers[key] = {
            driverId: key,
            name: order.assignedDriverName ?? key,
            deliveries: 0,
            completed: 0,
            failed: 0,
            durations: [],
          };
        }
        drivers[key].deliveries += 1;
      }
    }
  }

  return {
    deliveries: completed + failed + returned,
    completed,
    failed,
    returned,
    avgDeliveryTimeMs: averageMs(durations),
    status,
    drivers,
    daily,
  };
}

function buildComparisons(
  current: ReportsPeriodTotals,
  previous: ReportsPeriodTotals | null,
): ReportsComparisons | null {
  if (!previous) return null;
  return {
    deliveries: percentChange(current.deliveries, previous.deliveries),
    completed: percentChange(current.completed, previous.completed),
    failed: percentChange(current.failed, previous.failed),
    returned: percentChange(current.returned, previous.returned),
    avgDeliveryTimeMs:
      current.avgDeliveryTimeMs != null && previous.avgDeliveryTimeMs != null
        ? percentChange(current.avgDeliveryTimeMs, previous.avgDeliveryTimeMs)
        : null,
  };
}

function buildDataCoverage(legacyFallbackCount: number): ReportsDataCoverage {
  if (legacyFallbackCount === 0) {
    return { complete: true, legacyFallbackCount: 0 };
  }
  return {
    complete: false,
    legacyFallbackCount,
    message: `${legacyFallbackCount} order(s) use legacy updatedAt fallbacks because dedicated status timestamps are missing.`,
  };
}

export async function getReportsOverview(
  query: ReportsOverviewQuery,
): Promise<ReportsOverview> {
  const timeZone = getAppTimeZone();
  const period = {
    from: query.dateFrom ?? defaultPeriod().from,
    to: query.dateTo ?? defaultPeriod().to,
  };

  const comparePeriod =
    query.compareFrom && query.compareTo
      ? { from: query.compareFrom, to: query.compareTo }
      : defaultComparePeriod(period.from);

  const [currentFetch, compareFetch] = await Promise.all([
    fetchTerminalOrdersForLocalDayRange(period.from, period.to, timeZone),
    fetchTerminalOrdersForLocalDayRange(
      comparePeriod.from,
      comparePeriod.to,
      timeZone,
    ),
  ]);

  let currentOrders = currentFetch.orders;
  let compareOrders = compareFetch.orders;

  if (query.driverId) {
    currentOrders = currentOrders.filter((o) => o.assignedDriverId === query.driverId);
    compareOrders = compareOrders.filter((o) => o.assignedDriverId === query.driverId);
  }
  if (query.status) {
    currentOrders = currentOrders.filter((o) => o.status === query.status);
    compareOrders = compareOrders.filter((o) => o.status === query.status);
  }

  const currentAgg = aggregateOrdersForPeriod(
    currentOrders,
    period.from,
    period.to,
    timeZone,
  );
  const compareAgg =
    compareOrders.length > 0
      ? aggregateOrdersForPeriod(
          compareOrders,
          comparePeriod.from,
          comparePeriod.to,
          timeZone,
        )
      : null;

  const { drivers } = await listDrivers({ limit: 200 });
  const nameById = new Map(drivers.map((d) => [d.id, d.name]));

  const driverRows = Object.values(currentAgg.drivers)
    .map((d) => {
      const terminal = d.completed + d.failed;
      return {
        driverId: d.driverId,
        name: nameById.get(d.driverId) ?? d.name,
        deliveries: d.deliveries,
        completed: d.completed,
        failed: d.failed,
        avgDeliveryTimeMs: averageMs(d.durations),
        successRate:
          terminal > 0 ? Math.round((d.completed / terminal) * 1000) / 10 : null,
      };
    })
    .sort((a, b) => b.deliveries - a.deliveries);

  const daily = [...currentAgg.daily.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const compareDaily =
    compareAgg && compareOrders.length > 0
      ? [...compareAgg.daily.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, v]) => ({ date, deliveries: v.deliveries }))
      : null;

  const totals: ReportsPeriodTotals = {
    deliveries: currentAgg.deliveries,
    completed: currentAgg.completed,
    failed: currentAgg.failed,
    returned: currentAgg.returned,
    avgDeliveryTimeMs: currentAgg.avgDeliveryTimeMs,
  };

  const previousTotals: ReportsPeriodTotals | null = compareAgg
    ? {
        deliveries: compareAgg.deliveries,
        completed: compareAgg.completed,
        failed: compareAgg.failed,
        returned: compareAgg.returned,
        avgDeliveryTimeMs: compareAgg.avgDeliveryTimeMs,
      }
    : null;

  const legacyFallbackCount =
    currentFetch.legacyFallbackCount + compareFetch.legacyFallbackCount;

  return {
    period,
    comparePeriod: compareOrders.length > 0 ? comparePeriod : null,
    totals,
    comparisons: buildComparisons(totals, previousTotals),
    dataCoverage: buildDataCoverage(legacyFallbackCount),
    breakdowns: {
      status: currentAgg.status,
      drivers: driverRows,
    },
    trends: {
      daily,
      compareDaily,
    },
  };
}
