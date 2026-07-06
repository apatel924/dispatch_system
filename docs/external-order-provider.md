# External Order Provider Integration (Mock Scaffold)

This document describes the server-only external order provider integration scaffold in **mock mode**. It prepares the app architecture for future authorized order syncing without calling any live third-party APIs.

## Purpose

The scaffold provides:

- Typed provider and normalized order models
- Server-side environment validation (Zod)
- A mock provider client that returns fake delivery orders
- Normalization from provider shape to internal `NormalizedExternalOrder`
- Firestore upsert into the `externalOrders` collection (keyed by `externalOrderId`)
- Health and mock-sync API routes
- Admin UI on **Settings** to view health, run mock sync, and list synced orders

**Not included in this scaffold:** live API calls, order creation in the main orders flow, payment processing, order deletion, or real credentials.

## Mock Mode

When `EXTERNAL_ORDER_PROVIDER_MODE=mock` (the default):

- No external HTTP requests are made
- `mock-client.server.ts` returns 3–5 realistic fake delivery orders with generic names
- Mock sync normalizes those orders and upserts them into Firestore
- Health check returns `{ ok: true, mode: "mock", configured: true }`

Live mode (`EXTERNAL_ORDER_PROVIDER_MODE=live`) is reserved for a future authorized implementation. If live mode is set without required env vars, server startup and health checks will fail with a clear error.

## Required Environment Variables

Copy `.env.example` to `.env.local` and set values as needed. **Never commit `.env.local` or real credentials.**

| Variable | Mock mode | Description |
|----------|-----------|-------------|
| `EXTERNAL_ORDER_PROVIDER_MODE` | `mock` (default) | `mock` or `live` |
| `EXTERNAL_ORDER_API_BASE_URL` | optional | Provider API base URL (required for live) |
| `EXTERNAL_ORDER_API_KEY` | optional | API key (required for live; never exposed to client) |
| `EXTERNAL_ORDER_API_PASS` | optional | API password (required for live; never exposed) |
| `EXTERNAL_ORDER_LOCATION_ID` | optional | Provider location ID (required for live) |
| `EXTERNAL_ORDER_OTP` | optional | One-time password if needed by provider |
| `EXTERNAL_ORDER_WEBHOOK_SECRET` | optional | Webhook signing secret |

Firebase Admin variables (`FIREBASE_*`) are still required for mock sync (Firestore writes).

## Health Check

### API

```bash
curl http://localhost:3000/api/integrations/order-provider/health
```

Expected response in mock mode:

```json
{ "ok": true, "mode": "mock", "configured": true }
```

Secrets are never included in the response.

### CLI (no dev server required)

```bash
npm run order-provider:health
```

Validates env configuration locally without starting Next.js.

## Mock Sync

### API (admin auth required)

```bash
curl -X POST http://localhost:3000/api/integrations/order-provider/mock-sync \
  -H "Authorization: Bearer <firebase-id-token>"
```

Response:

```json
{ "ok": true, "mode": "mock", "inserted": 5, "updated": 0, "total": 5 }
```

Re-running sync updates existing documents (matched by `externalOrderId`) and increments `updated`.

### List synced orders (admin auth required)

```bash
curl http://localhost:3000/api/integrations/order-provider/orders \
  -H "Authorization: Bearer <firebase-id-token>"
```

### Admin UI

1. Start the dev server: `npm run dev`
2. Sign in as admin
3. Open **Settings**
4. Use the **External Order Provider (Mock)** section:
   - View provider mode and health status
   - Click **Run Mock Sync**
   - Review synced orders in the table

Ensure `NEXT_PUBLIC_USE_API=true` in `.env.local` for the UI to call the API.

## File Layout

```
lib/integrations/order-provider/
  types.ts              # Provider and normalized types
  env.server.ts         # Zod env validation (server-only)
  mock-client.server.ts # Fake orders (no fetch)
  normalize-order.ts    # Provider → normalized mapping
  index.server.ts       # Sync orchestration + exports

app/api/integrations/order-provider/
  health/route.ts       # GET health
  mock-sync/route.ts    # POST mock sync
  orders/route.ts       # GET synced orders
```

## Logging

Sync operations log counts only, for example:

```
[order-provider] mock sync complete: inserted=5 updated=0
```

The integration does **not** log API keys, passwords, OTPs, Authorization headers, or customer private data.

## Future Live Integration

A future authorized developer must:

1. Implement a live provider adapter (server-only) using `getExternalOrderProviderSecrets()`
2. Keep all credentials in server env vars only
3. Add webhook verification using `EXTERNAL_ORDER_WEBHOOK_SECRET`
4. Wire live fetch into a separate code path — **not** enabled by this scaffold

## Security Warning

- **Never commit `.env.local`** or real provider credentials
- **Never expose** `EXTERNAL_ORDER_API_KEY`, `EXTERNAL_ORDER_API_PASS`, `EXTERNAL_ORDER_OTP`, or `EXTERNAL_ORDER_WEBHOOK_SECRET` to the client, API responses, or logs
- Mock sync and order listing require admin authentication
