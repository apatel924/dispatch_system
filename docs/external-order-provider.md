# External Order Provider Integration

This document describes the server-only external order provider integration. **Mock mode is the default.** Live Barnet-style reads are gated behind explicit environment flags and admin-protected API routes.

## Purpose

The integration provides:

- Typed provider and normalized order models
- Server-side environment validation (Zod)
- A **mock** provider client (no network calls)
- A **read-only live** Barnet adapter (`GET /locations`, `GET /orders` only)
- Normalization from provider shape to internal `NormalizedExternalOrder`
- Firestore upsert into the `externalOrders` collection
- Health, mock-sync, live-health, live-locations, live-preview, and live-sync API routes
- Admin UI on **Settings** to view health, run mock/live operations, and list synced orders

**Not included:** automated polling, order creation in the main orders flow, payment processing, order deletion, or calls to `POST /create_order`, `DELETE /delete_order`, `POST /order_pay`, or `POST /apply_promo`.

## Mock Mode

When `EXTERNAL_ORDER_PROVIDER_MODE=mock` (the default):

- No external HTTP requests are made
- `mock-client.server.ts` returns 5 realistic fake delivery orders with generic names
- Mock sync normalizes those orders and upserts them into Firestore (document key = `externalOrderId`)
- Health check returns `{ ok: true, mode: "mock", configured: true, liveReadsEnabled: false, liveSyncEnabled: false, readsDisabled: false }`

Mock mode remains fully functional regardless of live env vars.

## Live Read-Only Mode

Live mode splits configuration into two tiers:

### Base live config (GET /locations, config checks)

| Requirement | Env var |
|-------------|---------|
| Mode set to live | `EXTERNAL_ORDER_PROVIDER_MODE=live` |
| API base URL | `EXTERNAL_ORDER_API_BASE_URL` |
| API credentials | `EXTERNAL_ORDER_API_KEY`, `EXTERNAL_ORDER_API_PASS` |
| Reads explicitly enabled | `EXTERNAL_ORDER_LIVE_READS_ENABLED=true` |

`EXTERNAL_ORDER_LOCATION_ID` is **not** required for `GET /locations` or **Discover Live Locations**.

### Orders live config (GET /orders, preview, sync)

All base live config requirements **plus**:

| Requirement | Env var |
|-------------|---------|
| Location | `EXTERNAL_ORDER_LOCATION_ID` |

Optional:

| Variable | Purpose |
|----------|---------|
| `EXTERNAL_ORDER_API_PATH_PREFIX` | API path prefix (default `/swagger`) |
| `EXTERNAL_ORDER_OTP` | One-time password if required by provider |
| `EXTERNAL_ORDER_WEBHOOK_SECRET` | Reserved for future webhook verification |
| `EXTERNAL_ORDER_CUSTOMER_MESSAGING_ENABLED` | Allow customer SMS from synced orders when phone is present (default `false`) |

### Safety gates

- **Live location GET** (`fetchBarnetLocations`, Discover Locations) runs when mode is `live`, base credentials are configured, and `EXTERNAL_ORDER_LIVE_READS_ENABLED=true`. Does **not** require `EXTERNAL_ORDER_LOCATION_ID`.
- **Live order GET** (`fetchBarnetOrders`, live-preview) requires base config **plus** `EXTERNAL_ORDER_LOCATION_ID`.
- **Live Firestore sync** only runs when order config is complete, reads are enabled, **and** `EXTERNAL_ORDER_LIVE_SYNC_ENABLED=true`. Only **delivery** orders (`is_delivery=true`) are synced. During sync, orders with `customer_id` are enriched via read-only `GET /user/{id}`. Only safe customer fields (`customerName`, `customerPhone`, `customerEmail`, `externalCustomerId`) are stored in Firestore — never the raw Barnet user payload. `rawPayload` (order only) is stored server-side and is never returned in API/UI responses.
- **Customer SMS** from synced external orders is blocked unless `EXTERNAL_ORDER_CUSTOMER_MESSAGING_ENABLED=true` **and** the order passes `customerMessagingReady` diagnostics (customer phone present).
- If mode is `live` but reads are disabled, health reports `readsDisabled: true` and configured status without calling the API.
- Admin routes never return API keys, passwords, OTPs, Authorization headers, webhook URLs, or webhook secrets. Discover Locations returns only safe location fields (`hasWebhookUrl` boolean instead of the raw URL).

