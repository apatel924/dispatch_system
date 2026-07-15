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

import type { DriverStatus } from "@/lib/driver-status";

export type { DriverStatus };

export interface DriverProfile {
  id: string;
  /** @deprecated Prefer authUid — kept for existing Firestore documents. */
  userId: string;
  /** Stable Firebase Authentication UID for this driver login account. */
  authUid?: string;
  name: string;
  phone: string;
  email: string;
  status: DriverStatus;
  vehicle?: string;
  /** Internal administrator note — separate from order and consumer notes. */
  adminNote?: string;
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
  /** Firebase Auth account disabled (login blocked) — distinct from operational status. */
  accountDisabled?: boolean;
  accountUpdatedAt?: string;
  accountUpdatedByUid?: string;
  createdAt: string;
  updatedAt: string;
  updatedByUid?: string;
}

/** Admin-visible Firebase Authentication metadata for a driver login account. */
export interface DriverAccountAccess {
  driverId: string;
  driverName: string;
  linked: boolean;
  authUid?: string;
  loginEmail?: string;
  displayName?: string;
  disabled?: boolean;
  accountUpdatedAt?: string;
  activeOrderCount?: number;
}

/**
 * Canonical order statuses. Legacy "En Route" normalizes to "Out for Delivery"
 * via lib/order-status.ts — it is not a writable canonical value.
 */
export type OrderStatus =
  | "New"
  | "Scheduled"
  | "Assigned"
  | "Picked Up"
  | "Out for Delivery"
  | "Delivered"
  | "Failed"
  | "Returned";

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
  externalProvider?: string;
  externalOrderId?: string;
  externalOrderNumber?: string;
  externalOrderRef?: string;
  promotedAt?: string;
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
  /**
   * Present when Firestore status was not a recognized lifecycle value.
   * Order is quarantined — do not assign or transition until repaired.
   * Not a persisted lifecycle status.
   */
  unrecognizedStatusRaw?: string | null;
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
  assignedAt?: string;
  /** Set once when status first becomes Picked Up. */
  pickedUpAt?: string;
  /** Set once when status first becomes Delivered. */
  deliveredAt?: string;
  /** Set once when status first becomes Failed. */
  failedAt?: string;
  /** Set once when status first becomes Returned. */
  returnedAt?: string;
  scheduledFor?: string;
  createdBy?: string;
  source: "manual" | "import" | string;
  importLogId?: string;
  trackingUrl?: string;
  /** Latest secure tracking link version — no plaintext token or URL stored. */
  trackingLinkVersion?: number;
  trackingLinkIssuedAt?: string;
  notificationPreference?: "sms" | "email" | "both" | "none";
  customerNotifiedAt?: string;
  lastCustomerNotificationAt?: string;
}

export interface OrderStatusEvent {
  id: string;
  orderId: string;
  status: OrderStatus;
  /** Previous canonical status when this event recorded a transition or reassignment. */
  previousStatus?: OrderStatus;
  /** Distinguishes assignment/reassignment from lifecycle transitions. */
  actionType?:
    | "status_transition"
    | "assignment"
    | "reassignment"
    | "unassign"
    | "retry";
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

/** Secure opaque token document — Firestore document id is SHA-256(rawToken). */
export interface TrackingLink {
  /** SHA-256 hex digest — same as the Firestore document id. */
  id: string;
  /** Ephemeral plaintext token — only present when a link is first issued in memory. */
  token?: string;
  orderId: string;
  publicReference: string;
  version: number;
  expiresAt?: string;
  revokedAt?: string;
  replacedByVersion?: number;
  createdAt: string;
  /** SHA-256 hex digest of the opaque token (must match document id). */
  tokenHash?: string;
  /** Legacy documents that used the plaintext token as the document id. */
  legacyInsecure?: boolean;
}

export type ConsumerNoteSource = "consumer";

export interface ConsumerNote {
  id: string;
  orderId: string;
  source: ConsumerNoteSource;
  text: string;
  createdAt: string;
  trackingLinkVersion: number;
  acknowledgedAt?: string;
  acknowledgedByUid?: string;
}

/** Consumer-safe note shape — no internal order ids or staff uids. */
export interface PublicConsumerNote {
  id: string;
  source: ConsumerNoteSource;
  text: string;
  createdAt: string;
}

export type ConsumerTrackingStepStatus = "complete" | "current" | "pending" | "failed";

export interface ConsumerTrackingStep {
  key: string;
  label: string;
  time?: string;
  status: ConsumerTrackingStepStatus;
}

export type ConsumerTerminalState = "delivered" | "failed" | "cancelled";

export interface ConsumerTrackingView {
  publicReference: string;
  status: OrderStatus;
  statusHeading: string;
  estimatedArrival?: string;
  lastUpdatedAt: string;
  pickupName?: string;
  deliveryDestination: string;
  deliveryInstructions?: string;
  steps: ConsumerTrackingStep[];
  consumerNotes: PublicConsumerNote[];
  notesEnabled: boolean;
  supportPhone: string;
  supportEmail: string;
  supportHours: string;
  terminalState?: ConsumerTerminalState;
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
