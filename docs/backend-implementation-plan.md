# Quick-Run Express — Backend Implementation Plan

> **Status:** Backend routes/services largely implemented (Phases 1–4, 8–9). Admin/driver UI hooks exist with mock fallbacks. **Auth UI + route guards wired (Phase 11).** Create-order submit, full API-only UI migration, and Twilio notifications remain unfinished.
>
> **Scope:** Backend stays inside this Next.js 16 App Router repo under `app/api`. No separate Express server. No separate backend repo.

---

## 1. Current State Summary

Quick-Run Express is a **Next.js 16 App Router** app with a **working backend layer** (`app/api/*`, Firestore services) and **UI that still defaults to mock data** unless `NEXT_PUBLIC_USE_API=true` and Firebase Auth is configured.

| Surface | Routes | Data today |
|---------|--------|------------|
| **Admin / dispatch** | `/`, `/dashboard`, `/orders`, `/orders/[orderId]`, `/create-order`, `/drivers`, `/drivers/[driverId]`, `/reports`, `/settings` | Hooks (`useAdminOrders`, etc.) with **mock fallback**; create-order form is static (no submit) |
| **Driver mobile** | `/driver-login`, `/driver-dashboard`, `/driver-orders`, `/driver-orders/[orderId]`, `/driver-route`, `/driver-messages`, `/driver-account` | Hooks with mock fallback; proof flow merges API + `localStorage` |
| **Customer tracking** | `/track/[trackingId]`, `/main-website/track` | `useTracking()` hook + demo fallback |
| **Marketing site** | `/main-website/*` | Static content — unchanged |

### What exists now

- **API routes** — 15 Route Handlers under `app/api/` (orders, drivers, proofs, tracking, reports, import, health)
- **Authentication (server)** — `lib/server/auth.ts` verifies Firebase ID tokens + roles in route handlers
- **Authentication (client)** — Firebase email/password login on admin + driver pages; SMS login disabled
- **Route protection** — `AdminAuthGuard` / `DriverAuthGuard` on protected pages; demo mode when Firebase unset
- **Database** — Firestore services for orders, drivers, proofs, audit, import logs
- **File storage** — Firebase Storage upload helper for proofs
- **Environment config** — `.env.example` with placeholder Firebase vars
- **Notifications** — `lib/server/services/notifications.ts` dev-log scaffold only (no Twilio)

### What is still incomplete

- **Create order form** — no `POST /api/orders` from UI
- **Full API-only UI** — pages show mock data when `NEXT_PUBLIC_USE_API` is false or API calls fail
- **Driver proof sync** — driver detail page still relies on localStorage merge
- **Driver messages** — mock only, no API
- **Twilio / customer SMS** — future; dev-log notifications not wired into assign-driver yet
- **Middleware** — using client-side guards instead (Firebase client state required)

### Pre-implementation inspection notes (historical — partially resolved)

| Item | Finding |
|------|---------|
| Existing frontend routes | 26 `page.tsx` files under `app/` |
| Mock data files | Still retained as fallbacks — do not delete |
| Driver proof flow | `lib/dash/driver-store.ts` → localStorage + optional API sync |
| Order model | Unified in `lib/types/backend.ts` |
| Order detail | Now uses `useAdminOrderDetail(orderId)` — still mock fallback by default |
| Auth boundary | Client-side guards added; server routes require Bearer token |

### Files planned for creation (future phases)

```
docs/backend-implementation-plan.md          ← this document (Phase 1)
.env.example                                 ← Phase 1
lib/server/firebase-admin.ts                 ← Phase 2
lib/server/auth.ts                           ← Phase 2
lib/server/roles.ts                          ← Phase 2
lib/server/validation/                       ← Phase 3+
lib/server/services/orders.ts                ← Phase 3
lib/server/services/drivers.ts               ← Phase 3
lib/server/services/proofs.ts                ← Phase 3
lib/server/services/tracking.ts              ← Phase 3
lib/server/services/reports.ts               ← Phase 3
lib/server/services/import.ts                ← Phase 9
lib/types/backend.ts                         ← Phase 1 (shared types)
app/api/health/route.ts                      ← Phase 2
app/api/orders/...                           ← Phase 4
app/api/driver/...                           ← Phase 4
app/api/proofs/...                           ← Phase 4
app/api/drivers/...                          ← Phase 4
app/api/tracking/...                         ← Phase 10
app/api/reports/...                          ← Phase 10
app/api/integrations/...                     ← Phase 9
```

### Files planned for modification (future phases — not now)

| File | Change |
|------|--------|
| `components/dash/pages/*.tsx` | Swap mock imports for API fetch hooks |
| `lib/dash/driver-store.ts` | Keep as fallback; add API sync layer |
| `lib/dash/mock-data.ts` | Retain as fallback during migration |
| `lib/dash/driver-mock-data.ts` | Retain as fallback during migration |
| `components/dash/pages/login-page.tsx` | Wire Firebase Auth |
| `components/dash/pages/driver-login-page.tsx` | Wire Firebase Auth |
| `components/dash/pages/track-page.tsx` | Fetch from `/api/tracking/[trackingId]` |
| `components/site/tracking-demo.tsx` | Optional API path for non-demo codes |

