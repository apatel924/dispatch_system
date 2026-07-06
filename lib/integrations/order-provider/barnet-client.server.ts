import {
  assertLiveReadsAllowed,
  getExternalOrderProviderConfig,
  getExternalOrderProviderSecrets,
} from "@/lib/integrations/order-provider/env.server";

const BARNET_PROVIDER = "barnet";

/** Read-only Barnet order summary shape (tolerant of missing fields). */
export interface BarnetOrderRaw {
  id?: number | string;
  number?: number | string;
  status_display?: string;
  p_status?: string;
  delivery_status?: string | null;
  is_delivery?: boolean | number | string;
  total?: number;
  timestamp?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
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

function extractLocationCount(payload: unknown): number {
  if (Array.isArray(payload)) return payload.length;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["locations", "data", "results", "items"]) {
      const value = record[key];
      if (Array.isArray(value)) return value.length;
    }
  }
  return 0;
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

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: buildBasicAuthHeader(secrets.apiKey, secrets.apiPass),
      Accept: "application/json",
    },
    cache: "no-store",
  });

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
  raw: unknown;
  locationCount: number;
}> {
  const raw = await barnetGet("/locations");
  return { raw, locationCount: extractLocationCount(raw) };
}

/** GET /orders — read-only, paginated. */
export async function fetchBarnetOrders(
  params: BarnetFetchOrdersParams = {},
): Promise<BarnetOrderRaw[]> {
  const config = getExternalOrderProviderConfig();
  if (!config.locationId) {
    throw new Error("EXTERNAL_ORDER_LOCATION_ID is required for Barnet orders");
  }

  const page = params.page ?? 1;
  const itemsOnPage = params.itemsOnPage ?? 10;

  const raw = await barnetGet("/orders", {
    location_id: config.locationId,
    items_on_page: itemsOnPage,
    p: page,
  });

  return extractOrderList(raw);
}

/** GET /orders filtered by id — read-only. */
export async function fetchBarnetOrderById(id: string): Promise<BarnetOrderRaw | null> {
  const config = getExternalOrderProviderConfig();
  if (!config.locationId) {
    throw new Error("EXTERNAL_ORDER_LOCATION_ID is required for Barnet orders");
  }

  const raw = await barnetGet("/orders", {
    location_id: config.locationId,
    id,
  });

  const orders = extractOrderList(raw);
  return orders[0] ?? null;
}

/** GET /orders filtered by order number — read-only. */
export async function fetchBarnetOrderByNumber(
  number: string,
): Promise<BarnetOrderRaw | null> {
  const config = getExternalOrderProviderConfig();
  if (!config.locationId) {
    throw new Error("EXTERNAL_ORDER_LOCATION_ID is required for Barnet orders");
  }

  const raw = await barnetGet("/orders", {
    location_id: config.locationId,
    number,
  });

  const orders = extractOrderList(raw);
  return orders[0] ?? null;
}