### Barnet adapter (read-only)

`barnet-client.server.ts` implements:

- `GET {base}{prefix}/locations`
- `GET {base}{prefix}/orders?location_id=...&items_on_page=...&p=...`
- `GET {base}{prefix}/user/{id}?id={id}` (read-only customer enrichment during sync)

Barnet may return **a single location object** (e.g. one store) or a list/array. `normalizeBarnetLocationsResponse` handles both and strips secrets before any API or UI response. **Never paste the raw `/locations` response** into docs, tickets, or chat — it can contain `network_key`, `api_key`, `webhook_url`, Stripe keys, WooCommerce secrets, and other credentials. Use **Discover Live Locations** or `GET /live-locations` instead.

For Planet Hollyweed (and similar single-store Barnet tenants), set `EXTERNAL_ORDER_LOCATION_ID` manually in `.env.local` after discovery — copy the `id` or `store_id` from the safe discovery table, then restart the dev server.

Authentication: `Authorization: Basic base64(apiKey:apiPass)`.

Normalized orders use document IDs `barnet_{externalOrderId}` in Firestore.

### Confirmed Barnet delivery order detail fields

Live order detail responses (confirmed) include:

| Field | Normalized to |
|-------|----------------|
| `id`, `number`, `store_id` | `externalOrderId`, `externalOrderNumber` |
| `total`, `timestamp` | `total`, `placedAt` |
| `is_delivery`, `delivery_status`, `p_status` | `isDelivery`, `deliveryStatus`, `status` |
| `address`, `city`, `state`, `zip` | `deliveryAddress` (joined) |
| `delivery_notes` | `deliveryInstructions` |
| `items` | `items` (+ `itemsCount` in safe API metadata) |
| `customer_id` | `externalCustomerId` (enrichment key; contact fields fetched via `GET /user/{id}`) |
| `tracking_number`, `p_shipment_pin`, `processed` | preserved in server-side `rawPayload` only |

**Confirmed:** Barnet `GET /orders` includes `customer_id` on delivery orders (e.g. order `751883` → customer `7755`). Customer name, phone, and email are **not** on the order payload; they are fetched read-only from `GET /user/{customer_id}?id={customer_id}` during live sync, preview, and delivery scan.

### Barnet customer enrichment flow

```
GET /orders  →  customer_id on delivery order
                    ↓
GET /user/{customer_id}?id={customer_id}  →  normalize safe fields only
                    ↓
Merge into NormalizedExternalOrder  →  Firestore externalOrders
```

Normalized customer fields (stored in Firestore, never exposed in diagnostics UI):

| Barnet user field | Stored as |
|-------------------|-----------|
| `display_name`, `full_name`, or `first_name` + `last_name` | `customerName` |
| `phone` or `ap_phone` | `customerPhone` |
| `email` or `ap_email` | `customerEmail` |

**Not stored:** raw Barnet user payload, saved card fields, full shipping address from user profile (dispatch uses order `address`/`city`/`state`/`zip`).

Enrichment status on synced orders:

| Field | Meaning |
|-------|---------|
| `customerEnrichmentStatus: "success"` | `GET /user` succeeded |
| `customerEnrichmentStatus: "failed"` | `GET /user` failed; order still synced |
| `customerEnrichmentStatus: "skipped"` | No `customer_id` on order |
| `customerMessagingReady` | Enrichment succeeded **and** `customerPhone` is present |
| `dispatchReady` | Delivery order with full address and items |

