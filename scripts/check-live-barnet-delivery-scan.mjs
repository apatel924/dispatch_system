#!/usr/bin/env node
/**
 * Live Barnet delivery order diagnostic scan.
 * 1. Validates live config
 * 2. Fetches locations
 * 3. Fetches N pages of orders (ORDER_PROVIDER_SCAN_PAGES)
 * 4. Classifies delivery / pickup / unknown via shared heuristics
 * 5. Enriches customer data via GET /user/{id}
 * 6. Prints safe diagnostic summary (no full PII unless DEBUG_PII=true)
 *
 * Env overrides:
 *   ORDER_PROVIDER_SCAN_PAGES=20
 *   ORDER_PROVIDER_ITEMS_PER_PAGE=20
 *   ORDER_PROVIDER_DEBUG_CLASSIFICATION=true
 *   BARNET_DEBUG_ORDER_ID=12345
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildBarnetClassificationDebug,
  classifyBarnetOrder,
  isBarnetDeliveryOrder,
} from "../lib/integrations/order-provider/classify-barnet-order.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEBUG_PII = parseBoolEnv(process.env.DEBUG_PII, false);
const DEBUG_CLASSIFICATION = parseBoolEnv(process.env.ORDER_PROVIDER_DEBUG_CLASSIFICATION, false);
const DEBUG_ORDER_ID = emptyToUndefined(process.env.BARNET_DEBUG_ORDER_ID);
const CLASSIFICATION_DEBUG_ORDERS_PER_PAGE = 3;

function loadEnvLocal() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function emptyToUndefined(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBoolEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function coerceString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function joinUrl(base, prefix, routePath) {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;
  const normalizedPath = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${normalizedBase}${normalizedPrefix}${normalizedPath}`;
}

function extractOrderList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const key of ["orders", "data", "results", "items"]) {
      const value = payload[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

function buildAuthHeader(apiKey, apiPass) {
  return `Basic ${Buffer.from(`${apiKey}:${apiPass}`).toString("base64")}`;
}

async function barnetGet({ baseUrl, pathPrefix, apiKey, apiPass, otp, route, params = {} }) {
  const url = new URL(joinUrl(baseUrl, pathPrefix, route));
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  if (otp) url.searchParams.set("otp", otp);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: buildAuthHeader(apiKey, apiPass),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Barnet GET ${route} failed with status ${response.status}`);
  }

  return response.json();
}

function resolveCustomerName(user) {
  if (!user || typeof user !== "object") return null;
  const joined = [coerceString(user.first_name), coerceString(user.last_name)]
    .filter(Boolean)
    .join(" ");
  return (
    coerceString(user.display_name) ??
    coerceString(user.full_name) ??
    (joined.length > 0 ? joined : null)
  );
}

function resolveCustomerPhone(user) {
  if (!user || typeof user !== "object") return null;
  return coerceString(user.phone) ?? coerceString(user.ap_phone);
}

function resolveCustomerEmail(user) {
  if (!user || typeof user !== "object") return null;
  return coerceString(user.email) ?? coerceString(user.ap_email);
}

function hasAddress(order) {
  return Boolean(
    coerceString(order.address) &&
      coerceString(order.city) &&
      coerceString(order.state) &&
      coerceString(order.zip),
  );
}

function buildMissingFields({ hasCustomerName, hasPhone, hasEmail, hasAddress, hasItems, hasCustomerId }) {
  const missing = [];
  if (!hasAddress) missing.push("address");
  if (!hasItems) missing.push("items");
  if (!hasCustomerId) missing.push("customer_id");
  if (!hasCustomerName) missing.push("customer_name");
  if (!hasPhone) missing.push("customer_phone");
  if (!hasEmail) missing.push("customer_email");
  return missing;
}

function resolveOrderTimestamp(order) {
  const raw = coerceString(order.timestamp) ?? coerceString(order.created_at) ?? coerceString(order.placed_at);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return raw;
}

function summarizePageTimestamps(orders) {
  const timestamps = orders
    .map((order) => resolveOrderTimestamp(order))
    .filter(Boolean)
    .map((value) => ({ value, ms: Date.parse(value) }))
    .filter((entry) => Number.isFinite(entry.ms));

  if (timestamps.length === 0) {
    return { oldest: null, newest: null };
  }

  timestamps.sort((a, b) => a.ms - b.ms);
  return {
    oldest: timestamps[0].value,
    newest: timestamps[timestamps.length - 1].value,
  };
}

function countByClassification(orders) {
  let delivery = 0;
  let pickup = 0;
  let unknown = 0;
  for (const order of orders) {
    const kind = classifyBarnetOrder(order);
    if (kind === "delivery") delivery += 1;
    else if (kind === "pickup") pickup += 1;
    else unknown += 1;
  }
  return { delivery, pickup, unknown };
}

function printPageSummary(pageNumber, orders) {
  const counts = countByClassification(orders);
  const { oldest, newest } = summarizePageTimestamps(orders);
  console.log(
    JSON.stringify({
      page: pageNumber,
      totalOrders: orders.length,
      deliveryCount: counts.delivery,
      pickupCount: counts.pickup,
      unknownCount: counts.unknown,
      oldestOrderTimestamp: oldest,
      newestOrderTimestamp: newest,
    }),
  );
}

function printClassificationDebug(pageNumber, orders) {
  const sample = orders.slice(0, CLASSIFICATION_DEBUG_ORDERS_PER_PAGE);
  for (const order of sample) {
    const debug = buildBarnetClassificationDebug(order);
    console.log(
      JSON.stringify({
        orderId: coerceString(order.id) ?? "unknown",
        pageNumber,
        classification: debug.classification,
        fieldsUsed: debug.fieldsUsed,
        hasCustomerId: debug.hasCustomerId,
        hasAddress: debug.hasAddress,
        itemCount: debug.itemCount,
      }),
    );
  }
}

function buildTargetOrderSummary(order, pageNumber) {
  const debug = buildBarnetClassificationDebug(order);
  const itemCount = Array.isArray(order.items) ? order.items.length : 0;
  const summary = {
    orderId: coerceString(order.id) ?? "unknown",
    pageNumber,
    classification: debug.classification,
    fieldsUsed: debug.fieldsUsed,
    hasCustomerId: debug.hasCustomerId,
    hasAddress: debug.hasAddress,
    itemCount,
    total: Number(order.total ?? 0),
    timestamp: resolveOrderTimestamp(order),
    topLevelKeys: Object.keys(order).sort(),
  };

  if (DEBUG_PII) {
    summary.address = [
      coerceString(order.address),
      coerceString(order.city),
      coerceString(order.state),
      coerceString(order.zip),
    ]
      .filter(Boolean)
      .join(", ");
  }

  return summary;
}

async function enrichDeliveryOrder(order, page, client, customerCache) {
  const orderId = coerceString(order.id) ?? "unknown";
  const customerId = coerceString(order.customer_id);
  let customerName = null;
  let customerPhone = null;
  let customerEmail = null;
  let enrichmentStatus = customerId ? "pending" : "skipped";

  if (customerId) {
    if (!customerCache.has(customerId)) {
      try {
        const user = await barnetGet({
          ...client,
          route: `/user/${customerId}`,
          params: { id: customerId },
        });
        customerCache.set(customerId, user);
      } catch (err) {
        customerCache.set(customerId, {
          __error: err instanceof Error ? err.message : "lookup failed",
        });
      }
    }

    const cached = customerCache.get(customerId);
    if (cached?.__error) {
      enrichmentStatus = "failed";
    } else {
      customerName = resolveCustomerName(cached);
      customerPhone = resolveCustomerPhone(cached);
      customerEmail = resolveCustomerEmail(cached);
      enrichmentStatus = "success";
    }
  }

  const itemCount = Array.isArray(order.items) ? order.items.length : 0;
  const addressPresent = hasAddress(order);
  const missingFields = buildMissingFields({
    hasCustomerName: Boolean(customerName),
    hasPhone: Boolean(customerPhone),
    hasEmail: Boolean(customerEmail),
    hasAddress: addressPresent,
    hasItems: itemCount > 0,
    hasCustomerId: Boolean(customerId),
  });

  const dispatchReady = addressPresent && itemCount > 0;
  const customerMessagingReady = Boolean(customerPhone);

  const summary = {
    orderId,
    pageNumber: page,
    classification: classifyBarnetOrder(order),
    hasCustomerName: Boolean(customerName),
    hasPhone: Boolean(customerPhone),
    hasEmail: Boolean(customerEmail),
    hasAddress: addressPresent,
    itemCount,
    total: Number(order.total ?? 0),
    dispatchReady,
    customerMessagingReady,
    missingFields,
    enrichmentStatus,
  };

  if (DEBUG_PII) {
    summary.customerName = customerName;
    summary.customerPhone = customerPhone;
    summary.customerEmail = customerEmail;
    summary.address = [
      coerceString(order.address),
      coerceString(order.city),
      coerceString(order.state),
      coerceString(order.zip),
    ]
      .filter(Boolean)
      .join(", ");
  }

  return summary;
}

async function main() {
  loadEnvLocal();

  const mode = emptyToUndefined(process.env.EXTERNAL_ORDER_PROVIDER_MODE) ?? "mock";
  const baseUrl = emptyToUndefined(process.env.EXTERNAL_ORDER_API_BASE_URL);
  const apiKey = emptyToUndefined(process.env.EXTERNAL_ORDER_API_KEY);
  const apiPass = emptyToUndefined(process.env.EXTERNAL_ORDER_API_PASS);
  const pathPrefix = emptyToUndefined(process.env.EXTERNAL_ORDER_API_PATH_PREFIX) ?? "/swagger";
  const locationId = emptyToUndefined(process.env.EXTERNAL_ORDER_LOCATION_ID);
  const otp = emptyToUndefined(process.env.EXTERNAL_ORDER_OTP);
  const pages = parsePositiveInt(
    process.env.ORDER_PROVIDER_SCAN_PAGES ??
      process.env.EXTERNAL_ORDER_SYNC_PAGES,
    5,
  );
  const itemsPerPage = parsePositiveInt(
    process.env.ORDER_PROVIDER_ITEMS_PER_PAGE ??
      process.env.EXTERNAL_ORDER_SYNC_ITEMS_PER_PAGE,
    20,
  );
  const liveReadsEnabled = parseBoolEnv(process.env.EXTERNAL_ORDER_LIVE_READS_ENABLED, false);

  console.log("=== Barnet live delivery scan diagnostic ===\n");

  const configSummary = {
    mode,
    configured: Boolean(baseUrl && apiKey && apiPass),
    ordersConfigured: Boolean(baseUrl && apiKey && apiPass && locationId),
    liveReadsEnabled,
    locationId: locationId ?? null,
    pages,
    itemsPerPage,
    debugClassification: DEBUG_CLASSIFICATION,
    debugOrderId: DEBUG_ORDER_ID ?? null,
  };

  console.log("1) Live config");
  console.log(JSON.stringify(configSummary, null, 2));

  if (mode !== "live") throw new Error('EXTERNAL_ORDER_PROVIDER_MODE must be "live"');
  if (!configSummary.configured) throw new Error("Missing Barnet API credentials");
  if (!liveReadsEnabled) throw new Error("EXTERNAL_ORDER_LIVE_READS_ENABLED must be true");
  if (!locationId) throw new Error("EXTERNAL_ORDER_LOCATION_ID is required");

  const client = { baseUrl, pathPrefix, apiKey, apiPass, otp };

  console.log("\n2) Fetch locations");
  const locationsPayload = await barnetGet({ ...client, route: "/locations" });
  const locationCount = Array.isArray(locationsPayload)
    ? locationsPayload.length
    : Array.isArray(locationsPayload?.locations)
      ? locationsPayload.locations.length
      : locationsPayload && typeof locationsPayload === "object" && locationsPayload.id
        ? 1
        : 0;
  console.log(`Locations discovered: ${locationCount}`);

  console.log(`\n3) Fetch ${pages} page(s) of orders`);
  if (DEBUG_CLASSIFICATION) {
    console.log(`Classification debug: first ${CLASSIFICATION_DEBUG_ORDERS_PER_PAGE} orders per page`);
  }
  if (DEBUG_ORDER_ID) {
    console.log(`Target order lookup enabled for id=${DEBUG_ORDER_ID}`);
  }

  console.log("\nPage summaries:");
  const customerCache = new Map();
  const summaries = [];
  let targetOrderSummary = null;
  let pagesScanned = 0;
  let totalOrdersSeen = 0;
  let totalDelivery = 0;
  let totalPickup = 0;
  let totalUnknown = 0;

  for (let page = 1; page <= pages; page++) {
    const payload = await barnetGet({
      ...client,
      route: "/orders",
      params: {
        location_id: locationId,
        items_on_page: itemsPerPage,
        p: page,
      },
    });

    const orders = extractOrderList(payload);
    pagesScanned += 1;
    totalOrdersSeen += orders.length;

    const counts = countByClassification(orders);
    totalDelivery += counts.delivery;
    totalPickup += counts.pickup;
    totalUnknown += counts.unknown;

    printPageSummary(page, orders);

    if (DEBUG_CLASSIFICATION) {
      printClassificationDebug(page, orders);
    }

    if (DEBUG_ORDER_ID) {
      const match = orders.find((order) => coerceString(order.id) === DEBUG_ORDER_ID);
      if (match) {
        targetOrderSummary = buildTargetOrderSummary(match, page);
      }
    }

    for (const order of orders) {
      if (!isBarnetDeliveryOrder(order)) continue;
      summaries.push(await enrichDeliveryOrder(order, page, client, customerCache));
    }

    if (DEBUG_ORDER_ID && targetOrderSummary) {
      break;
    }

    if (orders.length === 0) {
      console.log(`Stopping early: page ${page} returned 0 orders.`);
      break;
    }
  }

  console.log("\nScan totals:");
  console.log(
    JSON.stringify({
      pagesScanned,
      totalOrdersSeen,
      deliveryCount: totalDelivery,
      pickupCount: totalPickup,
      unknownCount: totalUnknown,
    }),
  );

  if (DEBUG_ORDER_ID) {
    console.log("\n4) Target order lookup");
    if (targetOrderSummary) {
      console.log(JSON.stringify(targetOrderSummary, null, 2));
    } else {
      console.log(`Order id=${DEBUG_ORDER_ID} not found in first ${pagesScanned} page(s).`);
    }
  }

  console.log(`\n${DEBUG_ORDER_ID ? "5" : "4"}) Delivery orders found: ${summaries.length}`);
  console.log(`\n${DEBUG_ORDER_ID ? "6" : "5"}) Safe diagnostic summary`);
  for (const row of summaries) {
    console.log(JSON.stringify(row));
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("❌ Barnet delivery scan diagnostic failed");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
