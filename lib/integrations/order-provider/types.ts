export type ExternalOrderProviderMode = "mock" | "live";

export interface ExternalProviderOrderItem {
  name: string;
  quantity: number;
  unitPrice: number | null;
  notes: string | null;
  sku?: string | null;
  category?: string | null;
}

export interface ExternalOrderCustomer {
  name: string | null;
  phone: string | null;
  email: string | null;
}

export interface ExternalOrderDelivery {
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  formattedAddress: string | null;
  notes: string | null;
}

export interface ExternalOrderTotals {
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  total: number;
}

export type ExternalOrderAssignmentStatus = "unassigned" | "assigned";
export type ExternalOrderDispatchStatus =
  | "pending"
  | "needs_review"
  | "ready"
  | "assigned"
  | "promoted";

/** Raw order shape returned by a provider adapter (mock or live). */
export interface ExternalProviderOrder {
  id: string;
  orderNumber: string;
  status: string;
  deliveryStatus: string | null;
  isDelivery: boolean;
  total: number;
  placedAt: string;
  customer: {
    name: string | null;
    phone: string | null;
  };
  pickupAddress: string | null;
  deliveryAddress: string | null;
  deliveryInstructions: string | null;
  items: ExternalProviderOrderItem[];
}

export type CustomerEnrichmentStatus = "success" | "failed" | "skipped";

