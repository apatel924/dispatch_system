import {
  actorLabelForEvent,
  compareStatusEventsForTimeline,
  eventTitleForStatusEvent,
  STATUS_TITLES,
} from "@/lib/delivery-workflow";
import { DEFAULT_APP_TIMEZONE } from "@/lib/app-timezone";
import type {
  DriverProfile,
  DriverStatus,
  Order,
  OrderStatus,
  OrderStatusEvent,
  PaymentStatus,
  ProofAsset,
  ProofReviewStatus,
  ProofType,
  ImportLog,
} from "@/lib/types/backend";
import type { ReportsOverview } from "@/lib/server/services/reports";
import { formatAvgMs } from "@/lib/delivery-metrics";
import {
  drivers as mockDrivers,
  orders as mockOrders,
  type Driver,
  type Order as MockOrder,
} from "@/lib/dash/mock-data";

export interface AdminOrderRow {
  id: string;
  external: string;
  customer: string;
  phone: string;
  address: string;
  driver: string | null;
  driverId: string | null;
  status: OrderStatus;
  payment: PaymentStatus;
  total: string;
  created: string;
  updated: string;
}

export interface AdminDriverRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: DriverStatus;
  activeDeliveries: number;
  completedToday: number;
  failedToday: number;
  averageTime: string;
  averageDeliveryTimeMs?: number | null;
  lastActive: string;
  avatarColor: string;
  initials: string;
  successRate?: number | null;
  deliveries?: number;
  vehicle?: string;
  adminNote?: string;
  joinedDate?: string;
}

export interface AdminOrderDetail {
  id: string;
  status: OrderStatus;
  payment: PaymentStatus;
  external: string;
  customerName: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  deliveryUnit?: string;
  notes: string;
  pickupName: string;
  pickupAddress: string;
  deliveryInstructions: string;
  paymentMethod: string;
  subtotal: string;
  deliveryFee: string;
  tax: string;
  total: string;
  createdDate: string;
  createdTime: string;
  updatedDate: string;
  updatedTime: string;
  trackingLinkVersion?: number;
  trackingLinkIssuedAt?: string;
  driver: {
    id: string | null;
    name: string;
    phone: string;
    initials: string;
    avatarColor: string;
    status: DriverStatus;
    vehicle: string;
  } | null;
  statusEvents: {
    id: string;
    title: string;
    by: string;
    date: string;
    time: string;
    status: OrderStatus;
  }[];
  driverNotes: {
    id: string;
    text: string;
    date: string;
    time: string;
  }[];
}

export interface AdminProofItem {
  id: string;
  type: ProofType;
  label: string;
  downloadUrl?: string;
  reviewStatus: ProofReviewStatus;
  reviewNote?: string;
  uploadedAt: string;
}

const PROOF_LABELS: Record<ProofType, string> = {
  signature: "Customer Signature",
  exteriorPhoto: "Exterior / Address",
  idVerification: "ID Verification",
};

export function proofToAdminItem(proof: ProofAsset): AdminProofItem {
  return {
    id: proof.id,
    type: proof.type,
    label: PROOF_LABELS[proof.type] ?? proof.type,
    downloadUrl: proof.downloadUrl,
    reviewStatus: proof.reviewStatus,
    reviewNote: proof.reviewNote,
    uploadedAt: formatDisplayDateTime(proof.uploadedAt).combined,
  };
}

export interface AdminImportLogRow {
  id: string;
  source: string;
  status: ImportLog["status"];
  ordersImported: number;
  ordersFailed: number;
  createdAt: string;
  errorSummary?: string;
}

const IMPORT_SOURCE_LABELS: Record<string, string> = {
  "mock-uber": "Mock Uber",
  "mock-doordash": "Mock DoorDash",
  "mock-amazon": "Mock Amazon",
};

export function importLogToAdminRow(log: ImportLog): AdminImportLogRow {
  return {
    id: log.id,
    source: IMPORT_SOURCE_LABELS[log.source] ?? log.source,
    status: log.status,
    ordersImported: log.ordersImported,
    ordersFailed: log.ordersFailed,
    createdAt: formatDisplayDateTime(log.createdAt).combined,
    errorSummary: log.errors?.join("; "),
  };
}