### Recommended packages (install in Phase 2+)

| Package | Purpose |
|---------|---------|
| `firebase` | Client-side Firebase Auth (admin + driver login) |
| `firebase-admin` | Server-side token verification, Firestore, Storage in Route Handlers |
| `zod` | Request/response validation in API routes |

No additional packages are required for Route Handlers themselves — Next.js 16 App Router supports them natively.

### Risks before implementation

1. **Split order models** — Admin `Order` and driver `DriverOrder` use different IDs and fields. Must unify into one `Order` collection before migration or screens will show inconsistent data.
2. **Order detail ignores `orderId`** — `components/dash/pages/order-detail-page.tsx` renders hardcoded content regardless of the URL param. Backend wiring must fix lookup logic.
3. **localStorage proofs are device-local** — Proof data in `qre-driver-proofs` does not sync across devices or survive cache clears. Migration to Firebase Storage is required for production.
4. **No auth boundary** — All routes are publicly accessible today. Middleware + role checks must be added before exposing write APIs.
5. **Dev server conflicts** — `scripts/predev-check.mjs` warns about port 3000 conflicts and corrupted `.next` cache. Do not run `dev` and `dev:turbo` simultaneously.
6. **Parent folder lockfile pollution** — A `package-lock.json` in the parent `Coding_projects/` folder can cause Next.js to watch sibling projects and freeze.
7. **Large base64 payloads** — Current proof capture stores full data URLs in localStorage; Firestore documents should store Storage URLs + metadata only.

---

## 2. Route Map

Each frontend route is mapped to its future backend/data flow. **Replaces** column indicates what the API/database will eventually supersede.

### Admin routes

#### `/` — Admin login

| Field | Value |
|-------|-------|
| **Purpose** | Admin/dispatcher sign-in landing page |
| **Current data source** | Static UI; "Sign in" links directly to `/dashboard` (no auth) |
| **Future API** | Firebase Auth (email/password or SMS) — no dedicated REST login route; session via ID token |
| **Required role** | `admin` or `dispatcher` (post-auth redirect) |
| **Database collections** | `users` (profile + role) |
| **Replaces** | Hardcoded link bypass |

#### `/dashboard` — Operations overview

| Field | Value |
|-------|-------|
| **Purpose** | KPI cards, active orders table, driver activity, recent events |
| **Current data source** | `orders`, `drivers`, `recentActivity` from `lib/dash/mock-data.ts`; hardcoded stat values |
| **Future API** | `GET /api/orders?status=active&limit=…`, `GET /api/drivers?status=active`, `GET /api/reports/overview?range=today` |
| **Required role** | `admin`, `dispatcher` |
| **Database collections** | `orders`, `drivers`, `orderStatusEvents`, `auditLogs` |
| **Replaces** | Mock data + hardcoded stats |

#### `/orders` — Order list

| Field | Value |
|-------|-------|
| **Purpose** | Searchable/filterable order table with bulk actions |
| **Current data source** | `orders` from `lib/dash/mock-data.ts` |
| **Future API** | `GET /api/orders` (query: status, driverId, dateRange, payment, search) |
| **Required role** | `admin`, `dispatcher` |
| **Database collections** | `orders` |
| **Replaces** | Mock data |

#### `/orders/[orderId]` — Order detail

| Field | Value |
|-------|-------|
| **Purpose** | Full order view: customer, payment, timeline, proofs, notes, driver assignment |
| **Current data source** | Hardcoded content; `orderId` from URL is display-only |
| **Future API** | `GET /api/orders/[id]`, `PATCH /api/orders/[id]`, `POST /api/orders/[id]/assign-driver`, `GET /api/orders/[id]/proofs` |
| **Required role** | `admin`, `dispatcher` |
| **Database collections** | `orders`, `orderStatusEvents`, `proofAssets`, `drivers`, `auditLogs` |
| **Replaces** | Hardcoded detail content |

#### `/create-order` — New order wizard

| Field | Value |
|-------|-------|
| **Purpose** | Multi-step order creation with driver assignment |
| **Current data source** | Hardcoded form defaults; `drivers` from `lib/dash/mock-data.ts` for assignment picker |
| **Future API** | `POST /api/orders`, `GET /api/drivers?status=Available` |
| **Required role** | `admin`, `dispatcher` |
| **Database collections** | `orders`, `orderStatusEvents`, `auditLogs` |
| **Replaces** | Hardcoded form + mock drivers |

#### `/drivers` — Driver roster

| Field | Value |
|-------|-------|
| **Purpose** | List all drivers with status, metrics, and actions |
| **Current data source** | `drivers` from `lib/dash/mock-data.ts` |
| **Future API** | `GET /api/drivers` |
| **Required role** | `admin`, `dispatcher` |
| **Database collections** | `drivers`, `users` |
| **Replaces** | Mock data |

#### `/drivers/[driverId]` — Driver profile

| Field | Value |
|-------|-------|
| **Purpose** | Individual driver stats, assigned orders, performance |
| **Current data source** | `drivers`, `orders` from `lib/dash/mock-data.ts` (filtered client-side) |
| **Future API** | `GET /api/drivers/[id]`, `PATCH /api/drivers/[id]`, `GET /api/orders?driverId=[id]` |
| **Required role** | `admin`, `dispatcher` |
| **Database collections** | `drivers`, `orders`, `users` |
| **Replaces** | Mock data |

