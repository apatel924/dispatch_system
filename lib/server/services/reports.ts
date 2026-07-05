import type { Order, OrderStatus } from "@/lib/types/backend";
import { COLLECTIONS } from "@/lib/server/firestore/collections";
import { docToOrder } from "@/lib/server/firestore/helpers";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { listDrivers } from "@/lib/server/services/drivers";
import type { ReportsOverviewQuery } from "@/lib/server/validation/reports";

export interface ReportsOverview {
  totals: {
    deliveries: number;
    completed: number;
    failed: number;
    returned: number;
    orderValueCents: number;
    feesCents: number;
    unpaid: number;
    avgDeliveryTimeMs: number | null;
  };
  breakdowns: {
    status: Record<string, number>;
    payment: Record<string, number>;
    drivers: { driverId: string; name: string; deliveries: number }[];
  };
  trends: {
    daily: { date: string; deliveries: number; completed: number }[];
  };
}

const TERMINAL: OrderStatus[] = ["Delivered", "Failed", "Returned"];

function inDateRange(iso: string, from?: string, to?: string): boolean {
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function aggregateOrders(orders: Order[]): Omit<ReportsOverview, "trends"> & {
  trends: ReportsOverview["trends"];
} {
  const breakdowns = {
    status: {} as Record<string, number>,
    payment: {} as Record<string, number>,
    drivers: {} as Record<string, { driverId: string; name: string; deliveries: number }>,
  };

  let completed = 0;
  let failed = 0;
  let returned = 0;
  let orderValueCents = 0;
  let feesCents = 0;
  let unpaid = 0;
  const dailyMap = new Map<string, { deliveries: number; completed: number }>();

  for (const order of orders) {
    breakdowns.status[order.status] = (breakdowns.status[order.status] ?? 0) + 1;
    breakdowns.payment[order.paymentStatus] =
      (breakdowns.payment[order.paymentStatus] ?? 0) + 1;

    orderValueCents += order.totalCents;
    feesCents += order.deliveryFeeCents ?? 0;
    if (order.paymentStatus !== "Paid") unpaid += 1;

    if (order.status === "Delivered") completed += 1;
    if (order.status === "Failed") failed += 1;
    if (order.status === "Returned") returned += 1;

    if (order.assignedDriverId) {
      const key = order.assignedDriverId;
      if (!breakdowns.drivers[key]) {
        breakdowns.drivers[key] = {
          driverId: key,
          name: order.assignedDriverName ?? key,
          deliveries: 0,
        };
      }
      if (TERMINAL.includes(order.status)) {
        breakdowns.drivers[key].deliveries += 1;
      }
    }

    const dk = dayKey(order.createdAt);
    const daily = dailyMap.get(dk) ?? { deliveries: 0, completed: 0 };
    daily.deliveries += 1;
    if (order.status === "Delivered") daily.completed += 1;
    dailyMap.set(dk, daily);
  }

  const daily = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  return {
    totals: {
      deliveries: orders.length,
      completed,
      failed,
      returned,
      orderValueCents,
      feesCents,
      unpaid,
      avgDeliveryTimeMs: null,
    },
    breakdowns: {
      status: breakdowns.status,
      payment: breakdowns.payment,
      drivers: Object.values(breakdowns.drivers).sort((a, b) => b.deliveries - a.deliveries),
    },
    trends: { daily },
  };
}

export async function getReportsOverview(
  query: ReportsOverviewQuery,
): Promise<ReportsOverview> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.orders)
    .orderBy("createdAt", "desc")
    .limit(500)
    .get();

  let orders = snap.docs.map((doc) => docToOrder(doc.id, doc.data()));

  if (query.status) orders = orders.filter((o) => o.status === query.status);
  if (query.driverId) orders = orders.filter((o) => o.assignedDriverId === query.driverId);
  if (query.dateFrom || query.dateTo) {
    orders = orders.filter((o) => inDateRange(o.createdAt, query.dateFrom, query.dateTo));
  }

  const overview = aggregateOrders(orders);

  // Enrich driver names from roster when available
  const { drivers } = await listDrivers({ limit: 100 });
  const nameById = new Map(drivers.map((d) => [d.id, d.name]));
  overview.breakdowns.drivers = overview.breakdowns.drivers.map((d) => ({
    ...d,
    name: nameById.get(d.driverId) ?? d.name,
  }));

  return overview;
}