const MOCK_IMPORT_LOGS: AdminImportLogRow[] = [
  {
    id: "demo-1",
    source: "Mock Uber",
    status: "success",
    ordersImported: 1,
    ordersFailed: 0,
    createdAt: "May 15, 2025, 2:30 PM",
  },
  {
    id: "demo-2",
    source: "Mock DoorDash",
    status: "partial",
    ordersImported: 2,
    ordersFailed: 1,
    createdAt: "May 14, 2025, 9:15 AM",
    errorSummary: "Duplicate external ID",
  },
];

export function getMockAdminImportLogs(): AdminImportLogRow[] {
  return MOCK_IMPORT_LOGS;
}

export interface AdminReportsView {
  period: { from: string; to: string };
  comparePeriod: { from: string; to: string } | null;
  totals: {
    deliveries: number;
    completed: number;
    failed: number;
    returned: number;
    avgDeliveryTime: string;
  };
  comparisons: {
    deliveries: number | null;
    completed: number | null;
    failed: number | null;
    returned: number | null;
    avgDeliveryTimeMs: number | null;
  } | null;
  statusBreakdown: { completed: number; failed: number; returned: number };
  drivers: {
    id: string;
    name: string;
    deliveries: number;
    completed: number;
    failed: number;
    initials: string;
    avatarColor: string;
    successRate: number | null;
    avgDeliveryTime: string;
  }[];
  trendDays: { label: string; deliveries: number; completed: number; failed: number }[];
  compareTrendDays: { label: string; deliveries: number }[] | null;
  dataCoverage?: {
    complete: boolean;
    message?: string;
    legacyFallbackCount: number;
  };
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function reportsOverviewToAdminView(overview: ReportsOverview): AdminReportsView {
  return {
    period: overview.period,
    comparePeriod: overview.comparePeriod,
    totals: {
      deliveries: overview.totals.deliveries,
      completed: overview.totals.completed,
      failed: overview.totals.failed,
      returned: overview.totals.returned,
      avgDeliveryTime: formatAvgMs(overview.totals.avgDeliveryTimeMs),
    },
    comparisons: overview.comparisons,
    statusBreakdown: {
      completed: overview.totals.completed,
      failed: overview.totals.failed,
      returned: overview.totals.returned,
    },
    drivers: overview.breakdowns.drivers.slice(0, 10).map((d, i) => ({
      id: d.driverId,
      name: d.name,
      deliveries: d.deliveries,
      completed: d.completed,
      failed: d.failed,
      initials: d.name
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      avatarColor: [
        "bg-info-soft text-info",
        "bg-purple-soft text-purple",
        "bg-orange-soft text-orange",
        "bg-success-soft text-success",
        "bg-warning-soft text-warning-foreground",
      ][i % 5],
      successRate: d.successRate,
      avgDeliveryTime: formatAvgMs(d.avgDeliveryTimeMs),
    })),
    trendDays: overview.trends.daily.map((d) => ({
      label: d.date.slice(5),
      deliveries: d.deliveries,
      completed: d.completed,
      failed: d.failed,
    })),
    compareTrendDays: overview.trends.compareDaily?.map((d) => ({
      label: d.date.slice(5),
      deliveries: d.deliveries,
    })) ?? null,
    dataCoverage: overview.dataCoverage,
  };
}

export function getMockAdminReports(): AdminReportsView {
  const topDrivers = mockDrivers.filter((d) => d.deliveries).slice(0, 5);
  const from = "2024-05-10";
  const to = "2024-05-16";
  return {
    period: { from, to },
    comparePeriod: { from: "2024-05-03", to: "2024-05-09" },
    totals: {
      deliveries: 248,
      completed: 208,
      failed: 18,
      returned: 22,
      avgDeliveryTime: "28m 35s",
    },
    comparisons: null,
    statusBreakdown: { completed: 208, failed: 18, returned: 22 },
    drivers: topDrivers.map((d, i) => ({
      id: d.id,
      name: d.name,
      deliveries: d.deliveries ?? 0,
      completed: d.deliveries ?? 0,
      failed: 0,
      initials: d.initials,
      avatarColor: d.avatarColor,
      successRate: d.successRate ?? null,
      avgDeliveryTime: d.averageTime,
    })),
    trendDays: [
      { label: "05-10", deliveries: 42, completed: 35, failed: 2 },
      { label: "05-11", deliveries: 55, completed: 48, failed: 3 },
      { label: "05-12", deliveries: 62, completed: 54, failed: 2 },
      { label: "05-13", deliveries: 78, completed: 66, failed: 4 },
      { label: "05-14", deliveries: 82, completed: 70, failed: 3 },
      { label: "05-15", deliveries: 68, completed: 58, failed: 2 },
      { label: "05-16", deliveries: 52, completed: 44, failed: 2 },
    ],
    compareTrendDays: null,
  };
}

export function formatDisplayDateTime(iso: string): { date: string; time: string; combined: string } {
  try {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
      time: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      combined: d.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    };
  } catch {
    return { date: iso, time: "", combined: iso };
  }
}