#### `/reports` — Analytics

| Field | Value |
|-------|-------|
| **Purpose** | Delivery metrics, charts, driver performance, payment breakdown |
| **Current data source** | Hardcoded stat values; `drivers` from mock-data for performance chart |
| **Future API** | `GET /api/reports/overview` (query: dateRange, compareRange, driverId, status) |
| **Required role** | `admin` |
| **Database collections** | `orders`, `drivers`, `orderStatusEvents` (aggregated server-side) |
| **Replaces** | Hardcoded stats + mock drivers |

#### `/settings` — Business configuration

| Field | Value |
|-------|-------|
| **Purpose** | Business info, notifications, delivery areas, integrations, security |
| **Current data source** | Hardcoded form values throughout the page |
| **Future API** | `GET/PATCH /api/settings` (to be added in a later phase; not in initial API list) |
| **Required role** | `admin` |
| **Database collections** | `settings` (single doc or subcollection) |
| **Replaces** | Hardcoded content |

---

### Driver routes

#### `/driver-login` — Driver sign-in

| Field | Value |
|-------|-------|
| **Purpose** | Mobile driver authentication |
| **Current data source** | Static UI; "Sign in" links directly to `/driver-dashboard` |
| **Future API** | Firebase Auth (driver role claim) |
| **Required role** | `driver` (post-auth) |
| **Database collections** | `users`, `drivers` |
| **Replaces** | Hardcoded link bypass |

#### `/driver-dashboard` — Driver home

| Field | Value |
|-------|-------|
| **Purpose** | Active delivery card, today's route summary, completed count |
| **Current data source** | `CURRENT_DRIVER`, `driverOrders`, `completedOrders` from `driver-mock-data.ts`; proof progress from `driver-store.ts` (localStorage) |
| **Future API** | `GET /api/driver/orders?scope=today`, `GET /api/drivers/[id]` (self) |
| **Required role** | `driver` (own data only) |
| **Database collections** | `orders`, `drivers`, `proofAssets` |
| **Replaces** | Mock data + localStorage |

#### `/driver-orders` — Assigned orders list

| Field | Value |
|-------|-------|
| **Purpose** | Today's active and completed deliveries |
| **Current data source** | `driverOrders`, `completedOrders` from `driver-mock-data.ts` |
| **Future API** | `GET /api/driver/orders` |
| **Required role** | `driver` |
| **Database collections** | `orders` (filtered by `assignedDriverId`) |
| **Replaces** | Mock data |

#### `/driver-orders/[orderId]` — Delivery workflow

| Field | Value |
|-------|-------|
| **Purpose** | Step-by-step delivery checklist, proof capture (signature, photo), maps links |
| **Current data source** | `getDriverOrder()` from `driver-mock-data.ts`; steps/proofs in `driver-store.ts` (localStorage key `qre-driver-proofs`) |
| **Future API** | `GET /api/driver/orders/[id]`, `POST /api/orders/[id]/status`, `POST /api/orders/[id]/proofs` |
| **Required role** | `driver` (assigned order only) |
| **Database collections** | `orders`, `orderStatusEvents`, `proofAssets` |
| **Replaces** | Mock data + **localStorage** |

#### `/driver-route` — Route map view

| Field | Value |
|-------|-------|
| **Purpose** | Ordered stop list with navigation links |
| **Current data source** | `driverOrders` from mock-data; proof progress from localStorage |
| **Future API** | `GET /api/driver/orders?scope=route` |
| **Required role** | `driver` |
| **Database collections** | `orders` |
| **Replaces** | Mock data + localStorage |

#### `/driver-messages` — Dispatch messages

| Field | Value |
|-------|-------|
| **Purpose** | Inbox of dispatch/support messages |
| **Current data source** | `driverMessages` from `driver-mock-data.ts` |
| **Future API** | `GET /api/driver/messages` (future; not in initial API list) |
| **Required role** | `driver` |
| **Database collections** | `messages` (future collection) |
| **Replaces** | Mock data |

#### `/driver-account` — Driver profile & settings

| Field | Value |
|-------|-------|
| **Purpose** | View/edit driver profile, vehicle, notification prefs |
| **Current data source** | `CURRENT_DRIVER` from `driver-mock-data.ts` |
| **Future API** | `GET /api/drivers/[id]` (self), `PATCH /api/drivers/[id]` |
| **Required role** | `driver` (self only) |
| **Database collections** | `drivers`, `users` |
| **Replaces** | Mock `CURRENT_DRIVER` constant |

---

### Customer tracking routes

#### `/track/[trackingId]` — Public order tracking

| Field | Value |
|-------|-------|
| **Purpose** | Customer-facing delivery status page (no login) |
| **Current data source** | Hardcoded timeline in `components/dash/pages/track-page.tsx`; displays `trackingId` from URL but same static content for all IDs |
| **Future API** | `GET /api/tracking/[trackingId]` (public, sanitized response) |
| **Required role** | **Public** (no auth; token/code is the access control) |
| **Database collections** | `orders`, `orderStatusEvents` |
| **Replaces** | Hardcoded content |