Customer lookups are cached by `customer_id` within a single sync/preview/scan run.

**Security:** Never log or expose raw customer payloads, phone, email, name values, Authorization headers, or API credentials. Settings diagnostics and `GET /live-customer-detail` return boolean presence flags and safe key lists only.

### Customer-link diagnostics (false-positive filtering)

Live order detail probes scan the raw Barnet payload for customer-looking key paths, then classify them:

| Class | Paths | Meaning |
|-------|-------|---------|
| **Strong** | `user_id`, `customer_id`, `customer.id`, `user.id`, `phone`, `email`, `customer.phone`, `customer.email` | Actionable customer identifiers or contact fields |
| **Weak** | `kiosk_customer_status` | Customer-related metadata, not enough to retrieve contact info |
| **Ignore** | `items.*.displayname`, `items.*.productName`, `items.*.name`, `productName`, `product_name` | Product/item fields — **not** customer names |

Diagnostics expose:

- `possibleCustomerKeyPaths` — strong + weak paths only (ignored item/product fields excluded)
- `ignoredCustomerLikePaths` — item/product paths that matched a customer-looking scan but were filtered out
- `hasUserIdCandidate` — true only when a **strong** user/customer ID path is present
- `hasPhoneCandidate` — true only for **strong** phone paths (`phone`, `customer.phone`), not product fields

**Confirmed on order `751883`:** `customer_id` is present (`7755`). Item `displayname` / `productName` fields are product names, not customer names. `kiosk_customer_status` is weak metadata only.

Settings shows enrichment diagnostics (customer ID present, enrichment available, messaging ready, missing fields) — **without** exposing phone, email, or name values.

Probe order via **Settings → Probe Customer Link (sample order)** or:

```bash
curl "http://localhost:3000/api/integrations/order-provider/live-order-detail?id=751883" \
  -H "Authorization: Bearer <firebase-id-token>"
```

Probe customer enrichment safely (no PII values returned):

```bash
curl "http://localhost:3000/api/integrations/order-provider/live-customer-detail?customerId=7755" \
  -H "Authorization: Bearer <firebase-id-token>"
```

### Dispatch vs customer messaging readiness

Diagnostics separate two concerns:

| Flag | Meaning |
|------|---------|
| `dispatchReady` | Delivery order with address (`address`+`city`+`state`+`zip`), and at least one item |
| `customerMessagingReady` | Customer phone present after enrichment (or on mock orders) |
| `customerEnrichmentStatus` | `success`, `failed`, or `skipped` |
| `hasCustomerId` | `customer_id` present on Barnet order payload |
| `customerEnrichmentAvailable` | Same as `hasCustomerId` — enrichment can be attempted |

Settings **Preview Live Orders**, **Delivery Scan**, and synced order tables show these flags plus `missingFields` — without exposing raw address, phone, email, or name values in diagnostic panels.

Customer SMS from synced external orders remains blocked unless `EXTERNAL_ORDER_CUSTOMER_MESSAGING_ENABLED=true` **and** `customerMessagingReady` is true. No SMS is sent by this integration step — only readiness flags are prepared.

## Required Environment Variables

Copy `.env.example` to `.env.local`. **Never commit `.env.local` or real credentials.**

Example `.env.local` (placeholders only):

```env
EXTERNAL_ORDER_PROVIDER_MODE=mock
EXTERNAL_ORDER_API_BASE_URL=https://your-provider.example.com
EXTERNAL_ORDER_API_PATH_PREFIX=/swagger
EXTERNAL_ORDER_API_KEY=your_api_key_here
EXTERNAL_ORDER_API_PASS=your_api_pass_here
EXTERNAL_ORDER_LOCATION_ID=your_location_id_here
EXTERNAL_ORDER_OTP=
EXTERNAL_ORDER_WEBHOOK_SECRET=
EXTERNAL_ORDER_LIVE_READS_ENABLED=false
EXTERNAL_ORDER_LIVE_SYNC_ENABLED=false
EXTERNAL_ORDER_CUSTOMER_MESSAGING_ENABLED=false
```

