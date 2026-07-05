import type {
  AuditLog,
  DeliveryStepKey,
  DriverProfile,
  DriverStatus,
  ImportLog,
  Order,
  OrderStatus,
  OrderStatusEvent,
  PaymentStatus,
  ProofAsset,
  ProofReviewStatus,
  ProofType,
  UserRole,
} from "@/lib/types/backend";

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

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
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
    deliveredAt: data.deliveredAt ? asString(data.deliveredAt) : undefined,
    scheduledFor: data.scheduledFor ? asString(data.scheduledFor) : undefined,
    createdBy: data.createdBy ? asString(data.createdBy) : undefined,
    source: asString(data.source, "manual"),
    importLogId: data.importLogId ? asString(data.importLogId) : undefined,
  };
}

export function docToDriver(id: string, data: FirebaseFirestore.DocumentData): DriverProfile {
  return {
    id,
    userId: asString(data.userId),
    name: asString(data.name),
    phone: asString(data.phone),
    email: asString(data.email),
    status: asString(data.status, "Inactive") as DriverStatus,
    vehicle: data.vehicle ? asString(data.vehicle) : undefined,
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
    lastActiveAt: data.lastActiveAt ? asString(data.lastActiveAt) : undefined,
    createdAt: asString(data.createdAt),
    updatedAt: asString(data.updatedAt),
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
    downloadUrl: data.downloadUrl ? asString(data.downloadUrl) : undefined,
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
