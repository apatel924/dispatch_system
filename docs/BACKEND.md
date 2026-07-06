# Quick-Run Express — Backend Reference

Living documentation for the in-repo Next.js backend. **Update this file whenever you add routes, services, or change data models.**

| | |
|---|---|
| **Stack** | Next.js 16 App Router Route Handlers · Firebase Auth · Firestore · Storage · Zod |
| **API base** | `/api/*` |
| **Detailed plan** | [backend-implementation-plan.md](./backend-implementation-plan.md) |
| **Types** | [`lib/types/backend.ts`](../lib/types/backend.ts) |
| **Last updated** | Phase 11 — Auth UI wired, route guards, notification scaffold |

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

### Firebase seed (Firestore + custom claims)

Use this after Firebase Admin credentials and Auth users are in place. **Does not create Auth users or passwords** — only sets custom claims and Firestore documents.

```bash
# 1. Ensure .env.local has FIREBASE_* and SEED_* emails (see below)
# 2. Create Auth users manually in Firebase Console (see "Firebase seed setup")
# 3. Run seed (idempotent — safe to re-run)
npm run seed:firebase
```

**After seeding:** each user must **sign out and sign back in** so their ID token includes the new `role` / `driverId` custom claims.

See [Firebase seed setup](#firebase-seed-setup) for Auth user creation, env vars, and smoke tests.

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

**Honest snapshot (code vs docs):**

| Area | Status | Notes |
|------|--------|-------|
| Backend routes & services | ✅ Mostly done | 15 Route Handlers under `app/api/*`; Firestore services + Zod validation |
| Auth UI (Firebase email/password) | ✅ Wired | Admin + driver login pages call Firebase; SMS login disabled |
| Page protection | ✅ Added | `AdminAuthGuard` / `DriverAuthGuard` on protected routes; demo mode when Firebase unset |
| Admin list/detail/create pages | ⚠️ Partial | Hooks exist (`useAdminOrders`, etc.) but default to mock unless `NEXT_PUBLIC_USE_API=true` + valid token |
| Driver UI data layer | ⚠️ Partial | Hooks wired with mock fallback; proof flow still uses localStorage + optimistic sync |
| Customer notifications | 🔧 Scaffold only | `lib/server/services/notifications.ts` — dev-log only, no Twilio |
| Twilio / real SMS | ❌ Future | Reserved for customer delivery notifications only |
| Create order form submit | ❌ Not wired | UI is static; no `POST /api/orders` from form yet |
| Driver messages | ❌ Mock only | No API yet |

### Phase checklist

| Phase | Status | Notes |
|-------|--------|-------|
| 1 — Docs & scaffolding | ✅ Done | Plan, types, `.env.example` |
| 2 — Firebase & health | ✅ Done | Admin SDK, auth helpers, `GET /api/health` |
| 3 — Firestore services | ✅ Done | Services + Zod validation |
| 4 — API route handlers | ✅ Done | Orders, drivers, driver-orders, proofs, tracking, reports, import |
| 5 — Admin UI migration | ⚠️ Partial | Hooks + API client exist; pages use mock by default |
| 6 — Driver UI migration | ⚠️ Partial | Hooks exist; dashboard/route wired; messages still mock |
| 7 — Proof upload | ⚠️ Partial | Storage + proofs API exist; driver detail still merges localStorage |
| 8 — Admin proof review | ✅ Done | Proof gallery + approve/reject on order detail |
| 9 — Mock order import | ✅ Done | Import API + settings integrations panel |
| 10 — Tracking & reports | ⚠️ Partial | APIs done; pages use hooks with mock fallback |
| 11 — Auth UI & guards | ✅ Done | Firebase login, role redirects, client-side route guards |
| 12 — Notifications | 🔧 Scaffold | Dev-log service only; not wired into assign-driver yet |

---

## Folder structure

```
app/api/                    # HTTP Route Handlers (thin — delegate to services)
lib/
  auth/
    config.ts               # Client Firebase env config
    firebase-client.ts      # Client sign-in, token claims, auth state (use client)
  components/dash/auth/
    auth-guard.tsx          # AdminAuthGuard / DriverAuthGuard (client-side)
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
      notifications.ts    # Dev-log customer notifications (no Twilio yet)
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

### Planned (future)

| Method | Route | Auth | Service function(s) |
|--------|-------|------|----------------------|
| — | Customer SMS (Twilio) | — | `notifyCustomerOrderAssigned`, `notifyCustomerStatusUpdate` — **dev-log scaffold exists; Twilio future** |

### Previously listed as planned — now implemented

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

### `notifications.ts` (dev-log scaffold — no Twilio)

| Function | Description |
|----------|-------------|
| `notifyCustomerOrderAssigned(order)` | Simulated SMS/email log when driver assigned |
| `notifyCustomerStatusUpdate(order, status)` | Simulated status notification log |

Returns `{ ok, provider: "dev-log", channel, messagePreview, trackingUrl }`. Not wired into `assignDriver` yet.

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
| `SEED_ADMIN_EMAIL` | Seed script | Admin email — must exist in Firebase Auth |
| `SEED_DRIVER_1_EMAIL` | Seed script | Driver 1 email — must exist in Firebase Auth |
| `SEED_DISPATCHER_EMAIL` | Seed script | Optional dispatcher email |
| `SEED_DRIVER_2_EMAIL` | Seed script | Optional second driver email |

---

## Firebase seed setup

Script: `scripts/seed-firebase.mjs` · Command: `npm run seed:firebase`

### 0. Prerequisites

1. **Enable Firestore** — Firebase Console → **Build** → **Firestore Database** → create database (or enable the Cloud Firestore API in Google Cloud Console).
2. **Enable Authentication** with Email/Password provider.
3. Copy `.env.example` → `.env.local` and set **both** Admin SDK and **client** Firebase values.

**Client Web API key (required for login):**

1. Firebase Console → **Project settings** (gear) → **General**
2. Under **Your apps**, select your **Web app** (or add one)
3. Copy the `apiKey` value (starts with `AIza…`)
4. Set in `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...your_real_key_here
```

Do **not** leave the placeholder `your_firebase_web_api_key` — login will fail with `auth/api-key-not-valid`.

5. **Restart the dev server** after changing any `NEXT_PUBLIC_*` variable (Next.js reads them at startup).

Example test accounts (create in Auth first):

| Email | Role after seed |
|-------|-----------------|
| `admin@quickrun.test` | admin |
| `driver1@quickrun.test` | driver (`DRV-10012`) |
| `driver2@quickrun.test` | driver (`DRV-10013`) |

Set matching values in `.env.local`:

```bash
SEED_ADMIN_EMAIL=admin@quickrun.test
SEED_DRIVER_1_EMAIL=driver1@quickrun.test
SEED_DRIVER_2_EMAIL=driver2@quickrun.test
```

### 1. Create users manually in Firebase Authentication

The seed script **does not** create Auth users or set passwords. Create them first:

1. Open [Firebase Console](https://console.firebase.google.com) → your project → **Authentication** → **Users**.
2. Click **Add user** for each account you need:

| Role | Env var | Custom claims set by seed |
|------|---------|---------------------------|
| Admin | `SEED_ADMIN_EMAIL` | `role: admin`, `active: true` |
| Dispatcher (optional) | `SEED_DISPATCHER_EMAIL` | `role: dispatcher`, `active: true` |
| Driver 1 (required) | `SEED_DRIVER_1_EMAIL` | `role: driver`, `driverId: DRV-10012`, `active: true` |
| Driver 2 (optional) | `SEED_DRIVER_2_EMAIL` | `role: driver`, `driverId: DRV-10013`, `active: true` |

3. Set a password for each user in the console (or use your preferred Auth provider).
4. Add the same emails to `.env.local` (copy from `.env.example` placeholders).

### 2. Configure `.env.local`

Required for the seed script:

| Variable | Purpose |
|----------|---------|
| `FIREBASE_PROJECT_ID` | Firebase Admin SDK |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key |
| `SEED_ADMIN_EMAIL` | Admin Auth user email |
| `SEED_DRIVER_1_EMAIL` | Driver 1 Auth user email |

Optional:

| Variable | Purpose |
|----------|---------|
| `SEED_DISPATCHER_EMAIL` | Dispatcher Auth user email |
| `SEED_DRIVER_2_EMAIL` | Second driver Auth user email |

### 3. Run the seed

```bash
npm run seed:firebase
```

The script is **idempotent** — re-running updates existing `users`, `drivers`, `orders`, and `orders/{id}/events` docs instead of duplicating them.

**What it creates:**

| Collection | Documents |
|------------|-----------|
| `users/{uid}` | Profile + role for each seed email |
| `drivers/DRV-10012` | Driver 1 roster record |
| `drivers/DRV-10013` | Driver 2 (if `SEED_DRIVER_2_EMAIL` set) |
| `orders/QRX-SEED-1001` | New, unassigned |
| `orders/QRX-SEED-1002` | Assigned → DRV-10012 |
| `orders/QRX-SEED-1003` | Out for Delivery → DRV-10012 |
| `orders/QRX-SEED-1004` | Delivered → DRV-10012 |
| `orders/{id}/events` | Status timeline events per order |

### 4. Refresh Auth tokens

Custom claims are embedded in ID tokens at sign-in. After seeding:

1. Sign out of the admin and driver apps (or clear the session).
2. Sign back in with the seeded accounts.
3. Verify claims via browser devtools or `getIdTokenClaims()` in the client.

### 5. Smoke test checklist

- [ ] `npm run seed:firebase` exits with `✅ Seed complete`
- [ ] Admin sign-in redirects to `/dashboard` (not blocked by guard)
- [ ] Driver 1 sign-in redirects to `/driver-dashboard`
- [ ] Admin **Orders** lists `QRX-SEED-1001` … `QRX-SEED-1004` when `NEXT_PUBLIC_USE_API=true`
- [ ] Order detail for `QRX-SEED-1003` shows status timeline events
- [ ] Driver 1 sees assigned orders (`QRX-SEED-1002`, `1003`, `1004`) on driver dashboard
- [ ] Public tracking: `/track/QRX-SEED-1003` loads (when API enabled)
- [ ] Re-run `npm run seed:firebase` — no duplicate orders or users

---

## Auth UI & route protection (Phase 11)

**Login:** `components/dash/pages/login-page.tsx` and `driver-login-page.tsx` call Firebase email/password via `lib/auth/firebase-client.ts`. SMS login buttons are disabled (Twilio reserved for future **customer** notifications only).

**Custom claims** on ID tokens:

| Claim | Type | Values |
|-------|------|--------|
| `role` | string | `admin` · `dispatcher` · `driver` |
| `driverId` | string (optional) | e.g. `DRV-10012` — required for driver API routes |
| `active` | boolean (optional) | `false` blocks sign-in |

**Client helpers** (`lib/auth/firebase-client.ts`):

| Function | Purpose |
|----------|---------|
| `signInWithEmail(email, password)` | Firebase sign-in |
| `signOutUser()` | Sign out |
| `getCurrentIdToken()` | Bearer token for API calls |
| `getIdTokenClaims()` / `getDriverAuthClaims()` | Read custom claims |
| `getCurrentUserRole()` | Resolved `UserRole` or null |
| `subscribeToAuthState(callback)` | Auth state listener |
| `isAuthConfigured()` | True when `NEXT_PUBLIC_FIREBASE_*` set |
| `requireClientAuthRedirect(roles, loginPath)` | Used by auth guard |
| `resolvePostLoginRedirect(context)` | Post-login dashboard path |

**Route guards** (`components/dash/auth/auth-guard.tsx`):

| Guard | Protects | Login redirect |
|-------|----------|----------------|
| `AdminAuthGuard` | `/dashboard`, `/orders`, `/create-order`, `/drivers`, `/reports`, `/settings` | `/` |
| `DriverAuthGuard` | `/driver-dashboard`, `/driver-orders`, `/driver-route`, `/driver-messages`, `/driver-account` | `/driver-login` |

When Firebase is **not** configured, guards pass through — demo/mock mode unchanged.

**Public routes (no guard):** `/`, `/driver-login`, `/track/[trackingId]`, `/main-website/*`

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
| — | 10 | Public tracking + reports overview API + page hooks |
| — | 11 | Firebase login UI, auth guards, notification dev-log scaffold |
| — | 12 | Firebase seed script (`npm run seed:firebase`), docs for Auth setup + smoke tests |

**When you ship changes:** add a row to the changelog and update the **Implementation status** table above.