To test live reads locally (after authorization):

```env
EXTERNAL_ORDER_PROVIDER_MODE=live
EXTERNAL_ORDER_LIVE_READS_ENABLED=true
EXTERNAL_ORDER_LIVE_SYNC_ENABLED=false
```

Enable sync only after confirming preview data shape:

```env
EXTERNAL_ORDER_LIVE_SYNC_ENABLED=true
```

### Recommended live testing order

1. Set live env with reads enabled but sync disabled (`EXTERNAL_ORDER_LIVE_READS_ENABLED=true`, `EXTERNAL_ORDER_LIVE_SYNC_ENABLED=false`). Base credentials only — `EXTERNAL_ORDER_LOCATION_ID` can be omitted initially.
2. Run **Discover Live Locations** (Settings UI or `GET /live-locations`).
3. Copy the correct location ID to `EXTERNAL_ORDER_LOCATION_ID` in `.env.local`.
4. Restart the dev server.
5. **Preview Live Orders** and confirm the data shape.
6. Only enable **Live Sync** after preview looks correct.

Firebase Admin variables (`FIREBASE_*`) are required for sync operations (Firestore writes).

## Security Warnings

- **Never commit `.env.local`** or real provider credentials
- **Never expose** `EXTERNAL_ORDER_API_KEY`, `EXTERNAL_ORDER_API_PASS`, `EXTERNAL_ORDER_OTP`, or `EXTERNAL_ORDER_WEBHOOK_SECRET` to the client, API responses, or logs
- **Never paste** the raw Barnet `GET /locations` response — it may include `network_key`, `api_pass`, `webhook_url`, Stripe keys, and other secrets. Use the safe `/live-locations` endpoint or Settings **Discover Live Locations** instead.
- **Do not call** create, delete, payment, or promo endpoints on the external provider
- Mock sync, live preview, live sync, and order listing require admin authentication
- Build and test scripts do **not** call live APIs automatically

## Testing Steps

### 1. Mock health

```bash
curl http://localhost:3000/api/integrations/order-provider/health
```

Expected (mock mode):

```json
{
  "ok": true,
  "mode": "mock",
  "configured": true,
  "ordersConfigured": true,
  "liveReadsEnabled": false,
  "liveSyncEnabled": false,
  "readsDisabled": false
}
```

CLI (no dev server):

```bash
npm run order-provider:health
```

### 2. Mock sync (admin auth required)

```bash
curl -X POST http://localhost:3000/api/integrations/order-provider/mock-sync \
  -H "Authorization: Bearer <firebase-id-token>"
```

### 3. Live config check (admin auth, no API call by default)

```bash
curl http://localhost:3000/api/integrations/order-provider/live-health \
  -H "Authorization: Bearer <firebase-id-token>"
```

Optional probe (`GET /locations` only, requires live reads enabled):

```bash
curl "http://localhost:3000/api/integrations/order-provider/live-health?probe=true" \
  -H "Authorization: Bearer <firebase-id-token>"
```

CLI env validation (no API calls):

```bash
npm run order-provider:live-config
```

### 4. Discover live locations (admin auth, read-only, no location ID required)

Requires `EXTERNAL_ORDER_PROVIDER_MODE=live` and `EXTERNAL_ORDER_LIVE_READS_ENABLED=true`. Returns only safe location fields (no API keys, webhook URLs, or other secrets). Barnet may respond with a single location object or a list; the route normalizes both and includes `meta.rawShape` (`single_object`, `array`, `items_wrapper`, `locations_wrapper`, `empty`, or `unknown_object`).

```bash
curl http://localhost:3000/api/integrations/order-provider/live-locations \
  -H "Authorization: Bearer <firebase-id-token>"
```

Example safe response (single-store tenant):

