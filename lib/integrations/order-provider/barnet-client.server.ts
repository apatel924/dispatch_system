import {
  assertLiveOrdersReadsAllowed,
  assertLiveReadsAllowed,
  getExternalOrderProviderConfig,
  getExternalOrderProviderSecrets,
} from "@/lib/integrations/order-provider/env.server";
import { getBarnetUpstreamTimeoutMs } from "@/lib/integrations/order-provider/barnet-sync-config.server";
import type {
  BarnetLocationsMeta,
  SafeBarnetLocation,
} from "@/lib/integrations/order-provider/types";

const BARNET_PROVIDER = "barnet";

export class BarnetUpstreamTimeoutError extends Error {
  readonly path: string;

  constructor(path: string, timeoutMs: number) {
    super(`Barnet GET ${path} timed out after ${timeoutMs}ms`);
    this.name = "BarnetUpstreamTimeoutError";
    this.path = path;
  }
}

export function isBarnetUpstreamTimeoutError(
  error: unknown,
): error is BarnetUpstreamTimeoutError {
  return error instanceof BarnetUpstreamTimeoutError;
}

/** Read-only Barnet order item shape (tolerant of missing fields). */
export interface BarnetOrderItemRaw {
  name?: string;
  product_name?: string;
  title?: string;
  quantity?: number | string;
  qty?: number | string;
  price?: number | string;
  unit_price?: number | string;
  notes?: string;
  note?: string;
  [key: string]: unknown;
}

/** Read-only Barnet order detail shape (tolerant of missing fields). */
export interface BarnetOrderRaw {
  id?: number | string;
  number?: number | string;
  store_id?: number | string;
  status_display?: string;
  p_status?: string;
  p_shipment_pin?: string;
  delivery_status?: string | null;
  is_delivery?: boolean | number | string;
  total?: number;
  timestamp?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  delivery_notes?: string;
  items?: BarnetOrderItemRaw[];
  tracking_number?: string;
  processed?: boolean | number | string;
  customer_name?: string;
  customer_phone?: string;
  customer?: { name?: string; phone?: string };
  name?: string;
  phone?: string;
  customer_id?: number | string;
  delivery_address?: string;
  [key: string]: unknown;
}

/** Read-only Barnet user shape (tolerant of missing fields). */
export interface BarnetUserRaw {
  id?: number | string;
  display_name?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  ap_phone?: string;
  email?: string;
  ap_email?: string;
  shipping_address?: string | Record<string, unknown>;
  shipping?: Record<string, unknown>;
  shipping_city?: string;
  shipping_state?: string;
  shipping_zip?: string;
  [key: string]: unknown;
}

export interface BarnetFetchOrdersParams {
  page?: number;
  itemsOnPage?: number;
}

