import type {
  AuditLog,
  ConsumerNote,
  DeliveryStepKey,
  DriverProfile,
  ImportLog,
  Order,
  OrderStatus,
  OrderStatusEvent,
  PaymentStatus,
  ProofAsset,
  ProofReviewStatus,
  ProofType,
  TrackingLink,
  UserRole,
} from "@/lib/types/backend";
import { normalizeDriverStatus } from "@/lib/driver-status";

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatCentsToDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Firestore rejects undefined field values — omit them before writes. */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asIsoString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function docToOrder(id: string, data: FirebaseFirestore.DocumentData): Order {
  return {
    id,
    trackingId: asString(data.trackingId, id),
    externalOrderId: data.externalOrderId ? asString(data.externalOrderId) : undefined,
    externalProvider: data.externalProvider ? asString(data.externalProvider) : undefined,
    externalOrderNumber: data.externalOrderNumber ? asString(data.externalOrderNumber) : undefined,
    externalOrderRef: data.externalOrderRef ? asString(data.externalOrderRef) : undefined,
    promotedAt: data.promotedAt ? asString(data.promotedAt) : undefined,
    customerName: asString(data.customerName),
    customerPhone: asString(data.customerPhone),
    customerEmail: data.customerEmail ? asString(data.customerEmail) : undefined,
    companyName: data.companyName ? asString(data.companyName) : undefined,
    pickupName: asString(data.pickupName),
    pickupAddress: asString(data.pickupAddress),
    deliveryAddress: asString(data.deliveryAddress),
    deliveryUnit: data.deliveryUnit ? asString(data.deliveryUnit) : undefined,
    deliveryArea: data.deliveryArea ? asString(data.deliveryArea) : undefined,
    deliveryInstructions: data.deliveryInstructions
      ? asString(data.deliveryInstructions)
      : undefined,
    deliveryWindow: data.deliveryWindow ? asString(data.deliveryWindow) : undefined,
    assignedDriverId: asNullableString(data.assignedDriverId),
    assignedDriverName: asNullableString(data.assignedDriverName),
    status: asString(data.status, "New") as OrderStatus,
    paymentStatus: asString(data.paymentStatus, "Pending") as PaymentStatus,
    paymentMethod: data.paymentMethod ? asString(data.paymentMethod) : undefined,
    subtotalCents: data.subtotalCents !== undefined ? asNumber(data.subtotalCents) : undefined,
    deliveryFeeCents:
      data.deliveryFeeCents !== undefined ? asNumber(data.deliveryFeeCents) : undefined,
    taxCents: data.taxCents !== undefined ? asNumber(data.taxCents) : undefined,
    totalCents: asNumber(data.totalCents),
    totalDisplay: asString(data.totalDisplay, "$0.00"),
    eta: data.eta ? asString(data.eta) : undefined,
    notes: data.notes ? asString(data.notes) : undefined,
    completedSteps: asStringArray(data.completedSteps) as DeliveryStepKey[],
    createdAt: asString(data.createdAt),
    updatedAt: asString(data.updatedAt),
    assignedAt: data.assignedAt ? asString(data.assignedAt) : undefined,
    pickedUpAt: data.pickedUpAt ? asString(data.pickedUpAt) : undefined,
    deliveredAt: data.deliveredAt ? asString(data.deliveredAt) : undefined,
    failedAt: data.failedAt ? asString(data.failedAt) : undefined,
    returnedAt: data.returnedAt ? asString(data.returnedAt) : undefined,
    scheduledFor: data.scheduledFor ? asString(data.scheduledFor) : undefined,
    createdBy: data.createdBy ? asString(data.createdBy) : undefined,
    source: asString(data.source, "manual"),
    importLogId: data.importLogId ? asString(data.importLogId) : undefined,
  trackingUrl: data.trackingUrl ? asString(data.trackingUrl) : undefined,
    trackingLinkVersion:
      data.trackingLinkVersion !== undefined ? asNumber(data.trackingLinkVersion) : undefined,
    trackingLinkIssuedAt: data.trackingLinkIssuedAt
      ? asString(data.trackingLinkIssuedAt)
      : undefined,
  };
}

export function resolveDriverAuthUid(
  data: FirebaseFirestore.DocumentData,
): string | undefined {
  const authUid = typeof data.authUid === "string" ? data.authUid.trim() : "";
  if (authUid) return authUid;
  const userId = typeof data.userId === "string" ? data.userId.trim() : "";
  return userId || undefined;
}

