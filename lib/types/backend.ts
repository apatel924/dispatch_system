/**
 * Unified backend data model — single source of truth for admin and driver screens.
 * See docs/backend-implementation-plan.md Section 4.
 */

export type UserRole = "admin" | "dispatcher" | "driver";

export interface UserProfile {
  uid: string;
  email: string;
  phone?: string;
  displayName: string;
  role: UserRole;
  driverId?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  isActive: boolean;
}

export type DriverStatus = "Available" | "Busy" | "Inactive" | "Suspended";

export interface DriverProfile {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  status: DriverStatus;
  vehicle?: string;
  avatarColor: string;
  initials: string;
  activeDeliveries: number;
  completedToday: number;
  failedToday: number;
  averageDeliveryTimeMs?: number;
  rating?: number;
  successRate?: number;
  totalDeliveries?: number;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | "New"
  | "Assigned"
  | "Picked Up"
  | "En Route"
  | "Out for Delivery"
  | "Delivered"
  | "Failed"
  | "Returned"
  | "Scheduled";

export type PaymentStatus = "Paid" | "Pending" | "Unpaid";

export type DeliveryStepKey =
  | "arrivedPickup"
  | "pickedUp"
  | "outForDelivery"
  | "arrivedDestination"
  | "verifyId"
  | "signature"
  | "exteriorPhoto";

export interface Order {
  id: string;
  trackingId: string;
  externalOrderId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  companyName?: string;
  pickupName: string;
  pickupAddress: string;
  deliveryAddress: string;
  deliveryUnit?: string;
  deliveryArea?: string;
  deliveryInstructions?: string;
  deliveryWindow?: string;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  subtotalCents?: number;
  deliveryFeeCents?: number;
  taxCents?: number;
  totalCents: number;
  totalDisplay: string;
  eta?: string;
  notes?: string;
  completedSteps: DeliveryStepKey[];
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  scheduledFor?: string;
  createdBy?: string;
  source: "manual" | "import" | string;
  importLogId?: string;
}

export interface OrderStatusEvent {
  id: string;
  orderId: string;
  status: OrderStatus;
  stepKey?: DeliveryStepKey;
  note?: string;
  actorId: string;
  actorRole: UserRole | "system";
  createdAt: string;
}

export type ProofType = "signature" | "exteriorPhoto" | "idVerification";
export type ProofReviewStatus = "pending" | "approved" | "rejected";

export interface ProofAsset {
  id: string;
  orderId: string;
  type: ProofType;
  stepKey: DeliveryStepKey;
  storagePath: string;
  downloadUrl?: string;
  mimeType: string;
  fileSizeBytes?: number;
  uploadedBy: string;
  uploadedAt: string;
  reviewStatus: ProofReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface ImportLog {
  id: string;
  source: string;
  status: "success" | "partial" | "failed";
  ordersImported: number;
  ordersFailed: number;
  errors?: string[];
  payloadSummary?: string;
  initiatedBy: string;
  createdAt: string;
  completedAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: "order" | "driver" | "proof" | "import" | "user";
  entityId: string;
  actorId: string;
  actorRole: UserRole | "system";
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface TrackingView {
  trackingId: string;
  status: OrderStatus;
  statusLabel: string;
  estimatedArrival?: string;
  deliveryType?: string;
  driverFirstName?: string;
  vehicleDescription?: string;
  pickupName?: string;
  pickupAddress?: string;
  steps: {
    label: string;
    time?: string;
    status: "complete" | "current" | "pending";
  }[];
  notifications: {
    title: string;
    time: string;
  }[];
  lastUpdatedAt: string;
}

export interface HealthResponse {
  status: "ok";
  timestamp: string;
  version: string;
  services: {
    firebaseAdmin: "configured" | "missing";
    firebaseClient: "configured" | "missing";
  };
}

export interface ApiErrorResponse {
  error: string;
  code: string;
}