function joinUrl(base: string, prefix: string, path: string): string {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPrefix}${normalizedPath}`;
}

function buildBasicAuthHeader(apiKey: string, apiPass: string): string {
  const credentials = Buffer.from(`${apiKey}:${apiPass}`).toString("base64");
  return `Basic ${credentials}`;
}

function extractOrderList(payload: unknown): BarnetOrderRaw[] {
  if (Array.isArray(payload)) return payload as BarnetOrderRaw[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["orders", "data", "results", "items"]) {
      const value = record[key];
      if (Array.isArray(value)) return value as BarnetOrderRaw[];
    }
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isLocationObject(record: Record<string, unknown>): boolean {
  const id = record.id;
  const storeId = record.store_id;
  const hasId =
    id !== null && id !== undefined && String(id).trim().length > 0;
  const hasStoreId =
    storeId !== null &&
    storeId !== undefined &&
    String(storeId).trim().length > 0;
  return hasId || hasStoreId;
}

function toLocationRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function topLevelKeysFor(payload: unknown): string[] {
  return isRecord(payload) ? Object.keys(payload) : [];
}

/** Normalize Barnet GET /locations payloads into safe locations + shape meta. */
export function normalizeBarnetLocationsResponse(payload: unknown): {
  locations: SafeBarnetLocation[];
  meta: BarnetLocationsMeta;
} {
  if (payload === null || payload === undefined) {
    return {
      locations: [],
      meta: { rawShape: "empty", count: 0, topLevelKeys: [] },
    };
  }

  if (Array.isArray(payload)) {
    const locations = toLocationRecords(payload).map(toSafeBarnetLocation);
    return {
      locations,
      meta: {
        rawShape: "array",
        count: locations.length,
        topLevelKeys: [],
      },
    };
  }

  if (!isRecord(payload)) {
    return {
      locations: [],
      meta: { rawShape: "empty", count: 0, topLevelKeys: [] },
    };
  }

  const topLevelKeys = topLevelKeysFor(payload);

  if (Array.isArray(payload.locations)) {
    const locations = toLocationRecords(payload.locations).map(
      toSafeBarnetLocation,
    );
    return {
      locations,
      meta: {
        rawShape: "locations_wrapper",
        count: locations.length,
        topLevelKeys,
      },
    };
  }

  if (Array.isArray(payload.items)) {
    const locations = toLocationRecords(payload.items).map(toSafeBarnetLocation);
    return {
      locations,
      meta: {
        rawShape: "items_wrapper",
        count: locations.length,
        topLevelKeys,
      },
    };
  }

  if (isLocationObject(payload)) {
    const locations = [toSafeBarnetLocation(payload)];
    return {
      locations,
      meta: {
        rawShape: "single_object",
        count: locations.length,
        topLevelKeys,
      },
    };
  }

  return {
    locations: [],
    meta: {
      rawShape: "unknown_object",
      count: 0,
      topLevelKeys,
    },
  };
}

function coerceString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function coerceBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }
  return null;
}

function toSafeBarnetLocation(raw: Record<string, unknown>): SafeBarnetLocation {
  const id = raw.id;
  const storeId = raw.store_id;
  const webhookUrl = raw.webhook_url;

  return {
    id:
      typeof id === "string" || typeof id === "number"
        ? id
        : coerceString(id),
    store_id:
      typeof storeId === "string" || typeof storeId === "number"
        ? storeId
        : coerceString(storeId),
    name: coerceString(raw.name),
    address: coerceString(raw.address),
    city: coerceString(raw.city),
    state: coerceString(raw.state),
    phone: coerceString(raw.phone),
    email: coerceString(raw.email),
    is_test_store: coerceBoolean(raw.is_test_store),
    dont_use_for_ecomm: coerceBoolean(raw.dont_use_for_ecomm),
    hasWebhookUrl: coerceString(webhookUrl) !== null,
  };
}

async function barnetGet(
  path: string,
  searchParams?: Record<string, string | number>,
): Promise<unknown> {
  assertLiveReadsAllowed();

  const config = getExternalOrderProviderConfig();
  const secrets = getExternalOrderProviderSecrets();

  if (!config.apiBaseUrl || !secrets.apiKey || !secrets.apiPass) {
    throw new Error("Barnet provider credentials are not configured");
  }

  const url = new URL(
    joinUrl(config.apiBaseUrl, config.apiPathPrefix, path),
  );

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, String(value));
    }
  }

  if (secrets.otp) {
    url.searchParams.set("otp", secrets.otp);
  }

  const timeoutMs = getBarnetUpstreamTimeoutMs();
  let response: Response;

  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: buildBasicAuthHeader(secrets.apiKey, secrets.apiPass),
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new BarnetUpstreamTimeoutError(path, timeoutMs);
    }
    throw err;
  }

  if (!response.ok) {
    throw new Error(
      `Barnet GET ${path} failed with status ${response.status}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Barnet GET ${path} returned non-JSON response`);
  }

  return response.json();
}

export function getBarnetProviderName(): string {
  return BARNET_PROVIDER;
}

/** GET /locations — read-only. */
export async function fetchBarnetLocations(): Promise<{
  locationCount: number;
  meta: BarnetLocationsMeta;
}> {
  const raw = await barnetGet("/locations");
  const { meta } = normalizeBarnetLocationsResponse(raw);
  return { locationCount: meta.count, meta };
}

/** GET /locations — read-only, returns only safe fields (no secrets). */
export async function fetchSafeBarnetLocations(): Promise<{
  locations: SafeBarnetLocation[];
  meta: BarnetLocationsMeta;
}> {
  const raw = await barnetGet("/locations");
  return normalizeBarnetLocationsResponse(raw);
}

/** GET /orders — read-only, paginated. */
export async function fetchBarnetOrders(
  params: BarnetFetchOrdersParams = {},
): Promise<BarnetOrderRaw[]> {
  assertLiveOrdersReadsAllowed();

  const config = getExternalOrderProviderConfig();
  const locationId = config.locationId;
  if (!locationId) {
    throw new Error("EXTERNAL_ORDER_LOCATION_ID is required for Barnet orders");
  }

  const page = params.page ?? 1;
  const itemsOnPage = params.itemsOnPage ?? 10;

  const raw = await barnetGet("/orders", {
    location_id: locationId,
    items_on_page: itemsOnPage,
    p: page,
  });

  return extractOrderList(raw);
}

/** GET /orders filtered by id — read-only. */
export async function fetchBarnetOrderById(id: string): Promise<BarnetOrderRaw | null> {
  assertLiveOrdersReadsAllowed();

  const config = getExternalOrderProviderConfig();
  const locationId = config.locationId;
  if (!locationId) {
    throw new Error("EXTERNAL_ORDER_LOCATION_ID is required for Barnet orders");
  }

  const raw = await barnetGet("/orders", {
    location_id: locationId,
    id,
  });

  const orders = extractOrderList(raw);
  return orders[0] ?? null;
}

/** GET /orders filtered by order number — read-only. */
export async function fetchBarnetOrderByNumber(
  number: string,
): Promise<BarnetOrderRaw | null> {
  assertLiveOrdersReadsAllowed();

  const config = getExternalOrderProviderConfig();
  const locationId = config.locationId;
  if (!locationId) {
    throw new Error("EXTERNAL_ORDER_LOCATION_ID is required for Barnet orders");
  }

  const raw = await barnetGet("/orders", {
    location_id: locationId,
    number,
  });

  const orders = extractOrderList(raw);
  return orders[0] ?? null;
}

/** GET /user/{id}?id={id} — read-only. */
export async function fetchBarnetUserById(
  customerId: string,
): Promise<BarnetUserRaw | null> {
  assertLiveReadsAllowed();

  const trimmedId = customerId.trim();
  if (!trimmedId) {
    throw new Error("customerId is required for Barnet user lookup");
  }

  const raw = await barnetGet(`/user/${trimmedId}`, { id: trimmedId });

  if (raw === null || raw === undefined) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as BarnetUserRaw;
  return null;
}