#### `/main-website/track` — Marketing tracking demo

| Field | Value |
|-------|-------|
| **Purpose** | Marketing page with interactive tracking demo |
| **Current data source** | `data/trackingDemo.ts` — only `QRX-28491` returns demo data |
| **Future API** | `GET /api/tracking/[trackingId]` for real codes; keep demo fallback for `QRX-28491` |
| **Required role** | **Public** |
| **Database collections** | `orders`, `orderStatusEvents` |
| **Replaces** | Demo mock for real tracking codes; keep `trackingDemo.ts` as fallback |

---

## 3. Backend API Route Plan

All routes live under `app/api/` as Next.js Route Handlers. Auth = Firebase ID token in `Authorization: Bearer <token>` unless marked public.

### Health

#### `GET /api/health`

| Field | Value |
|-------|-------|
| **Purpose** | Liveness check for deployment and local dev |
| **Auth role** | Public |
| **Request body** | — |
| **Response** | `{ status: "ok", timestamp: string, version?: string }` |
| **Collections** | None |
| **Priority** | P1 (Phase 2) |

---

### Orders

#### `GET /api/orders`

| Field | Value |
|-------|-------|
| **Purpose** | List orders with filters (admin order table, dashboard) |
| **Auth role** | `admin`, `dispatcher` |
| **Query params** | `status`, `driverId`, `payment`, `search`, `dateFrom`, `dateTo`, `limit`, `cursor` |
| **Response** | `{ orders: Order[], total: number, nextCursor?: string }` |
| **Collections** | `orders` |
| **Priority** | P1 (Phase 4) |

#### `POST /api/orders`

| Field | Value |
|-------|-------|
| **Purpose** | Create a new order (create-order wizard) |
| **Auth role** | `admin`, `dispatcher` |
| **Request body** | `CreateOrderInput` — customer, pickup, delivery address, payment, notes, optional `assignedDriverId` |
| **Response** | `{ order: Order }` |
| **Collections** | `orders`, `orderStatusEvents`, `auditLogs` |
| **Priority** | P1 (Phase 4) |

#### `GET /api/orders/[id]`

| Field | Value |
|-------|-------|
| **Purpose** | Single order detail for admin |
| **Auth role** | `admin`, `dispatcher` |
| **Response** | `{ order: Order, statusEvents: OrderStatusEvent[], proofs?: ProofAsset[] }` |
| **Collections** | `orders`, `orderStatusEvents`, `proofAssets` |
| **Priority** | P1 (Phase 4) |

#### `PATCH /api/orders/[id]`

| Field | Value |
|-------|-------|
| **Purpose** | Update order fields (customer info, notes, payment, addresses) |
| **Auth role** | `admin`, `dispatcher` |
| **Request body** | Partial `Order` update fields |
| **Response** | `{ order: Order }` |
| **Collections** | `orders`, `auditLogs` |
| **Priority** | P2 (Phase 4) |

#### `POST /api/orders/[id]/assign-driver`

| Field | Value |
|-------|-------|
| **Purpose** | Assign or reassign a driver to an order |
| **Auth role** | `admin`, `dispatcher` |
| **Request body** | `{ driverId: string }` |
| **Response** | `{ order: Order }` |
| **Collections** | `orders`, `orderStatusEvents`, `auditLogs` |
| **Priority** | P1 (Phase 4) |

#### `POST /api/orders/[id]/status`

| Field | Value |
|-------|-------|
| **Purpose** | Advance order status (driver workflow steps or admin override) |
| **Auth role** | `driver` (own assigned orders), `admin`, `dispatcher` |
| **Request body** | `{ status: OrderStatus, stepKey?: DeliveryStepKey, note?: string }` |
| **Response** | `{ order: Order, event: OrderStatusEvent }` |
| **Collections** | `orders`, `orderStatusEvents`, `auditLogs` |
| **Priority** | P1 (Phase 4) |

---

### Driver-specific orders

#### `GET /api/driver/orders`

| Field | Value |
|-------|-------|
| **Purpose** | List orders assigned to the authenticated driver |
| **Auth role** | `driver` |
| **Query params** | `scope` (`today` \| `active` \| `completed` \| `route`), `limit` |
| **Response** | `{ orders: Order[] }` |
| **Collections** | `orders` |
| **Priority** | P1 (Phase 4) |

#### `GET /api/driver/orders/[id]`

| Field | Value |
|-------|-------|
| **Purpose** | Single order for driver delivery workflow |
| **Auth role** | `driver` (must be assigned to this order) |
| **Response** | `{ order: Order, statusEvents: OrderStatusEvent[], proofs: ProofAsset[] }` |
| **Collections** | `orders`, `orderStatusEvents`, `proofAssets` |
| **Priority** | P1 (Phase 4) |

---

### Proof uploads and review

#### `GET /api/orders/[id]/proofs`

| Field | Value |
|-------|-------|
| **Purpose** | List proof assets for an order |
| **Auth role** | `admin`, `dispatcher`, `driver` (assigned) |
| **Response** | `{ proofs: ProofAsset[] }` |
| **Collections** | `proofAssets` |
| **Priority** | P2 (Phase 7) |

#### `POST /api/orders/[id]/proofs`

