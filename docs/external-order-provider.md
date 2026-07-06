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
- Health, mock-sync, live-health, live-preview, and live-sync API routes
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

Live mode requires **all** of the following:

| Requirement | Env var |
|-------------|---------|
| Mode set to live | `EXTERNAL_ORDER_PROVIDER_MODE=live` |
| API base URL | `EXTERNAL_ORDER_API_BASE_URL` |
| API credentials | `EXTERNAL_ORDER_API_KEY`, `EXTERNAL_ORDER_API_PASS` |
| Location | `EXTERNAL_ORDER_LOCATION_ID` |
| Reads explicitly enabled | `EXTERNAL_ORDER_LIVE_READS_ENABLED=true` |

Optional:

| Variable | Purpose |
|----------|---------|
| `EXTERNAL_ORDER_API_PATH_PREFIX` | API path prefix (default `/swagger`) |
| `EXTERNAL_ORDER_OTP` | One-time password if required by provider |
| `EXTERNAL_ORDER_WEBHOOK_SECRET` | Reserved for future webhook verification |

### Safety gates

- **Live GET requests** (`fetchBarnetLocations`, `fetchBarnetOrders`, etc.) only run when mode is `live` **and** `EXTERNAL_ORDER_LIVE_READS_ENABLED=true`.
- **Live Firestore sync** only runs when the above is true **and** `EXTERNAL_ORDER_LIVE_SYNC_ENABLED=true`.
- If mode is `live` but reads are disabled, health reports `readsDisabled: true` and configured status without calling the API.
- Admin routes never return API keys, passwords, OTPs, Authorization headers, or webhook secrets.

### Barnet adapter (read-only)

`barnet-client.server.ts` implements:

- `GET {base}{prefix}/locations`
- `GET {base}{prefix}/orders?location_id=...&items_on_page=...&p=...`

Authentication: `Authorization: Basic base64(apiKey:apiPass)`.

Normalized orders use document IDs `barnet_{externalOrderId}` in Firestore.

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

Firebase Admin variables (`FIREBASE_*`) are required for sync operations (Firestore writes).

## Security Warnings

- **Never commit `.env.local`** or real provider credentials
- **Never expose** `EXTERNAL_ORDER_API_KEY`, `EXTERNAL_ORDER_API_PASS`, `EXTERNAL_ORDER_OTP`, or `EXTERNAL_ORDER_WEBHOOK_SECRET` to the client, API responses, or logs
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

### 4. Live preview (admin auth, read-only, no Firestore write)

Requires `EXTERNAL_ORDER_PROVIDER_MODE=live` and `EXTERNAL_ORDER_LIVE_READS_ENABLED=true`.

```bash
curl http://localhost:3000/api/integrations/order-provider/live-preview \
  -H "Authorization: Bearer <firebase-id-token>"
```

### 5. Live sync (admin auth, Firestore write)

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
5. Live: **Check Live Config** → **Preview Live Orders** → **Run Live Sync** (only when sync flag is enabled)

Ensure `NEXT_PUBLIC_USE_API=true` in `.env.local` for the UI to call the API.

## File Layout

```
lib/integrations/order-provider/
  types.ts                    # Provider and normalized types
  env.server.ts               # Zod env validation + safety gates
  mock-client.server.ts       # Fake orders (no fetch)
  barnet-client.server.ts     # Read-only live GET client
  normalize-order.ts          # Mock provider → normalized mapping
  normalize-barnet-order.ts     # Barnet → normalized mapping
  index.server.ts             # Sync orchestration + exports

app/api/integrations/order-provider/
  health/route.ts             # GET public health
  mock-sync/route.ts          # POST mock sync
  orders/route.ts             # GET synced orders
  live-health/route.ts        # GET admin live config (+ optional probe)
  live-preview/route.ts       # GET admin live preview (read-only)
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
