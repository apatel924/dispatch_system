import type {
  DriverProfile,
  ImportLog,
  Order,
  OrderStatusEvent,
  ProofAsset,
} from "@/lib/types/backend";
import type { ReportsOverview } from "@/lib/server/services/reports";
import type { ReviewProofInput } from "@/lib/server/validation/proofs";
import type { OrderImportInput } from "@/lib/server/validation/import";
import { getCurrentIdToken, isAuthConfigured } from "@/lib/auth/firebase-client";

export class AdminApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  if (isAuthConfigured()) {
    try {
      const token = await getCurrentIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      // No session — request may 401; caller falls back to mock
    }
  }
  return headers;
}

export async function adminFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(await authHeaders());
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
    throw new AdminApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

export async function fetchOrdersList(params?: {
  limit?: number;
  driverId?: string;
  status?: string;
}): Promise<{ orders: Order[]; total: number; nextCursor?: string }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.driverId) qs.set("driverId", params.driverId);
  if (params?.status) qs.set("status", params.status);
  const query = qs.toString();
  return adminFetch(`/api/orders${query ? `?${query}` : ""}`);
}

export async function fetchOrderDetail(
  id: string,
): Promise<{ order: Order; statusEvents: OrderStatusEvent[] }> {
  return adminFetch(`/api/orders/${encodeURIComponent(id)}`);
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
  driverId?: string;
  status?: string;
}): Promise<{ overview: ReportsOverview }> {
  const qs = new URLSearchParams();
  if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params?.dateTo) qs.set("dateTo", params.dateTo);
  if (params?.driverId) qs.set("driverId", params.driverId);
  if (params?.status) qs.set("status", params.status);
  const query = qs.toString();
  return adminFetch(`/api/reports/overview${query ? `?${query}` : ""}`);
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
}

export interface ExternalOrderDiagnostics {
  dispatchReady: boolean;
  customerMessagingReady: boolean;
  missingFields: string[];
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
  customerName: string | null;
  customerPhone: string | null;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  deliveryInstructions: string | null;
  itemsCount: number;
  createdAt: string;
  updatedAt: string;
  diagnostics: ExternalOrderDiagnostics;
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

export async function previewLiveExternalOrdersApi(): Promise<LiveOrderPreviewResponse> {
  return adminFetch("/api/integrations/order-provider/live-preview");
}

export async function scanLiveDeliveryOrdersApi(): Promise<LiveDeliveryScanResponse> {
  return adminFetch("/api/integrations/order-provider/live-delivery-scan");
}

export async function fetchLiveLocations(): Promise<LiveLocationsResponse> {
  return adminFetch("/api/integrations/order-provider/live-locations");
}

export async function runLiveOrderProviderSync(): Promise<OrderProviderSyncResponse> {
  return adminFetch("/api/integrations/order-provider/live-sync", { method: "POST" });
}