| Field | Value |
|-------|-------|
| **Purpose** | Upload proof metadata after Firebase Storage upload; record delivery step completion |
| **Auth role** | `driver` (assigned) |
| **Request body** | `{ type: "signature" \| "exteriorPhoto" \| "idVerification", storagePath: string, mimeType: string, stepKey: DeliveryStepKey }` |
| **Response** | `{ proof: ProofAsset }` |
| **Collections** | `proofAssets`, `orders`, `orderStatusEvents` |
| **Priority** | P1 (Phase 7) |

#### `PATCH /api/proofs/[proofId]/review`

| Field | Value |
|-------|-------|
| **Purpose** | Admin approve/reject a proof with notes |
| **Auth role** | `admin`, `dispatcher` |
| **Request body** | `{ status: "approved" \| "rejected", reviewNote?: string }` |
| **Response** | `{ proof: ProofAsset }` |
| **Collections** | `proofAssets`, `auditLogs` |
| **Priority** | P2 (Phase 8) |

---

### Drivers

#### `GET /api/drivers`

| Field | Value |
|-------|-------|
| **Purpose** | List drivers for admin roster and assignment pickers |
| **Auth role** | `admin`, `dispatcher` |
| **Query params** | `status`, `search`, `limit` |
| **Response** | `{ drivers: DriverProfile[] }` |
| **Collections** | `drivers` |
| **Priority** | P1 (Phase 4) |

#### `POST /api/drivers`

| Field | Value |
|-------|-------|
| **Purpose** | Create a new driver account |
| **Auth role** | `admin` |
| **Request body** | `{ email, phone, name, vehicle?, ... }` |
| **Response** | `{ driver: DriverProfile }` |
| **Collections** | `drivers`, `users` |
| **Priority** | P2 (Phase 4) |

#### `PATCH /api/drivers/[id]`

| Field | Value |
|-------|-------|
| **Purpose** | Update driver profile, status, vehicle |
| **Auth role** | `admin` (any driver), `driver` (self only) |
| **Request body** | Partial `DriverProfile` fields |
| **Response** | `{ driver: DriverProfile }` |
| **Collections** | `drivers`, `auditLogs` |
| **Priority** | P2 (Phase 4) |

---

### Tracking

#### `GET /api/tracking/[trackingId]`

| Field | Value |
|-------|-------|
| **Purpose** | Public sanitized tracking view for customers |
| **Auth role** | **Public** |
| **Response** | `{ tracking: TrackingView }` — no internal IDs, no payment details, no full driver contact |
| **Collections** | `orders`, `orderStatusEvents` |
| **Priority** | P2 (Phase 10) |

---

### Reports

#### `GET /api/reports/overview`

| Field | Value |
|-------|-------|
| **Purpose** | Aggregated metrics for reports page |
| **Auth role** | `admin` |
| **Query params** | `dateFrom`, `dateTo`, `compareFrom`, `compareTo`, `driverId`, `status` |
| **Response** | `{ totals: { deliveries, completed, failed, returned, orderValue, fees, unpaid, avgDeliveryTimeMs }, breakdowns: { status, payment, drivers[] }, trends: { daily[] } }` |
| **Collections** | `orders`, `drivers`, `orderStatusEvents` |
| **Priority** | P2 (Phase 10) |

---

### Generic order import

#### `POST /api/integrations/order-import`

| Field | Value |
|-------|-------|
| **Purpose** | Import orders from external providers via generic adapter (mock payloads only until tested) |
| **Auth role** | `admin` |
| **Request body** | `{ source: string, payload: unknown }` — validated by source-specific Zod schema |
| **Response** | `{ imported: number, orders: Order[], errors?: string[] }` |
| **Collections** | `orders`, `importLogs`, `auditLogs` |
| **Priority** | P3 (Phase 9) |

#### `GET /api/integrations/import-logs`

| Field | Value |
|-------|-------|
| **Purpose** | View history of import runs |
| **Auth role** | `admin` |
| **Query params** | `source`, `limit`, `cursor` |
| **Response** | `{ logs: ImportLog[], nextCursor?: string }` |
| **Collections** | `importLogs` |
| **Priority** | P3 (Phase 9) |

---

## 4. Data Model

TypeScript-style interfaces for the unified backend model. These will live in `lib/types/backend.ts` in a future phase.

> **Critical:** `Order` is the **single source of truth** for admin and driver screens. The current `lib/dash/mock-data.ts` `Order` and `lib/dash/driver-mock-data.ts` `DriverOrder` must converge into this model. Driver-specific fields (`pickupName`, `pickupAddress`, `unit`, `eta`, `notes`) become first-class `Order` fields.

