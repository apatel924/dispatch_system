# Quick-Run Express — Backend Reference

Living documentation for the in-repo Next.js backend. **Update this file whenever you add routes, services, or change data models.**

| | |
|---|---|
| **Stack** | Next.js 16 App Router Route Handlers · Firebase Auth · Firestore · Storage · Zod |
| **API base** | `/api/*` |
| **Detailed plan** | [backend-implementation-plan.md](./backend-implementation-plan.md) |
| **Types** | [`lib/types/backend.ts`](../lib/types/backend.ts) |
| **Last updated** | Phase 10 — Tracking + reports API wired |

---

## Quick start

```bash
# 1. Copy env template (placeholders only — add real values in .env.local)
cp .env.example .env.local

# 2. Install deps (if needed)
npm install

# 3. Build (verifies API + server code compile)
npm run build

# 4. Health check (when dev server is running)
curl http://localhost:3000/api/health
```

**Auth header for protected routes:**

```
Authorization: Bearer <firebase-id-token>
```

Firebase custom claims required on tokens:

| Claim | Type | Values |
|-------|------|--------|
| `role` | string | `admin` · `dispatcher` · `driver` |
| `driverId` | string (optional) | e.g. `DRV-10012` — required for driver-scoped routes |

---

## Implementation status

| Phase | Status | Notes |
|-------|--------|-------|
| 1 — Docs & scaffolding | ✅ Done | Plan, types, `.env.example` |
| 2 — Firebase & health | ✅ Done | Admin SDK, auth helpers, `GET /api/health` |
| 3 — Firestore services | ✅ Done | Services + Zod validation (this phase) |
| 4 — API route handlers | ✅ Done | Orders, drivers, driver-orders routes |
| 5 — Admin UI migration | ✅ Done | Orders, drivers, dashboard, detail pages |
| 6 — Driver UI migration | ✅ Done | Driver dashboard, orders, route, account, detail |
| 7 — Proof upload | ✅ Done | Storage upload + proofs API; localStorage offline fallback |
| 8 — Admin proof review | ✅ Done | Proof gallery + approve/reject on order detail |
| 9 — Mock order import | ✅ Done | Import API + settings integrations panel |
| 10 — Tracking & reports | ✅ Done | Public tracking + admin reports pages |

---

## Folder structure

```
app/api/                    # HTTP Route Handlers (thin — delegate to services)
lib/
  auth/
    config.ts               # Client Firebase env config
    firebase-client.ts      # Client sign-in helpers (use client)
  server/
    auth.ts                 # verifyIdToken, requireAuth, requireRole
    roles.ts                # Role constants
    env.ts                  # Server env checks
    errors.ts               # ServiceError
    api-response.ts         # Standard JSON errors
    handle-service-error.ts # Map ServiceError → NextResponse
    route-utils.ts          # parseJsonBody, parseQueryParams, ensureFirebaseConfigured
    driver-context.ts       # resolveDriverId, requireDriverId
    firebase-admin.ts       # Admin SDK singleton
    firestore/
      collections.ts        # Collection + subcollection paths
      helpers.ts            # docToOrder, timestamps, etc.
      ids.ts                # QRX-/DRV- ID generation
    services/               # ← Business logic (Phase 3)
      audit.ts
      orders.ts
      drivers.ts
      proofs.ts
      tracking.ts
      reports.ts
      import.ts
      index.ts              # Re-exports
    validation/             # Zod schemas
      common.ts
      orders.ts
      drivers.ts
      proofs.ts
      import.ts
      reports.ts
  types/
    backend.ts              # Shared TypeScript interfaces
```

**Rule:** Route handlers in `app/api/` should stay thin — parse/validate input, call `lib/server/services`, return JSON.

---

## API routes

