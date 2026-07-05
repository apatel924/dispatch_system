import type { Order, ProofAsset } from "@/lib/types/backend";
import type { DriverOrder, DriverProfile as UiDriverProfile } from "@/lib/dash/driver-mock-data";
import type { DriverProfile as ApiDriverProfile } from "@/lib/types/backend";
import {
  completedOrders as mockCompleted,
  CURRENT_DRIVER,
  DELIVERY_STEPS,
  driverOrders as mockActiveOrders,
  getDriverOrder,
  type DeliveryStepKey,
} from "@/lib/dash/driver-mock-data";
import type { ProofType } from "@/lib/dash/driver-store";

const ACTIVE_STATUSES = new Set([
  "Assigned",
  "Picked Up",
  "En Route",
  "Out for Delivery",
  "Scheduled",
]);

export function orderToDriverOrder(order: Order): DriverOrder {
  return {
    id: order.id,
    customer: order.customerName,
    phone: order.customerPhone,
    address: order.deliveryAddress,
    unit: order.deliveryUnit,
    pickupName: order.pickupName,
    pickupAddress: order.pickupAddress,
    status: order.status,
    payment: order.paymentStatus,
    total: order.totalDisplay,
    eta: order.eta ?? "—",
    notes: order.notes,
  };
}

export function apiDriverToUiProfile(driver: ApiDriverProfile): UiDriverProfile {
  return {
    id: driver.id,
    name: driver.name,
    phone: driver.phone,
    email: driver.email,
    vehicle: driver.vehicle ?? "—",
    initials: driver.initials,
    avatarColor: driver.avatarColor,
  };
}

export function getMockDriverProfile(): UiDriverProfile {
  return CURRENT_DRIVER;
}

export function getMockActiveOrders(): DriverOrder[] {
  return mockActiveOrders;
}

export function getMockCompletedOrders(): Pick<DriverOrder, "id" | "customer" | "eta">[] {
  return mockCompleted;
}

export function getMockDriverOrder(id: string): DriverOrder | undefined {
  return getDriverOrder(id);
}

export function pickActiveOrder(orders: DriverOrder[]): DriverOrder | null {
  if (orders.length === 0) return null;
  return (
    orders.find((o) => o.status === "En Route" || o.status === "Out for Delivery") ??
    orders.find((o) => ACTIVE_STATUSES.has(o.status)) ??
    orders[0]
  );
}

export function splitDriverOrders(orders: DriverOrder[]): {
  active: DriverOrder[];
  completed: Pick<DriverOrder, "id" | "customer" | "eta">[];
} {
  const active = orders.filter((o) => ACTIVE_STATUSES.has(o.status));
  const completed = orders
    .filter((o) => o.status === "Delivered" || o.status === "Failed" || o.status === "Returned")
    .map((o) => ({ id: o.id, customer: o.customer, eta: o.eta }));
  return { active, completed };
}

export function sortRouteStops(orders: DriverOrder[]): DriverOrder[] {
  const order = ["En Route", "Out for Delivery", "Assigned", "Scheduled", "Picked Up"];
  return [...orders].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
}

export function mergeCompletedSteps(
  apiSteps: DeliveryStepKey[],
  localSteps: DeliveryStepKey[],
): DeliveryStepKey[] {
  const set = new Set([...apiSteps, ...localSteps]);
  return DELIVERY_STEPS.map((s) => s.key).filter((k) => set.has(k));
}

export function apiProofsToLocalProofs(
  proofs: ProofAsset[],
): Partial<Record<ProofType, string>> {
  const result: Partial<Record<ProofType, string>> = {};
  for (const proof of proofs) {
    if (proof.type !== "signature" && proof.type !== "exteriorPhoto") continue;
    const url = proof.downloadUrl;
    if (url) result[proof.type] = url;
  }
  return result;
}