function formatCents(cents?: number): string {
  if (cents === undefined) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export function orderToAdminRow(order: Order): AdminOrderRow {
  const created = formatDisplayDateTime(order.createdAt);
  const updated = formatDisplayDateTime(order.updatedAt);
  return {
    id: order.id,
    external: order.externalOrderNumber ?? order.externalOrderId ?? "—",
    customer: order.customerName,
    phone: order.customerPhone,
    address: order.deliveryAddress,
    driver: order.assignedDriverName,
    driverId: order.assignedDriverId,
    status: order.status,
    payment: order.paymentStatus,
    total: order.totalDisplay,
    created: created.combined,
    updated: updated.combined,
  };
}

export function mockOrderToAdminRow(order: MockOrder): AdminOrderRow {
  return {
    id: order.id,
    external: order.external,
    customer: order.customer,
    phone: order.phone,
    address: order.address,
    driver: order.driver,
    driverId: null,
    status: order.status,
    payment: order.payment,
    total: order.total,
    created: order.created,
    updated: order.updated,
  };
}

export function driverToAdminRow(driver: DriverProfile): AdminDriverRow {
  return {
    id: driver.id,
    name: driver.name,
    phone: driver.phone,
    email: driver.email,
    status: driver.status,
    activeDeliveries: driver.activeDeliveries,
    completedToday: driver.completedToday,
    failedToday: driver.failedToday,
    averageTime: driver.averageDeliveryTimeMs
      ? `${Math.round(driver.averageDeliveryTimeMs / 60000)}m`
      : "—",
    averageDeliveryTimeMs: driver.averageDeliveryTimeMs ?? null,
    lastActive: driver.lastActiveAt
      ? formatDisplayDateTime(driver.lastActiveAt).combined
      : "—",
    avatarColor: driver.avatarColor,
    initials: driver.initials,
    successRate: driver.successRate ?? null,
    deliveries: driver.totalDeliveries,
    vehicle: driver.vehicle,
    adminNote: driver.adminNote,
    joinedDate: driver.createdAt
      ? formatDisplayDateTime(driver.createdAt).date
      : undefined,
  };
}

export function mockDriverToAdminRow(driver: Driver): AdminDriverRow {
  return {
    id: driver.id,
    name: driver.name,
    phone: driver.phone,
    email: driver.email,
    status: driver.status,
    activeDeliveries: driver.activeDeliveries,
    completedToday: driver.completedToday,
    failedToday: driver.failedToday,
    averageTime: driver.averageTime,
    lastActive: driver.lastActive,
    avatarColor: driver.avatarColor,
    initials: driver.initials,
    successRate: driver.successRate ?? null,
    deliveries: driver.deliveries,
    vehicle: driver.vehicle,
  };
}

function eventsToTimeline(
  events: OrderStatusEvent[],
  driverName?: string | null,
): AdminOrderDetail["statusEvents"] {
  return [...events].sort(compareStatusEventsForTimeline).map((e) => {
    const dt = formatDisplayDateTime(e.createdAt);
    return {
      id: e.id,
      title: eventTitleForStatusEvent(e),
      by: actorLabelForEvent(e, driverName),
      date: dt.date,
      time: dt.time,
      status: e.status,
    };
  });
}

export function orderToAdminDetail(
  order: Order,
  events: OrderStatusEvent[],
  assignedDriver?: DriverProfile | null,
): AdminOrderDetail {
  const created = formatDisplayDateTime(order.createdAt);
  const updated = formatDisplayDateTime(order.updatedAt);

  const driver = assignedDriver
    ? {
        id: assignedDriver.id,
        name: assignedDriver.name,
        phone: assignedDriver.phone,
        initials: assignedDriver.initials,
        avatarColor: assignedDriver.avatarColor,
        status: assignedDriver.status,
        vehicle: assignedDriver.vehicle ?? "—",
      }
    : order.assignedDriverName
      ? {
          id: order.assignedDriverId,
          name: order.assignedDriverName,
          phone: "—",
          initials: order.assignedDriverName.slice(0, 2).toUpperCase(),
          avatarColor: "bg-info-soft text-info",
          status: "Available" as DriverStatus,
          vehicle: "—",
        }
      : null;

  return {
    id: order.id,
    status: order.status,
    payment: order.paymentStatus,
    external: order.externalOrderNumber ?? order.externalOrderId ?? "—",
    customerName: order.customerName,
    companyName: order.companyName ?? order.customerName,
    contactName: order.customerName,
    phone: order.customerPhone,
    email: order.customerEmail ?? "—",
    address: order.deliveryAddress,
    deliveryUnit: order.deliveryUnit,
    notes: order.notes ?? "—",
    pickupName: order.pickupName,
    pickupAddress: order.pickupAddress,
    deliveryInstructions: order.deliveryInstructions ?? "—",
    paymentMethod: order.paymentMethod ?? "—",
    subtotal: formatCents(order.subtotalCents),
    deliveryFee: formatCents(order.deliveryFeeCents),
    tax: formatCents(order.taxCents),
    total: order.totalDisplay,
    createdDate: created.date,
    createdTime: created.time,
    updatedDate: updated.date,
    updatedTime: updated.time,
    trackingLinkVersion: order.trackingLinkVersion,
    trackingLinkIssuedAt: order.trackingLinkIssuedAt,
    driver,
    statusEvents: eventsToTimeline(events, assignedDriver?.name ?? order.assignedDriverName),
    driverNotes: events
      .filter((e) => e.actorRole === "driver" && e.note?.trim())
      .map((e) => {
        const dt = formatDisplayDateTime(e.createdAt);
        return { id: e.id, text: e.note!.trim(), date: dt.date, time: dt.time };
      }),
  };
}

export function mockOrderToAdminDetail(orderId: string): AdminOrderDetail | null {
  const row = mockOrders.find((o) => o.id === orderId);
  if (!row) return null;

  const driver = row.driver
    ? mockDrivers.find((d) => d.name === row.driver)
    : undefined;

  const created = { date: row.created.split(", ")[0] ?? row.created, time: row.created.split(", ")[1] ?? "" };
  const updated = { date: row.updated.split(", ")[0] ?? row.updated, time: row.updated.split(", ")[1] ?? "" };

  return {
    id: row.id,
    status: row.status,
    payment: row.payment,
    external: row.external,
    customerName: row.customer,
    companyName: row.customer,
    contactName: row.customer,
    phone: row.phone,
    email: "—",
    address: row.address,
    notes: "Deliver to loading dock. Call upon arrival.",
    pickupName: "Northside Pharmacy",
    pickupAddress: "4567 Medical Dr, Dallas, TX 75231",
    deliveryInstructions: "Ring doorbell. Leave with front desk if no one available.",
    paymentMethod: "—",
    subtotal: row.total,
    deliveryFee: "—",
    tax: "—",
    total: row.total,
    createdDate: created.date,
    createdTime: created.time,
    updatedDate: updated.date,
    updatedTime: updated.time,
    driver: driver
      ? {
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          initials: driver.initials,
          avatarColor: driver.avatarColor,
          status: driver.status,
          vehicle: "White Ford Transit",
        }
      : null,
    statusEvents: [
      { id: "mock-created", title: "Order Created", by: "Admin User", date: created.date, time: created.time, status: "New" },
      ...(row.driver
        ? [{ id: "mock-assigned", title: "Assigned to Driver", by: "System", date: created.date, time: created.time, status: "Assigned" as OrderStatus }]
        : []),
      { id: "mock-current", title: STATUS_TITLES[row.status], by: row.driver ?? "System", date: updated.date, time: updated.time, status: row.status },
    ],
    driverNotes: [],
  };
}

export function getMockAdminOrders(): AdminOrderRow[] {
  return mockOrders.map(mockOrderToAdminRow);
}

export function getMockAdminDrivers(): AdminDriverRow[] {
  return mockDrivers.map(mockDriverToAdminRow);
}
