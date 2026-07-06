export type ExternalOrderProviderMode = "mock" | "live";

export interface ExternalProviderOrderItem {
  name: string;
  quantity: number;
  unitPrice: number | null;
  notes: string | null;
}

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

/** Normalized internal order shape stored in Firestore. */
export interface NormalizedExternalOrder {
  provider: string;
  externalOrderId: string;
  externalOrderNumber: string | null;
  status: string;
  deliveryStatus: string | null;
  isDelivery: boolean;
  total: number;
  placedAt: string;
  customerName: string | null;
  customerPhone: string | null;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  deliveryInstructions: string | null;
  items: ExternalProviderOrderItem[];
  rawPayload: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalOrderSyncResult {
  inserted: number;
  updated: number;
  total: number;
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

export interface LiveOrderPreviewResult {
  ok: boolean;
  mode: "live";
  orders: NormalizedExternalOrder[];
  total: number;
  page: number;
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