```typescript
type UserRole = "admin" | "dispatcher" | "driver";

interface UserProfile {
  uid: string;                    // Firebase Auth UID
  email: string;
  phone?: string;
  displayName: string;
  role: UserRole;
  driverId?: string;              // Link to drivers collection when role === "driver"
  createdAt: string;              // ISO 8601
  updatedAt: string;
  lastLoginAt?: string;
  isActive: boolean;
}

interface DriverProfile {
  id: string;                     // e.g. "DRV-10012"
  userId: string;                 // Firebase Auth UID
  name: string;
  phone: string;
  email: string;
  status: "Available" | "Busy" | "Inactive" | "Suspended";
  vehicle?: string;
  avatarColor: string;
  initials: string;
  // Computed / denormalized metrics (updated by Cloud Function or on-write)
  activeDeliveries: number;
  completedToday: number;
  failedToday: number;
  averageDeliveryTimeMs?: number;
  rating?: number;
  successRate?: number;
  totalDeliveries?: number;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

type OrderStatus =
  | "New"
  | "Assigned"
  | "Picked Up"
  | "En Route"
  | "Out for Delivery"
  | "Delivered"
  | "Failed"
  | "Returned"
  | "Scheduled";

type PaymentStatus = "Paid" | "Pending" | "Unpaid";

type DeliveryStepKey =
  | "arrivedPickup"
  | "pickedUp"
  | "outForDelivery"
  | "arrivedDestination"
  | "verifyId"
  | "signature"
  | "exteriorPhoto";

interface Order {
  id: string;                     // e.g. "QRX-10098"
  trackingId: string;             // Public tracking code (may equal id or be separate)
  externalOrderId?: string;       // e.g. "UBER-9F23K"

  // Customer
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  companyName?: string;

  // Pickup (driver fields — unified here)
  pickupName: string;
  pickupAddress: string;

  // Delivery
  deliveryAddress: string;
  deliveryUnit?: string;
  deliveryArea?: string;
  deliveryInstructions?: string;
  deliveryWindow?: string;

  // Assignment
  assignedDriverId: string | null;
  assignedDriverName: string | null;  // denormalized for list views

  // Status & payment
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  subtotalCents?: number;
  deliveryFeeCents?: number;
  taxCents?: number;
  totalCents: number;
  totalDisplay: string;           // formatted e.g. "$128.50" for UI compat during migration

  // Driver workflow
  eta?: string;
  notes?: string;
  completedSteps: DeliveryStepKey[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  scheduledFor?: string;

  // Metadata
  createdBy?: string;             // userId
  source: "manual" | "import" | string;
  importLogId?: string;
}

interface OrderStatusEvent {
  id: string;
  orderId: string;
  status: OrderStatus;
  stepKey?: DeliveryStepKey;
  note?: string;
  actorId: string;                // userId or "system"
  actorRole: UserRole | "system";
  createdAt: string;
}

type ProofType = "signature" | "exteriorPhoto" | "idVerification";
type ProofReviewStatus = "pending" | "approved" | "rejected";

interface ProofAsset {
  id: string;
  orderId: string;
  type: ProofType;
  stepKey: DeliveryStepKey;
  storagePath: string;            // Firebase Storage path
  downloadUrl?: string;           // Signed URL (generated on read)
  mimeType: string;
  fileSizeBytes?: number;
  uploadedBy: string;             // driver userId
  uploadedAt: string;
  reviewStatus: ProofReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

interface ImportLog {
  id: string;
  source: string;                 // e.g. "mock-uber", "mock-doordash"
  status: "success" | "partial" | "failed";
  ordersImported: number;
  ordersFailed: number;
  errors?: string[];
  payloadSummary?: string;        // Truncated description, not full payload
  initiatedBy: string;
  createdAt: string;
  completedAt?: string;
}

interface AuditLog {
  id: string;
  action: string;                 // e.g. "order.assign_driver", "proof.review"
  entityType: "order" | "driver" | "proof" | "import" | "user";
  entityId: string;
  actorId: string;
  actorRole: UserRole | "system";
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface TrackingView {
  trackingId: string;
  status: OrderStatus;
  statusLabel: string;            // Customer-friendly label e.g. "In transit"
  estimatedArrival?: string;
  deliveryType?: string;
  driverFirstName?: string;       // First name only for privacy
  vehicleDescription?: string;
  pickupName?: string;
  pickupAddress?: string;         // Optional — may hide for privacy
  steps: {
    label: string;
    time?: string;
    status: "complete" | "current" | "pending";
  }[];
  notifications: {
    title: string;
    time: string;
  }[];
  lastUpdatedAt: string;
}
```

### Firestore collection layout (recommended)

| Collection | Document ID | Notes |
|------------|-------------|-------|
| `users` | Firebase Auth `uid` | Role + profile |
| `drivers` | `DRV-xxxxx` | Operational driver record |
| `orders` | `QRX-xxxxx` | Single source of truth |
| `orderStatusEvents` | auto | Subcollection under `orders/{id}/events` preferred |
| `proofAssets` | auto | Subcollection under `orders/{id}/proofs` preferred |
| `importLogs` | auto | Top-level |
| `auditLogs` | auto | Top-level, TTL index optional |
| `settings` | `global` | Single business config doc |

### Order unification mapping

| Current admin `Order` field | Current driver `DriverOrder` field | Unified `Order` field |
|----------------------------|-----------------------------------|----------------------|
| `customer` | `customer` | `customerName` |
| `phone` | `phone` | `customerPhone` |
| `address` | `address` | `deliveryAddress` |
| — | `unit` | `deliveryUnit` |
| — | `pickupName` | `pickupName` |
| — | `pickupAddress` | `pickupAddress` |
| `driver` (name string) | — | `assignedDriverId` + `assignedDriverName` |
| `external` | — | `externalOrderId` |
| `payment` | `payment` | `paymentStatus` |
| `total` | `total` | `totalDisplay` + `totalCents` |
| — | `eta` | `eta` |
| — | `notes` | `notes` |