/** Normalized internal order shape stored in Firestore. */
export interface NormalizedExternalOrder {
  provider: string;
  externalOrderId: string;
  externalOrderNumber: string | null;
  /** Barnet/source order status */
  status: string;
  sourceStatus: string;
  deliveryStatus: string | null;
  paymentStatus: string | null;
  isDelivery: boolean;
  total: number;
  placedAt: string;
  sourceLocationId: string | null;
  externalCustomerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customer: ExternalOrderCustomer;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  deliveryInstructions: string | null;
  delivery: ExternalOrderDelivery;
  totals: ExternalOrderTotals;
  items: ExternalProviderOrderItem[];
  customerMessagingReady: boolean;
  customerEnrichmentStatus: CustomerEnrichmentStatus | null;
  customerEnrichmentError: string | null;
  dispatchReady: boolean;
  /** True when this is a delivery order that is not yet dispatch-ready. */
  needsReview: boolean;
  /** Stable review reason codes (e.g. missing_address). */
  reviewReasons: string[];
  missingFields: string[];
  assignmentStatus: ExternalOrderAssignmentStatus;
  dispatchStatus: ExternalOrderDispatchStatus;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  lastSyncedAt: string | null;
  promoted: boolean;
  promotedOrderId: string | null;
  promotedAt: string | null;
  rawPayload: unknown;
  /** Stable hash of Barnet source fields for change detection during sync. */
  syncSourceHash?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Admin intake list row — includes dispatch PII for manual assignment. */
export interface ExternalOrderIntakeRow {
  id: string;
  provider: string;
  externalOrderId: string;
  externalOrderNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  itemsCount: number;
  total: number;
  sourceStatus: string;
  dispatchReady: boolean;
  needsReview: boolean;
  reviewReasons: string[];
  customerMessagingReady: boolean;
  missingFields: string[];
  assignmentStatus: ExternalOrderAssignmentStatus;
  dispatchStatus: ExternalOrderDispatchStatus;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
  isPreview: boolean;
  alreadyImported: boolean;
  promoted: boolean;
  promotedOrderId: string | null;
  promotedAt: string | null;
  updatedAt: string;
  lastSyncedAt: string | null;
}

/** Admin intake detail — full dispatch fields without raw Barnet payload. */
export interface ExternalOrderIntakeDetail {
  id: string;
  provider: string;
  externalOrderId: string;
  externalOrderNumber: string | null;
  sourceLocationId: string | null;
  sourceStatus: string;
  deliveryStatus: string | null;
  paymentStatus: string | null;
  placedAt: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
  isDelivery: boolean;
  customer: ExternalOrderCustomer & { externalCustomerId: string | null };
  delivery: ExternalOrderDelivery;
  items: ExternalProviderOrderItem[];
  totals: ExternalOrderTotals;
  dispatchReady: boolean;
  needsReview: boolean;
  reviewReasons: string[];
  customerMessagingReady: boolean;
  customerEnrichmentStatus: CustomerEnrichmentStatus | null;
  missingFields: string[];
  assignmentStatus: ExternalOrderAssignmentStatus;
  dispatchStatus: ExternalOrderDispatchStatus;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  promoted: boolean;
  promotedOrderId: string | null;
  promotedAt: string | null;
  dispatchChecks: {
    deliveryOrderConfirmed: boolean;
    customerNamePresent: boolean;
    customerPhonePresent: boolean;
    deliveryAddressPresent: boolean;
    itemsPresent: boolean;
    notAlreadyAssigned: boolean;
  };
}

export interface ExternalOrderProviderSyncState {
  lastSuccessfulSyncAt: string | null;
  lastAttemptedSyncAt?: string | null;
  lastScanAt?: string | null;
  lastNewOrderImportedAt?: string | null;
  lastResult?: string | null;
  lastError: string | null;
  lastSyncSummary: {
    inserted: number;
    updated: number;
    deliveryOrdersFound: number;
    pagesScanned: number;
    unchanged?: number;
    invalid?: number;
    enrichmentErrors?: number;
    syncErrors?: number;
    needsReview?: number;
    readyToDispatch?: number;
  } | null;
}

export interface ExternalOrderScanStats {
  pagesScanned: number;
  totalOrdersSeen: number;
  deliveryOrdersFound: number;
  pickupOrdersIgnored: number;
  unknownOrdersIgnored: number;
}

export interface ExternalOrderSyncResult extends ExternalOrderScanStats {
  inserted: number;
  updated: number;
  total: number;
  unchangedOrders?: number;
  needsReview?: number;
  readyToDispatch?: number;
  invalidOrders?: number;
  enrichmentErrors?: number;
  syncErrors?: number;
  exclusionReasons?: Record<string, number>;
}

export interface LiveDeliveryScanResult {
  ok: boolean;
  mode: "live";
  orders: SafeExternalOrder[];
  intakeOrders: ExternalOrderIntakeRow[];
  pagesScanned: number;
  totalOrdersSeen: number;
  deliveryOrdersFound: number;
  pickupOrdersIgnored: number;
  unknownOrdersIgnored: number;
  pagesConfigured: number;
  itemsPerPage: number;
  locationId: string;
}

/** Safe provider config — never includes secrets. */
export interface ExternalOrderProviderConfig {
  mode: ExternalOrderProviderMode;
  apiBaseUrl: string | null;
  apiPathPrefix: string;
  locationId: string | null;
  /** Base live credentials present (API URL, key, pass). */
  configured: boolean;
  /** Base credentials plus EXTERNAL_ORDER_LOCATION_ID — required for order reads. */
  ordersConfigured: boolean;
  liveReadsEnabled: boolean;
  liveSyncEnabled: boolean;
  /** When false, synced external orders must not trigger customer SMS. */
  customerMessagingEnabled: boolean;
  hasOtp: boolean;
  hasWebhookSecret: boolean;
}

export interface ExternalOrderProviderHealth {
  ok: boolean;
  mode: ExternalOrderProviderMode;
  configured: boolean;
  ordersConfigured: boolean;
  liveReadsEnabled: boolean;
  liveSyncEnabled: boolean;
  /** True when mode is live, configured, but live reads flag is off. */
  readsDisabled: boolean;
}

export interface LiveOrderProviderHealth extends ExternalOrderProviderHealth {
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

export interface BarnetOrderDiagnostics {
  hasDeliveryAddress: boolean;
  hasDeliveryInstructions: boolean;
  hasItems: boolean;
  hasCustomerId: boolean;
  customerEnrichmentAvailable: boolean;
  hasCustomerName: boolean;
  hasCustomerPhone: boolean;
  hasCustomerEmail: boolean;
  dispatchReady: boolean;
  customerMessagingReady: boolean;
  customerEnrichmentStatus: CustomerEnrichmentStatus | null;
  missingFields: string[];
}

export interface LiveOrderDetailDiagnostics extends BarnetOrderDiagnostics {
  externalOrderId: string;
  externalOrderNumber: string | null;
  topLevelKeys: string[];
  possibleCustomerKeyPaths: string[];
  ignoredCustomerLikePaths: string[];
  hasUserIdCandidate: boolean;
  hasPhoneCandidate: boolean;
  hasUsableCustomerLink: boolean;
}

export interface LiveCustomerDetailResult {
  ok: boolean;
  mode: "live";
  diagnostics: {
    customerId: string;
    hasCustomerName: boolean;
    hasCustomerPhone: boolean;
    hasCustomerEmail: boolean;
    hasShippingAddress: boolean;
    topLevelKeys: string[];
  };
}

export interface LiveOrderDetailResult {
  ok: boolean;
  mode: "live";
  diagnostics: LiveOrderDetailDiagnostics;
}

/** API/UI-safe external order — no rawPayload or customer PII. */
export interface SafeExternalOrder {
  provider: string;
  externalOrderId: string;
  externalOrderNumber: string | null;
  status: string;
  deliveryStatus: string | null;
  isDelivery: boolean;
  total: number;
  placedAt: string;
  externalCustomerId: string | null;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  deliveryInstructions: string | null;
  itemsCount: number;
  customerMessagingReady: boolean;
  customerEnrichmentStatus: CustomerEnrichmentStatus | null;
  dispatchReady: boolean;
  createdAt: string;
  updatedAt: string;
  diagnostics: BarnetOrderDiagnostics;
}

export interface LiveOrderPreviewResult {
  ok: boolean;
  mode: "live";
  orders: SafeExternalOrder[];
  intakeOrders: ExternalOrderIntakeRow[];
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

/** Safe Barnet location fields returned by Discover Locations (no secrets). */
export interface SafeBarnetLocation {
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

export interface LiveLocationsResult {
  ok: boolean;
  locations: SafeBarnetLocation[];
  meta: BarnetLocationsMeta;
}
