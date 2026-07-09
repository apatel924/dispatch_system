import {
  actorLabelForEvent,
  compareStatusEventsForTimeline,
  eventTitleForStatusEvent,
  STATUS_TITLES,
} from "@/lib/delivery-workflow";
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
  lastActive: string;
  avatarColor: string;
  initials: string;
  rating?: number;
  successRate?: number;
  deliveries?: number;
  vehicle?: string;
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
  totals: {
    deliveries: number;
    completed: number;
    failed: number;
    returned: number;
    orderValue: string;
    fees: string;
    unpaid: number;
    avgDeliveryTime: string;
  };
  statusBreakdown: { completed: number; failed: number; returned: number };
  paymentBreakdown: { paid: number; pending: number; unpaid: number };
  drivers: { id: string; name: string; deliveries: number; initials: string; avatarColor: string; successRate?: number }[];
  trendDays: { label: string; deliveries: number; completed: number }[];
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatAvgMs(ms: number | null): string {
  if (ms == null) return "—";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

export function reportsOverviewToAdminView(overview: ReportsOverview): AdminReportsView {
  const payment = overview.breakdowns.payment;
  return {
    totals: {
      deliveries: overview.totals.deliveries,
      completed: overview.totals.completed,
      failed: overview.totals.failed,
      returned: overview.totals.returned,
      orderValue: formatMoney(overview.totals.orderValueCents),
      fees: formatMoney(overview.totals.feesCents),
      unpaid: overview.totals.unpaid,
      avgDeliveryTime: formatAvgMs(overview.totals.avgDeliveryTimeMs),
    },
    statusBreakdown: {
      completed: overview.totals.completed,
      failed: overview.totals.failed,
      returned: overview.totals.returned,
    },
    paymentBreakdown: {
      paid: payment.Paid ?? 0,
      pending: payment.Pending ?? 0,
      unpaid: payment.Unpaid ?? 0,
    },
    drivers: overview.breakdowns.drivers.slice(0, 5).map((d, i) => ({
      id: d.driverId,
      name: d.name,
      deliveries: d.deliveries,
      initials: d.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
      avatarColor: ["bg-info-soft text-info", "bg-purple-soft text-purple", "bg-orange-soft text-orange", "bg-success-soft text-success", "bg-warning-soft text-warning-foreground"][i % 5],
    })),
    trendDays: overview.trends.daily.map((d) => ({
      label: d.date,
      deliveries: d.deliveries,
      completed: d.completed,
    })),
  };
}

export function getMockAdminReports(): AdminReportsView {
  const topDrivers = mockDrivers.filter((d) => d.deliveries).slice(0, 5);
  return {
    totals: {
      deliveries: 248,
      completed: 208,
      failed: 18,
      returned: 22,
      orderValue: "$24,890.50",
      fees: "$3,210.00",
      unpaid: 16,
      avgDeliveryTime: "28m 35s",
    },
    statusBreakdown: { completed: 208, failed: 18, returned: 22 },
    paymentBreakdown: { paid: 194, pending: 32, unpaid: 16 },
    drivers: topDrivers.map((d) => ({
      id: d.id,
      name: d.name,
      deliveries: d.deliveries ?? 0,
      initials: d.initials,
      avatarColor: d.avatarColor,
      successRate: d.successRate,
    })),
    trendDays: [
      { label: "May 10", deliveries: 42, completed: 35 },
      { label: "May 11", deliveries: 55, completed: 48 },
      { label: "May 12", deliveries: 62, completed: 54 },
      { label: "May 13", deliveries: 78, completed: 66 },
      { label: "May 14", deliveries: 82, completed: 70 },
      { label: "May 15", deliveries: 68, completed: 58 },
      { label: "May 16", deliveries: 52, completed: 44 },
    ],
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
    lastActive: driver.lastActiveAt
      ? formatDisplayDateTime(driver.lastActiveAt).combined
      : "—",
    avatarColor: driver.avatarColor,
    initials: driver.initials,
    rating: driver.rating,
    successRate: driver.successRate,
    deliveries: driver.totalDeliveries,
    vehicle: driver.vehicle,
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
    rating: driver.rating,
    successRate: driver.successRate,
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
    driver,
    statusEvents: eventsToTimeline(events, assignedDriver?.name ?? order.assignedDriverName),
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
  };
}

export function getMockAdminOrders(): AdminOrderRow[] {
  return mockOrders.map(mockOrderToAdminRow);
}

export function getMockAdminDrivers(): AdminDriverRow[] {
  return mockDrivers.map(mockDriverToAdminRow);
}
