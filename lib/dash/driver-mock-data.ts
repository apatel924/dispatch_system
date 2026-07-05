import type { OrderStatus, PaymentStatus } from "./mock-data";

export interface DriverOrder {
  id: string;
  customer: string;
  phone: string;
  address: string;
  unit?: string;
  pickupName: string;
  pickupAddress: string;
  status: OrderStatus;
  payment: PaymentStatus;
  total: string;
  eta: string;
  notes?: string;
}

export interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  initials: string;
  avatarColor: string;
}

export interface DriverMessage {
  id: string;
  from: string;
  preview: string;
  time: string;
  unread: boolean;
}

export const CURRENT_DRIVER: DriverProfile = {
  id: "DRV-10012",
  name: "James Carter",
  phone: "(555) 234-9876",
  email: "james.carter@qre.com",
  vehicle: "White Ford Transit",
  initials: "JC",
  avatarColor: "bg-info-soft text-info",
};

/** James Carter's 4 active orders for today */
export const driverOrders: DriverOrder[] = [
  {
    id: "QRX-10190",
    customer: "Acme Manufacturing",
    phone: "(555) 123-4567",
    address: "123 Industrial Way, Dallas, TX 75201",
    unit: "Suite 200 / Buzz 42",
    pickupName: "Northside Pharmacy",
    pickupAddress: "4567 Medical Dr, Dallas, TX 75231",
    status: "En Route",
    payment: "Paid",
    total: "$18.50",
    eta: "12:15 PM",
    notes: "Deliver to receiving dock. Ring bell. Verify recipient.",
  },
  {
    id: "QRX-10191",
    customer: "Northside Pharmacy",
    phone: "(555) 234-5678",
    address: "456 Medical Dr, Dallas, TX 75206",
    pickupName: "Quick-Run Express Hub",
    pickupAddress: "11823 170 St NW, Edmonton, AB",
    status: "Assigned",
    payment: "Paid",
    total: "$58.00",
    eta: "10:45 AM",
    notes: "Leave with front desk if no one available.",
  },
  {
    id: "QRX-10192",
    customer: "Global Office Supplies",
    phone: "(555) 345-6789",
    address: "789 Commerce St, Dallas, TX 75204",
    pickupName: "Quick-Run Express Hub",
    pickupAddress: "11823 170 St NW, Edmonton, AB",
    status: "Out for Delivery",
    payment: "Paid",
    total: "$75.50",
    eta: "11:30 AM",
  },
  {
    id: "QRX-10193",
    customer: "Downtown Deli",
    phone: "(555) 567-8901",
    address: "321 Main St, Dallas, TX 75201",
    pickupName: "Downtown Deli Kitchen",
    pickupAddress: "321 Main St, Dallas, TX 75201",
    status: "Scheduled",
    payment: "Paid",
    total: "$32.15",
    eta: "2:15 PM",
  },
];

export const completedOrders: Pick<DriverOrder, "id" | "customer" | "eta">[] = [
  { id: "QRX-10188", customer: "Seaside Coffee Co.", eta: "9:05 AM" },
  { id: "QRX-10187", customer: "West End Hardware", eta: "8:21 AM" },
];

export const driverMessages: DriverMessage[] = [
  { id: "m1", from: "Dispatch", preview: "QRX-10191 priority — customer requested early delivery", time: "10:02 AM", unread: true },
  { id: "m2", from: "Dispatch", preview: "Route updated — stop 3 moved up", time: "9:45 AM", unread: true },
  { id: "m3", from: "Support", preview: "Your vehicle inspection is due next week", time: "Yesterday", unread: true },
  { id: "m4", from: "Dispatch", preview: "Great job on yesterday's deliveries!", time: "Yesterday", unread: false },
];

export function getDriverOrder(id: string): DriverOrder | undefined {
  return driverOrders.find((o) => o.id === id);
}

export function getActiveOrder(): DriverOrder {
  return driverOrders.find((o) => o.status === "En Route" || o.status === "Out for Delivery") ?? driverOrders[0];
}

export type DeliveryStepKey =
  | "arrivedPickup"
  | "pickedUp"
  | "outForDelivery"
  | "arrivedDestination"
  | "verifyId"
  | "signature"
  | "exteriorPhoto";

export interface DeliveryStep {
  key: DeliveryStepKey;
  label: string;
  type: "tap" | "proof";
  proofType?: "signature" | "photo";
}

export const DELIVERY_STEPS: DeliveryStep[] = [
  { key: "arrivedPickup", label: "Arrived at pickup", type: "tap" },
  { key: "pickedUp", label: "Picked up", type: "tap" },
  { key: "outForDelivery", label: "Out for delivery", type: "tap" },
  { key: "arrivedDestination", label: "Arrived at destination", type: "tap" },
  { key: "verifyId", label: "Verify ID", type: "tap" },
  { key: "signature", label: "Capture signature", type: "proof", proofType: "signature" },
  { key: "exteriorPhoto", label: "Upload exterior photo", type: "proof", proofType: "photo" },
];

export const DEFAULT_COMPLETED_STEPS: DeliveryStepKey[] = [];
