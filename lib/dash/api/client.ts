import type {
  DriverProfile,
  ImportLog,
  ConsumerNote,
  Order,
  OrderStatus,
  OrderStatusEvent,
  ProofAsset,
  PublicConsumerNote,
} from "@/lib/types/backend";
import type { ReportsOverview } from "@/lib/server/services/reports";
import type { DashboardStats } from "@/lib/server/services/dashboard-stats";
import type { ReviewProofInput } from "@/lib/server/validation/proofs";
import type { OrderImportInput } from "@/lib/server/validation/import";
import {
  getCurrentIdToken,
  isAuthConfigured,
  type AuthPortal,
} from "@/lib/auth/firebase-client";
import {
  ACCOUNT_DISABLED_CODE,
  ACCOUNT_DISABLED_MESSAGE,
} from "@/lib/auth/account-status";
import { handleAccountDisabledResponse } from "@/lib/dash/api/account-disabled";

export class AdminApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

async function authHeaders(portal: AuthPortal): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  if (isAuthConfigured()) {
    try {
      const token = await getCurrentIdToken(portal);
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      // No session — request may 401
    }
  }
  return headers;
}

/**
 * Authenticated fetch using the specified portal's Firebase Auth token.
 * Admin helpers must use "admin"; driver helpers must use "driver".
 */
export async function portalFetch<T>(
  portal: AuthPortal,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(await authHeaders(portal));
  if (init?.headers) {
    const extra = new Headers(init.headers);
    extra.forEach((v, k) => headers.set(k, v));
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body.error === "string" ? body.error : res.statusText || "Request failed";
    const code = typeof body.code === "string" ? body.code : undefined;

    if (code === ACCOUNT_DISABLED_CODE) {
      await handleAccountDisabledResponse(
        portal,
        typeof body.error === "string" ? body.error : ACCOUNT_DISABLED_MESSAGE,
      );
    }

    throw new AdminApiError(message, res.status, code);
  }
  return res.json() as Promise<T>;
}

/** Admin / dispatcher API calls — always uses adminAuth token. */
export async function adminFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  return portalFetch<T>("admin", path, init);
}

/** Driver API calls — always uses driverAuth token. */
export async function driverFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  return portalFetch<T>("driver", path, init);
}

export async function fetchOrdersList(params?: {
  limit?: number;
  driverId?: string;
  status?: string;
  search?: string;
}): Promise<{ orders: Order[]; total: number; nextCursor?: string }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.driverId) qs.set("driverId", params.driverId);
  if (params?.status) qs.set("status", params.status);
  if (params?.search) qs.set("search", params.search);
  const query = qs.toString();
  return adminFetch(`/api/orders${query ? `?${query}` : ""}`);
}

export async function fetchOrderDetail(
  id: string,
): Promise<{ order: Order; statusEvents: OrderStatusEvent[]; consumerNotes: ConsumerNote[] }> {
  return adminFetch(`/api/orders/${encodeURIComponent(id)}`);
}

export async function acknowledgeConsumerNoteApi(
  orderId: string,
  noteId: string,
): Promise<{ note: ConsumerNote }> {
  return adminFetch(
    `/api/orders/${encodeURIComponent(orderId)}/consumer-notes/${encodeURIComponent(noteId)}/acknowledge`,
    { method: "POST" },
  );
}

export async function updateOrderStatusApi(
  orderId: string,
  body: {
    status: OrderStatus;
    note?: string;
    stepKey?: import("@/lib/types/backend").DeliveryStepKey;
  },
): Promise<{ order: Order; event: OrderStatusEvent }> {
  return adminFetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createOrderApi(
  body: Record<string, unknown>,
): Promise<{ order: Order }> {
  return adminFetch("/api/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchDriversList(params?: {
  limit?: number;
}): Promise<{ drivers: DriverProfile[]; nextCursor?: string }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return adminFetch(`/api/drivers${query ? `?${query}` : ""}`);
}

export async function fetchDriverDetail(
  id: string,
): Promise<{ driver: DriverProfile }> {
  return adminFetch(`/api/drivers/${encodeURIComponent(id)}`);
}