### Implemented

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/health` | Public | Liveness + Firebase config status |
| `GET` | `/api/orders` | admin, dispatcher | List orders (query: `status`, `driverId`, `payment`, `search`, `dateFrom`, `dateTo`, `limit`, `cursor`) |
| `POST` | `/api/orders` | admin, dispatcher | Create order → `{ order }` |
| `GET` | `/api/orders/[id]` | admin, dispatcher | → `{ order, statusEvents }` |
| `PATCH` | `/api/orders/[id]` | admin, dispatcher | Update fields → `{ order }` |
| `POST` | `/api/orders/[id]/assign-driver` | admin, dispatcher | Body: `{ driverId }` → `{ order }` |
| `POST` | `/api/orders/[id]/status` | driver (own), admin, dispatcher | Body: `{ status, stepKey?, note? }` → `{ order, event }` |
| `GET` | `/api/driver/orders` | driver | Assigned orders (query: `scope`, `limit`) → `{ orders }` |
| `GET` | `/api/driver/orders/[id]` | driver (own) | → `{ order, statusEvents, proofs }` |
| `GET` | `/api/drivers` | admin, dispatcher | → `{ drivers, nextCursor? }` |
| `POST` | `/api/drivers` | admin | Create driver → `{ driver }` |
| `GET` | `/api/drivers/[id]` | admin, dispatcher, driver (self) | → `{ driver }` |
| `PATCH` | `/api/drivers/[id]` | admin, driver (self) | Update driver → `{ driver }` |

### Planned (Phase 5+)

| Method | Route | Auth | Service function(s) |
|--------|-------|------|----------------------|
| `GET` | `/api/orders/[id]/proofs` | admin, dispatcher, driver | `listProofs()` |
| `POST` | `/api/orders/[id]/proofs` | driver | `createProof()` |
| `PATCH` | `/api/proofs/[proofId]/review` | admin, dispatcher | `reviewProof()` |
| `GET` | `/api/tracking/[trackingId]` | Public | `getTrackingByTrackingId()` |
| `GET` | `/api/reports/overview` | admin | `getReportsOverview()` |
| `POST` | `/api/integrations/order-import` | admin | `importOrders()` — mock payloads only |
| `GET` | `/api/integrations/import-logs` | admin | `listImportLogs()` |

---

## Firestore collections

| Collection | Document ID | Purpose |
|------------|-------------|---------|
| `orders` | `QRX-xxxxx` | **Single source of truth** for admin + driver UIs |
| `orders/{id}/events` | auto | Status timeline (`OrderStatusEvent`) |
| `orders/{id}/proofs` | auto | Proof metadata (`ProofAsset`) |
| `drivers` | `DRV-xxxxx` | Driver roster + metrics |
| `users` | Firebase `uid` | User profile + role (Phase 4+) |
| `importLogs` | auto | Order import run history |
| `auditLogs` | auto | Append-only action log |
| `counters/orders` | `orders` | Atomic order ID sequence |
| `counters/drivers` | `drivers` | Atomic driver ID sequence |

### Order model (unified)

Admin mock (`lib/dash/mock-data.ts`) and driver mock (`lib/dash/driver-mock-data.ts`) converge on `Order` in `lib/types/backend.ts`. Key fields:

- Customer: `customerName`, `customerPhone`, `deliveryAddress`, `deliveryUnit`
- Pickup: `pickupName`, `pickupAddress`
- Assignment: `assignedDriverId`, `assignedDriverName`
- Workflow: `status`, `completedSteps[]`, `eta`, `notes`
- Public: `trackingId` (used by `/api/tracking/[trackingId]`)

---

## Service layer

Import from `@/lib/server/services` or the specific module.

### `orders.ts`

| Function | Description |
|----------|-------------|
| `createOrder(input, actor)` | Create order + initial status event + audit log |
| `getOrderById(id)` | Fetch by `QRX-*` id |
| `getOrderByTrackingId(trackingId)` | Public tracking lookup |
| `listOrders(query)` | Filter by status, driver, payment, search, dates |
| `updateOrder(id, patch, actor)` | Partial update |
| `assignDriver(orderId, driverId, actor)` | Assign + set status `Assigned` |
| `updateOrderStatus(orderId, status, actor, opts?)` | Status change + event + audit |
| `listOrdersForDriver(driverId, query)` | Scoped list (`active`, `completed`, `route`, `today`) |
| `assertDriverOwnsOrder(orderId, driverId)` | Throws 404 if not assigned |
| `getStatusEvents(orderId)` | Timeline from subcollection |

### `drivers.ts`

| Function | Description |
|----------|-------------|
| `getDriverById(id)` | Single driver |
| `getDriverByUserId(uid)` | Lookup by Firebase uid |
| `listDrivers(query)` | Filter by status, search |
| `createDriver(input, actor)` | New `DRV-*` record |
| `updateDriver(id, patch, actor)` | Profile/status update |

### `proofs.ts`

| Function | Description |
|----------|-------------|
| `listProofs(orderId)` | List with signed download URLs |
| `createProof(orderId, input, actor)` | Save metadata after Storage upload |
| `reviewProof(orderId, proofId, input, actor)` | Approve/reject |
| `getSignedDownloadUrl(storagePath)` | 1-hour signed URL |

### `tracking.ts`

| Function | Description |
|----------|-------------|
| `getTrackingByTrackingId(id)` | Public `TrackingView` (sanitized) |
| `buildTrackingViewFromOrder(order, events)` | Pure builder for tests |

### `reports.ts`

| Function | Description |
|----------|-------------|
| `getReportsOverview(query)` | Aggregated totals, breakdowns, daily trends |

### `import.ts`

| Function | Description |
|----------|-------------|
| `importOrders(input, actor)` | Mock provider import (`mock-uber`, `mock-doordash`, `mock-amazon`) |
| `listImportLogs(query)` | Import history |
| `MOCK_IMPORT_FIXTURES` | Example payloads for local testing |

### `audit.ts`

| Function | Description |
|----------|-------------|
| `writeAuditLog(input)` | Append audit entry |
| `listAuditLogsForEntity(type, id)` | Entity history |

---

## Validation (Zod)

Schemas live in `lib/server/validation/`. Infer types from schemas in route handlers:

```typescript
import { CreateOrderSchema } from "@/lib/server/validation/orders";