---

## 5. Recommended Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Auth** | Firebase Auth | Email/password + SMS OTP; custom claims for `UserRole`; works on client and server |
| **Database** | Firestore | Real-time capable, flexible schema for orders/events, good Firebase Admin SDK support |
| **File storage** | Firebase Storage | Proof images and signatures; signed URLs for admin review |
| **Server SDK** | Firebase Admin SDK | Token verification and privileged reads/writes in Route Handlers |
| **Validation** | Zod | Runtime request validation with TypeScript inference |
| **API layer** | Next.js Route Handlers (`app/api`) | Same deploy unit as the UI; no CORS complexity; shares types |

### Why keep backend in this repo (not a separate backend repo)

1. **Single deploy** — Vercel/Node hosts UI and API together; no cross-origin or separate CI pipelines.
2. **Shared types** — `Order`, `ProofAsset`, etc. import directly from `lib/types/backend.ts` into components and Route Handlers.
3. **Incremental migration** — Mock data files stay as fallbacks while each page switches to API reads one at a time.
4. **Team size / stage** — Early-stage product benefits from one repo, one PR flow, one `npm run build`.
5. **No Express needed** — Next.js Route Handlers provide HTTP methods, dynamic segments, and middleware; adding Express would duplicate routing and complicate deployment.

When the API surface grows large (e.g. background jobs, webhooks, multi-region), consider extracting **workers** or **webhook receivers** — but not until the internal flow is proven.

### `.env.example` placeholders (Phase 1)