export async function updateDriverApi(
  id: string,
  body: {
    name?: string;
    phone?: string;
    vehicle?: string;
    status?: "Available" | "Inactive" | "Busy" | "Suspended";
    adminNote?: string;
    acknowledgeActiveAssignments?: boolean;
  },
): Promise<{ driver: DriverProfile }> {
  return adminFetch(`/api/drivers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function updateDriverCredentialsApi(
  id: string,
  body: { loginEmail?: string; password?: string },
): Promise<{ ok: true }> {
  return adminFetch(`/api/drivers/${encodeURIComponent(id)}/credentials`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function fetchDriverAccount(
  id: string,
): Promise<{ account: import("@/lib/types/backend").DriverAccountAccess }> {
  return adminFetch(`/api/drivers/${encodeURIComponent(id)}/account`);
}

export async function updateDriverAccountApi(
  id: string,
  body: {
    loginEmail?: string;
    password?: string;
    confirmPassword?: string;
    displayName?: string;
    disabled?: boolean;
    linkAuthUid?: string;
  },
): Promise<{ account: import("@/lib/types/backend").DriverAccountAccess }> {
  return adminFetch(`/api/drivers/${encodeURIComponent(id)}/account`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function rotateOrderTrackingLinkApi(
  orderId: string,
): Promise<{
  linkCreated: boolean;
  smsAttempted: boolean;
  smsSent: boolean;
  message: string;
  copyUrl?: string;
  version?: number;
  expiresAt?: string;
}> {
  return adminFetch(`/api/orders/${encodeURIComponent(orderId)}/tracking-link`, {
    method: "POST",
  });
}

export async function fetchOrderProofs(
  orderId: string,
): Promise<{ proofs: ProofAsset[] }> {
  return adminFetch(`/api/orders/${encodeURIComponent(orderId)}/proofs`);
}

export async function reviewProofApi(
  orderId: string,
  proofId: string,
  body: ReviewProofInput,
): Promise<{ proof: ProofAsset }> {
  const qs = new URLSearchParams({ orderId });
  return adminFetch(
    `/api/proofs/${encodeURIComponent(proofId)}/review?${qs.toString()}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function runOrderImport(
  body: OrderImportInput,
): Promise<{
  imported: number;
  orders: Order[];
  errors?: string[];
  log: ImportLog;
}> {
  return adminFetch("/api/integrations/order-import", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchImportLogs(params?: {
  limit?: number;
  source?: string;
}): Promise<{ logs: ImportLog[]; nextCursor?: string }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.source) qs.set("source", params.source);
  const query = qs.toString();
  return adminFetch(`/api/integrations/import-logs${query ? `?${query}` : ""}`);
}

export async function fetchReportsOverview(params?: {
  dateFrom?: string;
  dateTo?: string;
  compareFrom?: string;
  compareTo?: string;
  driverId?: string;
  status?: string;
}): Promise<{ overview: ReportsOverview }> {
  const qs = new URLSearchParams();
  if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params?.dateTo) qs.set("dateTo", params.dateTo);
  if (params?.compareFrom) qs.set("compareFrom", params.compareFrom);
  if (params?.compareTo) qs.set("compareTo", params.compareTo);
  if (params?.driverId) qs.set("driverId", params.driverId);
  if (params?.status) qs.set("status", params.status);
  const query = qs.toString();
  return adminFetch(`/api/reports/overview${query ? `?${query}` : ""}`);
}

export async function fetchDashboardStats(): Promise<{ stats: DashboardStats }> {
  return adminFetch("/api/dashboard/stats");
}

export interface OrderProviderHealthResponse {
  ok: boolean;
  mode: "mock" | "live";
  configured: boolean;
  ordersConfigured: boolean;
  liveReadsEnabled: boolean;
  liveSyncEnabled: boolean;
  readsDisabled: boolean;
}

export interface LiveOrderProviderHealthResponse extends OrderProviderHealthResponse {
  apiPathPrefix: string;
  locationId: string | null;
  hasOtp: boolean;
  hasWebhookSecret: boolean;
  probe?: {
    attempted: boolean;
    ok: boolean;
    locationCount?: number;
    error?: string;
  };
}

export interface LiveOrderPreviewResponse {
  ok: boolean;
  mode: "live";
  orders: ExternalOrderRow[];
  intakeOrders: ExternalOrderIntakeRow[];
  total: number;
  pagesScanned: number;
  totalOrdersSeen: number;
  deliveryOrdersFound: number;
  pickupOrdersIgnored: number;
  unknownOrdersIgnored: number;
  pagesConfigured: number;
  itemsOnPage: number;
  locationId: string;
}

export interface LiveDeliveryScanResponse {
  ok: boolean;
  mode: "live";
  orders: ExternalOrderRow[];
  intakeOrders: ExternalOrderIntakeRow[];
  pagesScanned: number;
  totalOrdersSeen: number;
  deliveryOrdersFound: number;
  pickupOrdersIgnored: number;
  unknownOrdersIgnored: number;
  pagesConfigured: number;
  itemsPerPage: number;
  locationId: string;
}

export interface SafeBarnetLocationRow {
  id: string | number | null;
  store_id: string | number | null;
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  is_test_store: boolean | null;
  dont_use_for_ecomm: boolean | null;
  hasWebhookUrl: boolean;
}

export type BarnetLocationsRawShape =
  | "single_object"
  | "array"
  | "items_wrapper"
  | "locations_wrapper"
  | "empty"
  | "unknown_object";

export interface BarnetLocationsMeta {
  rawShape: BarnetLocationsRawShape;
  count: number;
  topLevelKeys: string[];
}

export interface LiveLocationsResponse {
  ok: boolean;
  locations: SafeBarnetLocationRow[];
  meta: BarnetLocationsMeta;
}

export interface OrderProviderSyncResponse {
  ok: boolean;
  mode: "mock" | "live";
  pagesScanned: number;
  totalOrdersSeen: number;
  deliveryOrdersFound: number;
  pickupOrdersIgnored: number;
  unknownOrdersIgnored: number;
  inserted: number;
  updated: number;
  total: number;
  skipped?: boolean;
  reason?: string;
  status?: string;
  message?: string;
  nextEligibleAt?: string;
  durationMs?: number;
  unchangedOrders?: number;
  needsReview?: number;
  readyToDispatch?: number;
  enrichmentErrors?: number;
  syncErrors?: number;
  invalidOrders?: number;
  exclusionReasons?: Record<string, number>;
}

export interface ExternalOrderDiagnostics {
  dispatchReady: boolean;
  customerMessagingReady: boolean;
  customerEnrichmentStatus: "success" | "failed" | "skipped" | null;
  hasCustomerId: boolean;
  customerEnrichmentAvailable: boolean;
  hasCustomerName: boolean;
  hasCustomerPhone: boolean;
  hasCustomerEmail: boolean;
  missingFields: string[];
}

export interface LiveOrderDetailDiagnostics extends ExternalOrderDiagnostics {
  externalOrderId: string;
  externalOrderNumber: string | null;
  topLevelKeys: string[];
  possibleCustomerKeyPaths: string[];
  ignoredCustomerLikePaths: string[];
  hasUserIdCandidate: boolean;
  hasPhoneCandidate: boolean;
  hasUsableCustomerLink: boolean;
  hasDeliveryAddress: boolean;
  hasDeliveryInstructions: boolean;
  hasItems: boolean;
}

export interface LiveCustomerDetailDiagnostics {
  customerId: string;
  hasCustomerName: boolean;
  hasCustomerPhone: boolean;
  hasCustomerEmail: boolean;
  hasShippingAddress: boolean;
  topLevelKeys: string[];
}

export interface LiveCustomerDetailResponse {
  ok: boolean;
  mode: "live";
  diagnostics: LiveCustomerDetailDiagnostics;
}

export interface LiveOrderDetailResponse {
  ok: boolean;
  mode: "live";
  diagnostics: LiveOrderDetailDiagnostics;
}

export interface ExternalOrderRow {
  provider: string;
  externalOrderId: string;
  externalOrderNumber: string | null;
  status: string;
  deliveryStatus: string | null;
  isDelivery: boolean;
  total: number;
  placedAt: string;
  externalCustomerId: string | null;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  deliveryInstructions: string | null;
  itemsCount: number;
  customerMessagingReady: boolean;
  customerEnrichmentStatus: "success" | "failed" | "skipped" | null;
  dispatchReady: boolean;
  createdAt: string;
  updatedAt: string;
  diagnostics: ExternalOrderDiagnostics;
}

export interface OrderProviderEnvDiagnosticsResponse {
  vercelEnvironment: string | null;
  providerModePresent: boolean;
  providerMode: string | null;
  baseUrlPresent: boolean;
  pathPrefixPresent: boolean;
  apiKeyPresent: boolean;
  apiPassPresent: boolean;
  locationIdPresent: boolean;
  liveReadsValue: string | null;
  liveSyncValue: string | null;
}

export async function fetchOrderProviderHealth(): Promise<OrderProviderHealthResponse> {
  const res = await fetch("/api/integrations/order-provider/health");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body.error === "string" ? body.error : res.statusText || "Health check failed";
    throw new AdminApiError(message, res.status);
  }
  return res.json() as Promise<OrderProviderHealthResponse>;
}