```json
{
  "ok": true,
  "locations": [
    {
      "id": 14,
      "store_id": 14,
      "name": "Planet Hollyweed",
      "address": "...",
      "city": "...",
      "state": "...",
      "phone": "...",
      "email": "...",
      "is_test_store": false,
      "dont_use_for_ecomm": false,
      "hasWebhookUrl": true
    }
  ],
  "meta": {
    "rawShape": "single_object",
    "count": 1,
    "topLevelKeys": ["id", "store_id", "name", "..."]
  }
}
```

Copy the correct `id` or `store_id` to `EXTERNAL_ORDER_LOCATION_ID` in `.env.local`, then restart the dev server.

### 5. Live preview (admin auth, read-only, no Firestore write)

Requires live reads **and** `EXTERNAL_ORDER_LOCATION_ID`.

```bash
curl http://localhost:3000/api/integrations/order-provider/live-preview \
  -H "Authorization: Bearer <firebase-id-token>"
```

### 6. Live sync (admin auth, Firestore write)

Requires live reads **and** `EXTERNAL_ORDER_LIVE_SYNC_ENABLED=true`. Run only after confirming preview data shape.

```bash
curl -X POST http://localhost:3000/api/integrations/order-provider/live-sync \
  -H "Authorization: Bearer <firebase-id-token>"
```

### List synced orders (admin auth)

```bash
curl http://localhost:3000/api/integrations/order-provider/orders \
  -H "Authorization: Bearer <firebase-id-token>"
```

### Admin UI

1. Start the dev server: `npm run dev`
2. Sign in as admin
3. Open **Settings** → **External Order Provider**
4. Mock: **Run Mock Sync** (when mode is mock)
5. Live: **Check Live Config** → **Discover Live Locations** → set `EXTERNAL_ORDER_LOCATION_ID` → restart → **Preview Live Orders** → **Run Live Sync** (only when sync flag is enabled)

Ensure `NEXT_PUBLIC_USE_API=true` in `.env.local` for the UI to call the API.

## File Layout

```
lib/integrations/order-provider/
  types.ts                    # Provider and normalized types
  env.server.ts               # Zod env validation + safety gates
  mock-client.server.ts       # Fake orders (no fetch)
  barnet-client.server.ts     # Read-only live GET client (orders, locations, users)
  barnet-order-diagnostics.ts # Dispatch vs messaging readiness checks
  barnet-customer-enrichment.server.ts # GET /user enrichment + per-run cache
  normalize-barnet-customer.ts # Barnet user → safe customer fields
  live-customer-detail-diagnostics.ts # Safe customer probe diagnostics
  find-customer-link-fields.ts # Classify customer-looking payload paths
  live-order-detail-diagnostics.ts # Single-order probe + customer-link flags
  normalize-order.ts          # Mock provider → normalized mapping
  normalize-barnet-order.ts   # Barnet detail → normalized mapping
  safe-external-order.ts      # Strip rawPayload + customer PII for API/UI
  customer-messaging.server.ts # SMS feature gate for synced orders
  index.server.ts             # Sync orchestration + exports

app/api/integrations/order-provider/
  health/route.ts             # GET public health
  mock-sync/route.ts          # POST mock sync
  orders/route.ts             # GET synced orders
  live-health/route.ts        # GET admin live config (+ optional probe)
  live-locations/route.ts   # GET admin discover locations (safe fields only)
  live-preview/route.ts     # GET admin live preview (read-only)
  live-order-detail/route.ts # GET admin live order detail probe
  live-customer-detail/route.ts # GET admin safe customer enrichment probe
  live-sync/route.ts          # POST admin live sync

scripts/
  check-order-provider-health.mjs
  check-live-order-provider-config.mjs
```

## Logging

Sync operations log counts only:

```
[order-provider] mock sync complete: inserted=5 updated=0
[order-provider] live sync complete: inserted=3 updated=1
```

The integration does **not** log API keys, passwords, OTPs, Authorization headers, or customer private data.