```bash
# Firebase Client (public — safe for browser)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:abcdef

# Firebase Admin (server-only — never expose to client)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 6. Implementation Phases

### Phase 1 — Documentation & scaffolding *(complete)*

- [x] `docs/backend-implementation-plan.md`
- [x] `.env.example` with placeholders only
- [x] `lib/types/backend.ts` with interfaces from Section 4
- [x] Empty `lib/server/` folder structure with README stubs
- [x] Keep all mock data files untouched

### Phase 2 — Firebase setup & health endpoint *(complete)*

- [x] Install `firebase`, `firebase-admin`, `zod`
- [ ] Firebase project config (manual — copy `.env.example` → `.env.local` with real values)
- [x] `lib/server/firebase-admin.ts` — singleton Admin app
- [x] `lib/server/auth.ts` — `verifyIdToken()`, `requireRole()`
- [x] `lib/server/roles.ts` — role constants and helpers
- [x] `GET /api/health`
- [x] Client auth helpers (`lib/auth/firebase-client.ts`) — login pages not wired yet

### Phase 3 — Firestore service layer *(complete)*

- [x] `lib/server/services/orders.ts` — CRUD, list, assign, status transitions
- [x] `lib/server/services/drivers.ts` — CRUD, metrics fields
- [x] `lib/server/services/proofs.ts` — metadata CRUD, signed URL generation
- [x] `lib/server/services/tracking.ts` — public `TrackingView` builder
- [x] `lib/server/services/reports.ts` — aggregation queries
- [x] `lib/server/services/import.ts` — mock payload adapter + fixtures
- [x] `lib/server/services/audit.ts` — append-only audit writer
- [x] Zod schemas in `lib/server/validation/`
- [x] `docs/BACKEND.md` — living backend reference

### Phase 4 — API route handlers (orders & drivers) *(complete)*

- [x] `GET/POST /api/orders`
- [x] `GET/PATCH /api/orders/[id]`
- [x] `POST /api/orders/[id]/assign-driver`
- [x] `POST /api/orders/[id]/status`
- [x] `GET /api/driver/orders`
- [x] `GET /api/driver/orders/[id]`
- [x] `GET/POST /api/drivers`
- [x] `GET/PATCH /api/drivers/[id]`
- [x] `lib/server/route-utils.ts` — JSON/query parsing + Firebase guard
- [x] `lib/server/driver-context.ts` — driver ID resolution from token/Firestore
- [x] Standard error envelope via `handleServiceError()`
- [x] `docs/BACKEND.md` updated

### Phase 5 — Replace mock admin data *(complete)*

- [x] `lib/dash/api/` — client, adapters, config
- [x] `lib/dash/hooks/` — `useAdminOrders`, `useAdminDrivers`, `useAdminOrderDetail`
- [x] `NEXT_PUBLIC_USE_API` in `.env.example`
- [x] `dashboard-page`, `orders-page`, `order-detail-page`, `drivers-page`, `driver-profile-page`, `create-order-page`
- [x] Order detail fetches by `orderId` with API + mock fallback
- [x] `docs/BACKEND.md` updated

### Phase 6 — Replace mock driver data *(complete)*

- [x] `lib/dash/api/driver-client.ts`, `driver-adapters.ts`
- [x] `lib/dash/hooks/` — `useDriverSession`, `useDriverOrders`, `useDriverRouteOrders`, `useDriverOrder`
- [x] `lib/auth/firebase-client.ts` — `getDriverAuthClaims()` for `driverId` claim
- [x] `driver-dashboard-page`, `driver-orders-list-page`, `driver-order-detail-page`, `driver-route-page`, `driver-account-page`
- [x] Authenticated `GET /api/driver/orders` + `GET /api/driver/orders/[id]` with mock fallback
- [x] `driver-messages-page` still mock (out of scope)
- [x] Proof flow unchanged (`driver-store.ts` localStorage — Phase 7)
- [x] `docs/BACKEND.md` updated

### Phase 7 — Proof upload (localStorage → Firebase Storage) *(complete)*

- [x] `lib/auth/firebase-storage.ts` — client upload to `orders/{orderId}/proofs/…`
- [x] `GET/POST /api/orders/[id]/proofs` — list + metadata via `createProof()`
- [x] `lib/dash/api/driver-client.ts` — `postOrderProof`, `postOrderStatus`
- [x] `lib/dash/driver-store.ts` — `saveProofAsync`, `markStepCompleteAsync`, `completeDeliveryAsync` (optimistic local + API sync)
- [x] `driver-order-detail-page` — merges API proofs/steps with localStorage; syncs on capture, step tap, complete
- [x] `useDriverOrder` — returns `completedSteps` + `proofs` from API
- [x] localStorage retained as offline fallback when sync fails
- [x] `docs/BACKEND.md` updated

### Phase 8 — Admin proof review & audit logs *(complete)*

- [x] `PATCH /api/proofs/[proofId]/review?orderId=` — approve/reject with notes
- [x] `useAdminOrderDetail` fetches proofs via `GET /api/orders/[id]/proofs`
- [x] `order-detail-page` — proof gallery with images, review badges, approve/reject actions
- [x] `ProofReviewBadge` component
- [x] `reviewProof()` writes to `auditLogs` (existing service)
- [x] Mock placeholder gallery when API disabled or no proofs
- [x] `docs/BACKEND.md` updated

### Phase 9 — Generic order import (mock only) *(complete)*

- [x] `lib/import/mock-fixtures.ts` — shared Uber/DoorDash/Amazon mock payloads
- [x] `POST /api/integrations/order-import` — admin only, `importOrders()` service
- [x] `GET /api/integrations/import-logs` — paginated import history
- [x] `lib/dash/hooks/use-admin-import.ts` — logs + `runMockImport()`
- [x] `settings-page` — mock provider import runner + import log table
- [x] Audit log on each import run (`import.run`)
- [x] No live external APIs connected
- [x] `docs/BACKEND.md` updated

### Phase 10 — Customer tracking & reports *(complete)*

- [x] `GET /api/tracking/[trackingId]` — public sanitized `TrackingView`
- [x] `GET /api/reports/overview` — admin aggregated metrics
- [x] `lib/dash/api/tracking-client.ts` — public fetch (no auth)
- [x] `useTracking`, `useAdminReports` hooks
- [x] `track-page` — API data with demo code + mock fallback
- [x] `tracking-demo` — demo code `QRX-28491` + API lookup for real codes
- [x] `reports-page` — stat cards, charts, driver breakdown from API
- [x] Zones / failure reasons remain mock (not in API scope)
- [x] `docs/BACKEND.md` updated
- Replace hardcoded stat cards with API response

---

## 7. Cursor Safety Notes

When continuing backend implementation in Cursor, follow these rules:

1. **Do not run multiple dev servers** — Only one of `npm run dev` or `npm run dev:turbo` at a time on port 3000.
2. **Do not run `dev` and `dev:turbo` together** — They conflict on port 3000; use `npm run kill:dev` first if needed.
3. **Do not wipe or redesign existing UI** — Backend work adds API wiring behind existing components; preserve layouts and styles.
4. **Do not remove mock data until the database-backed replacement works** — Keep `lib/dash/mock-data.ts` and `lib/dash/driver-mock-data.ts` as fallbacks with a feature flag during migration.
5. **Do not add real credentials** — Use `.env.local` (gitignored) for real values; `.env.example` gets placeholders only.
6. **Do not connect live external order APIs** until the internal create → assign → deliver → proof → track flow is tested end-to-end with mock import payloads.
7. **Do not create a separate backend repo or Express server** — All HTTP endpoints go in `app/api/`.
8. **Run dev only from `Dispatch_system/`** — The `predev-check.mjs` script enforces correct working directory.
9. **Prefer `npm run dev:clean`** if `.next` cache is corrupted (missing manifest files).
10. **Unify the Order model first** — Do not migrate admin and driver pages separately on different schemas.

---

## Appendix: Current File Reference

| Path | Role |
|------|------|
| `lib/dash/mock-data.ts` | Admin orders, drivers, recent activity |
| `lib/dash/driver-mock-data.ts` | Driver orders, profile, messages, delivery steps |
| `lib/dash/driver-store.ts` | localStorage proof/step persistence (`qre-driver-proofs`) |
| `data/trackingDemo.ts` | Marketing site tracking demo (`QRX-28491`) |
| `components/dash/driver/proof-capture.tsx` | Camera/signature capture → base64 data URLs |
| `scripts/predev-check.mjs` | Dev environment guards (port, cwd, cache) |

*Last updated: Phase 5 — Admin UI API wiring with mock fallback.*