export async function runOrderProviderMockSync(): Promise<OrderProviderSyncResponse> {
  return adminFetch("/api/integrations/order-provider/mock-sync", { method: "POST" });
}

export async function fetchSyncedExternalOrders(params?: {
  limit?: number;
}): Promise<{ orders: ExternalOrderRow[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return adminFetch(`/api/integrations/order-provider/orders${query ? `?${query}` : ""}`);
}

export async function fetchLiveOrderProviderHealth(params?: {
  probe?: boolean;
}): Promise<LiveOrderProviderHealthResponse> {
  const qs = new URLSearchParams();
  if (params?.probe) qs.set("probe", "true");
  const query = qs.toString();
  return adminFetch(
    `/api/integrations/order-provider/live-health${query ? `?${query}` : ""}`,
  );
}

export async function fetchOrderProviderEnvDiagnostics(): Promise<OrderProviderEnvDiagnosticsResponse> {
  return adminFetch("/api/integrations/order-provider/env-diagnostics", {
    cache: "no-store",
  });
}

export async function previewLiveExternalOrdersApi(): Promise<LiveOrderPreviewResponse> {
  return adminFetch("/api/integrations/order-provider/live-preview");
}

export async function scanLiveDeliveryOrdersApi(): Promise<LiveDeliveryScanResponse> {
  return adminFetch("/api/integrations/order-provider/live-delivery-scan");
}

export async function probeLiveOrderDetailApi(params: {
  id?: string;
  number?: string;
}): Promise<LiveOrderDetailResponse> {
  const qs = new URLSearchParams();
  if (params.id) qs.set("id", params.id);
  if (params.number) qs.set("number", params.number);
  const query = qs.toString();
  return adminFetch(
    `/api/integrations/order-provider/live-order-detail${query ? `?${query}` : ""}`,
  );
}

export async function probeLiveCustomerDetailApi(params: {
  customerId: string;
}): Promise<LiveCustomerDetailResponse> {
  const qs = new URLSearchParams();
  qs.set("customerId", params.customerId);
  return adminFetch(
    `/api/integrations/order-provider/live-customer-detail?${qs.toString()}`,
  );
}

export async function fetchLiveLocations(): Promise<LiveLocationsResponse> {
  return adminFetch("/api/integrations/order-provider/live-locations");
}

export async function runLiveOrderProviderSync(options?: {
  overrideQuietHours?: boolean;
}): Promise<OrderProviderSyncResponse> {
  return adminFetch("/api/integrations/order-provider/live-sync", {
    method: "POST",
    body: JSON.stringify({
      overrideQuietHours: options?.overrideQuietHours === true,
    }),
  });
}

export interface ExternalOrderProviderSyncState {
  lastSuccessfulSyncAt: string | null;
  lastAttemptedSyncAt?: string | null;
  lastScanAt?: string | null;
  lastNewOrderImportedAt?: string | null;
  lastResult?: string | null;
  lastError: string | null;
  lastSyncSummary: {
    inserted: number;
    updated: number;
    deliveryOrdersFound: number;
    pagesScanned: number;
    unchanged?: number;
    invalid?: number;
    enrichmentErrors?: number;
    syncErrors?: number;
    needsReview?: number;
    readyToDispatch?: number;
  } | null;
}

export interface BarnetSyncHealthView {
  state:
    | "healthy"
    | "running"
    | "outside_hours"
    | "stale"
    | "degraded"
    | "failed"
    | "locked"
    | "disabled"
    | "not_configured"
    | "never_run";
  message: string;
  outsideOperatingHours: boolean;
  isRunning: boolean;
  isLocked: boolean;
  lastAttemptedSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastScanAt?: string | null;
  lastNewOrderImportedAt?: string | null;
  lastResult?: string | null;
  lastDurationMs: number | null;
  lastSafeErrorMessage: string | null;
  lastErrorCode: string | null;
  lastRunStatus: string | null;
  counts: {
    pagesScanned?: number;
    ordersExamined?: number;
    deliveryOrdersFound?: number;
    inserted?: number;
    updated?: number;
    unchanged?: number;
    skipped?: number;
    invalid?: number;
    enrichmentErrors?: number;
    syncErrors?: number;
    needsReview?: number;
    readyToDispatch?: number;
  } | null;
  nextExpectedEligibleScanAt: string | null;
}

export interface ExternalOrderIntakeRow {
  id: string;
  provider: string;
  externalOrderId: string;
  externalOrderNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  itemsCount: number;
  total: number;
  sourceStatus: string;
  dispatchReady: boolean;
  needsReview: boolean;
  reviewReasons: string[];
  customerMessagingReady: boolean;
  missingFields: string[];
  assignmentStatus: "unassigned" | "assigned";
  dispatchStatus: "pending" | "needs_review" | "ready" | "assigned" | "promoted";
  assignedDriverId: string | null;
  assignedDriverName: string | null;
  isPreview: boolean;
  alreadyImported: boolean;
  promoted: boolean;
  promotedOrderId: string | null;
  promotedAt: string | null;
  updatedAt: string;
  lastSyncedAt: string | null;
}

export interface ExternalOrderIntakeSummary {
  ordersScanned: number;
  deliveryOrdersFound: number;
  readyToDispatch: number;
  needsReview: number;
  alreadyImported: number;
  assigned: number;
}

export interface ExternalOrderIntakeDetail {
  id: string;
  provider: string;
  externalOrderId: string;
  externalOrderNumber: string | null;
  sourceLocationId: string | null;
  sourceStatus: string;
  deliveryStatus: string | null;
  paymentStatus: string | null;
  placedAt: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
  isDelivery: boolean;
  customer: {
    externalCustomerId: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
  };
  delivery: {
    address1: string | null;
    address2: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    formattedAddress: string | null;
    notes: string | null;
  };
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number | null;
    notes: string | null;
    sku?: string | null;
    category?: string | null;
  }>;
  totals: {
    subtotal: number | null;
    tax: number | null;
    discount: number | null;
    total: number;
  };
  dispatchReady: boolean;
  needsReview: boolean;
  reviewReasons: string[];
  customerMessagingReady: boolean;
  customerEnrichmentStatus: "success" | "failed" | "skipped" | null;
  missingFields: string[];
  assignmentStatus: "unassigned" | "assigned";
  dispatchStatus: "pending" | "needs_review" | "ready" | "assigned" | "promoted";
  assignedDriverId: string | null;
  assignedDriverName: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  promoted: boolean;
  promotedOrderId: string | null;
  promotedAt: string | null;
  dispatchChecks: {
    deliveryOrderConfirmed: boolean;
    customerNamePresent: boolean;
    customerPhonePresent: boolean;
    deliveryAddressPresent: boolean;
    itemsPresent: boolean;
    notAlreadyAssigned: boolean;
  };
}