const body = CreateOrderSchema.parse(await request.json());
```

| File | Schemas |
|------|---------|
| `orders.ts` | `CreateOrderSchema`, `UpdateOrderSchema`, `ListOrdersQuerySchema`, `AssignDriverSchema`, `OrderStatusUpdateSchema`, `DriverOrdersQuerySchema` |
| `drivers.ts` | `CreateDriverSchema`, `UpdateDriverSchema`, `ListDriversQuerySchema` |
| `proofs.ts` | `UploadProofSchema`, `ReviewProofSchema` |
| `import.ts` | `OrderImportSchema`, `MockUberPayloadSchema`, … |
| `reports.ts` | `ReportsOverviewQuerySchema` |
| `common.ts` | `OrderStatusSchema`, `PaginationQuerySchema`, … |

---

## Auth in route handlers (Phase 4 pattern)

```typescript
import { requireRole } from "@/lib/server/auth";
import { ADMIN_ROLES } from "@/lib/server/roles";
import { handleServiceError } from "@/lib/server/handle-service-error";
import { listOrders } from "@/lib/server/services";

export async function GET(request: Request) {
  const user = await requireRole(request, ADMIN_ROLES);
  if (user instanceof Response) return user;

  try {
    // parse query, call service, return JSON
  } catch (err) {
    return handleServiceError(err);
  }
}
```

---

## Environment variables

See [`.env.example`](../.env.example). Never commit `.env.local`.

| Variable | Side | Required for |
|----------|------|--------------|
| `NEXT_PUBLIC_FIREBASE_*` | Client | Login UI, Storage uploads |
| `FIREBASE_PROJECT_ID` | Server | Admin SDK |
| `FIREBASE_CLIENT_EMAIL` | Server | Admin SDK |
| `FIREBASE_PRIVATE_KEY` | Server | Admin SDK |
| `NEXT_PUBLIC_APP_URL` | Client | Redirect URLs |
| `NEXT_PUBLIC_USE_API` | Client | When `true`, admin + driver pages fetch `/api/*` (falls back to mock on error) |

---

## Admin UI data layer (Phase 5)

When `NEXT_PUBLIC_USE_API=true`, admin pages fetch from the API. On failure (no auth, Firebase unset, network), they **fall back to mock data** automatically.

| Hook | Used by |
|------|---------|
| `useAdminOrders()` | `dashboard-page`, `orders-page`, `driver-profile-page` |
| `useAdminOrderDetail(orderId)` | `order-detail-page` (includes proofs) |
| `useAdminDrivers()` | `dashboard-page`, `drivers-page`, `create-order-page` |
| `useAdminDriver(driverId)` | `driver-profile-page` |
| `useAdminImportLogs()` | `settings-page` (mock import runner) |
| `useAdminReports()` | `reports-page` |
| `useTracking(trackingId)` | `track-page`, `tracking-demo` (marketing) |

```
lib/dash/api/config.ts        — isApiEnabled()
lib/dash/api/tracking-client.ts — public fetchTracking, demo fallback helpers
lib/dash/api/client.ts      — adminFetch, runOrderImport, fetchImportLogs, …
lib/dash/api/adapters.ts    — orderToAdminRow, importLogToAdminRow, mock fallbacks
lib/import/mock-fixtures.ts — shared mock Uber/DoorDash/Amazon payloads
lib/dash/hooks/             — React hooks above
```

---

## Driver UI data layer (Phase 6)

When `NEXT_PUBLIC_USE_API=true`, driver pages fetch from authenticated driver API routes. On failure (no auth, missing `driverId` claim, Firebase unset, network), they **fall back to mock data** automatically.

| Hook | Used by |
|------|---------|
| `useDriverSession()` | `driver-dashboard-page`, `driver-account-page` |
| `useDriverOrders()` | `driver-dashboard-page`, `driver-orders-list-page` |
| `useDriverRouteOrders()` | `driver-route-page` |
| `useDriverOrder(orderId)` | `driver-order-detail-page` |

```
lib/dash/api/driver-client.ts   — fetchDriverOrders, fetchDriverOrderDetail
lib/dash/api/driver-adapters.ts — orderToDriverOrder, mock fallbacks, route helpers
lib/auth/firebase-client.ts     — getDriverAuthClaims() → driverId for profile fetch
lib/dash/hooks/                 — React hooks above
```

**Still mock:** `driver-messages-page` (no API yet).

### Proof sync (Phase 7)

Driver proof capture uses **optimistic localStorage** plus background API sync when `NEXT_PUBLIC_USE_API=true`:

1. Capture → save to `qre-driver-proofs` immediately
2. Upload blob to Firebase Storage (`orders/{orderId}/proofs/{type}-{ts}.png`)
3. `POST /api/orders/[id]/proofs` records metadata + updates `order.completedSteps`
4. Tap steps → `POST /api/orders/[id]/status` with current status + `stepKey`
5. Complete delivery → `POST /api/orders/[id]/status` with `Delivered`

| Function | File |
|----------|------|
| `uploadProofBlob()` | `lib/auth/firebase-storage.ts` |
| `saveProofAsync()`, `markStepCompleteAsync()`, `completeDeliveryAsync()` | `lib/dash/driver-store.ts` |
| `postOrderProof()`, `postOrderStatus()` | `lib/dash/api/driver-client.ts` |

**Firebase Storage rules (configure in console):** authenticated users with `role: driver` need write access to `orders/{orderId}/proofs/**` for assigned orders.

---

## Mock data during migration

Mock files remain as **fallback** when API is disabled or unavailable. **Do not delete.**

| File | Used by |
|------|---------|
| `lib/dash/mock-data.ts` | Admin hooks fallback |
| `lib/dash/driver-mock-data.ts` | Driver hooks fallback; messages page |
| `lib/dash/driver-store.ts` | Proof steps + localStorage fallback (`qre-driver-proofs`) |
| `data/trackingDemo.ts` | Marketing track demo (`QRX-28491`) |

---

## Safety rules (Cursor / dev)

1. Run **one** dev server — `npm run dev` **or** `npm run dev:turbo`, not both.
2. Do **not** remove mock data until API replacement works.
3. Do **not** add real credentials to the repo — `.env.local` only.
4. Do **not** connect live external order APIs until internal flow is tested.
5. Do **not** create a separate Express server or backend repo.
6. Unify on the single `Order` model — never split admin/driver schemas again.

---

## Changelog

| Date | Phase | Changes |
|------|-------|---------|
| — | 1 | `docs/backend-implementation-plan.md`, types, plan |
| — | 2 | Firebase Admin, auth helpers, `GET /api/health`, `.env.example` |
| — | 3 | Firestore services, Zod validation, `docs/BACKEND.md` (this file) |
| — | 4 | Orders + drivers API routes, `route-utils`, `driver-context` |
| — | 5 | Admin UI hooks + API wiring with mock fallback |
| — | 6 | Driver UI hooks + API wiring with mock fallback |
| — | 7 | Proof Storage upload + proofs API + optimistic driver-store sync |
| — | 8 | Admin proof gallery + PATCH review route |
| — | 9 | Mock order import API + settings integrations UI |
| — | 10 | Public tracking + reports overview API + page wiring |

**When you ship changes:** add a row to the changelog and update the **Implementation status** table above.