export function docToDriver(id: string, data: FirebaseFirestore.DocumentData): DriverProfile {
  const authUid = resolveDriverAuthUid(data);
  const rawStatus = asString(data.status, "Inactive");
  const status = normalizeDriverStatus(rawStatus) ?? "Inactive";

  return {
    id,
    userId: authUid ?? asString(data.userId),
    authUid,
    name: asString(data.name),
    phone: asString(data.phone),
    email: asString(data.email),
    status,
    vehicle: data.vehicle ? asString(data.vehicle) : undefined,
    adminNote: data.adminNote ? asString(data.adminNote) : undefined,
    avatarColor: asString(data.avatarColor, "bg-muted text-muted-foreground"),
    initials: asString(data.initials),
    activeDeliveries: asNumber(data.activeDeliveries),
    completedToday: asNumber(data.completedToday),
    failedToday: asNumber(data.failedToday),
    averageDeliveryTimeMs:
      data.averageDeliveryTimeMs !== undefined
        ? asNumber(data.averageDeliveryTimeMs)
        : undefined,
    rating: data.rating !== undefined ? asNumber(data.rating) : undefined,
    successRate: data.successRate !== undefined ? asNumber(data.successRate) : undefined,
    totalDeliveries:
      data.totalDeliveries !== undefined ? asNumber(data.totalDeliveries) : undefined,
    lastActiveAt: data.lastActiveAt ? asIsoString(data.lastActiveAt) : undefined,
    accountDisabled: data.accountDisabled === true ? true : undefined,
    accountUpdatedAt: data.accountUpdatedAt ? asIsoString(data.accountUpdatedAt) : undefined,
    accountUpdatedByUid: data.accountUpdatedByUid
      ? asString(data.accountUpdatedByUid)
      : undefined,
    createdAt: asIsoString(data.createdAt),
    updatedAt: asIsoString(data.updatedAt),
    updatedByUid: data.updatedByUid ? asString(data.updatedByUid) : undefined,
  };
}

export function docToStatusEvent(
  id: string,
  data: FirebaseFirestore.DocumentData,
): OrderStatusEvent {
  return {
    id,
    orderId: asString(data.orderId),
    status: asString(data.status) as OrderStatus,
    stepKey: data.stepKey ? (asString(data.stepKey) as DeliveryStepKey) : undefined,
    note: data.note ? asString(data.note) : undefined,
    actorId: asString(data.actorId),
    actorRole: asString(data.actorRole, "system") as UserRole | "system",
    createdAt: asString(data.createdAt),
  };
}

export function docToProof(id: string, data: FirebaseFirestore.DocumentData): ProofAsset {
  return {
    id,
    orderId: asString(data.orderId),
    type: asString(data.type) as ProofType,
    stepKey: asString(data.stepKey) as DeliveryStepKey,
    storagePath: asString(data.storagePath),
    mimeType: asString(data.mimeType),
    fileSizeBytes: data.fileSizeBytes !== undefined ? asNumber(data.fileSizeBytes) : undefined,
    uploadedBy: asString(data.uploadedBy),
    uploadedAt: asString(data.uploadedAt),
    reviewStatus: asString(data.reviewStatus, "pending") as ProofReviewStatus,
    reviewedBy: data.reviewedBy ? asString(data.reviewedBy) : undefined,
    reviewedAt: data.reviewedAt ? asString(data.reviewedAt) : undefined,
    reviewNote: data.reviewNote ? asString(data.reviewNote) : undefined,
  };
}

export function docToImportLog(id: string, data: FirebaseFirestore.DocumentData): ImportLog {
  return {
    id,
    source: asString(data.source),
    status: asString(data.status, "failed") as ImportLog["status"],
    ordersImported: asNumber(data.ordersImported),
    ordersFailed: asNumber(data.ordersFailed),
    errors: Array.isArray(data.errors)
      ? data.errors.filter((e): e is string => typeof e === "string")
      : undefined,
    payloadSummary: data.payloadSummary ? asString(data.payloadSummary) : undefined,
    initiatedBy: asString(data.initiatedBy),
    createdAt: asString(data.createdAt),
    completedAt: data.completedAt ? asString(data.completedAt) : undefined,
  };
}

export function docToAuditLog(id: string, data: FirebaseFirestore.DocumentData): AuditLog {
  return {
    id,
    action: asString(data.action),
    entityType: asString(data.entityType) as AuditLog["entityType"],
    entityId: asString(data.entityId),
    actorId: asString(data.actorId),
    actorRole: asString(data.actorRole, "system") as UserRole | "system",
    metadata:
      data.metadata && typeof data.metadata === "object"
        ? (data.metadata as Record<string, unknown>)
        : undefined,
    createdAt: asString(data.createdAt),
  };
}

export function docToTrackingLink(
  id: string,
  data: FirebaseFirestore.DocumentData,
): TrackingLink {
  return {
    id,
    orderId: asString(data.orderId),
    publicReference: asString(data.publicReference),
    version: asNumber(data.version, 1),
    expiresAt: data.expiresAt ? asString(data.expiresAt) : undefined,
    revokedAt: data.revokedAt ? asString(data.revokedAt) : undefined,
    replacedByVersion:
      data.replacedByVersion !== undefined ? asNumber(data.replacedByVersion) : undefined,
    createdAt: asString(data.createdAt),
    tokenHash: data.tokenHash ? asString(data.tokenHash) : undefined,
    legacyInsecure: data.legacyInsecure === true,
  };
}

export function docToConsumerNote(
  id: string,
  data: FirebaseFirestore.DocumentData,
): ConsumerNote {
  return {
    id,
    orderId: asString(data.orderId),
    source: "consumer",
    text: asString(data.text),
    createdAt: asString(data.createdAt),
    trackingLinkVersion: asNumber(data.trackingLinkVersion, 1),
    acknowledgedAt: data.acknowledgedAt ? asString(data.acknowledgedAt) : undefined,
    acknowledgedByUid: data.acknowledgedByUid ? asString(data.acknowledgedByUid) : undefined,
  };
}