export interface OrderProviderHealthWithSync extends OrderProviderHealthResponse {
  syncState?: ExternalOrderProviderSyncState;
  syncHealth?: BarnetSyncHealthView;
}

export async function fetchOrderProviderHealthWithSync(): Promise<OrderProviderHealthWithSync> {
  return adminFetch("/api/integrations/order-provider/health?includeSyncState=true");
}

export async function fetchExternalOrderIntakeList(params?: {
  limit?: number;
}): Promise<{
  orders: ExternalOrderIntakeRow[];
  syncState: ExternalOrderProviderSyncState;
  summary: ExternalOrderIntakeSummary;
  total: number;
}> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return adminFetch(`/api/integrations/order-provider/intake${query ? `?${query}` : ""}`);
}

export async function fetchExternalOrderIntakeDetail(
  id: string,
): Promise<{ order: ExternalOrderIntakeDetail }> {
  return adminFetch(`/api/integrations/order-provider/orders/${encodeURIComponent(id)}`);
}

export async function assignExternalOrderDriverApi(
  id: string,
  body: { driverId: string; overrideMissingFields?: boolean },
): Promise<{ order: ExternalOrderIntakeDetail }> {
  return adminFetch(
    `/api/integrations/order-provider/orders/${encodeURIComponent(id)}/assign-driver`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function promoteExternalOrderApi(
  id: string,
  body?: { overrideMissingFields?: boolean },
): Promise<{
  order: Order;
  externalOrder: ExternalOrderIntakeDetail;
  alreadyPromoted: boolean;
}> {
  return adminFetch(`/api/external-orders/${encodeURIComponent(id)}/promote`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export async function fetchAdminNotifications(params?: {
  limit?: number;
  unreadOnly?: boolean;
}): Promise<{
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    source: string;
    externalOrderId?: string | null;
    dispatchOrderId?: string | null;
    link?: string | null;
    createdAt: string;
  }>;
  unreadCount: number;
}> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.unreadOnly) qs.set("unreadOnly", "true");
  const query = qs.toString();
  return adminFetch(`/api/admin/notifications${query ? `?${query}` : ""}`);
}

export async function markAdminNotificationReadApi(id: string): Promise<{
  ok: boolean;
  notification?: {
    id: string;
    read: boolean;
    link?: string | null;
  };
}> {
  return adminFetch(`/api/admin/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
  });
}

export async function markAllAdminNotificationsReadApi(): Promise<{
  ok: boolean;
  updated: number;
}> {
  return adminFetch("/api/admin/notifications", {
    method: "POST",
    body: JSON.stringify({ markAllRead: true }),
  });
}
