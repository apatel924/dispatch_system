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
  configured: boolean;
  liveReadsEnabled: boolean;
  liveSyncEnabled: boolean;
  hasOtp: boolean;
  hasWebhookSecret: boolean;
}

export interface ExternalOrderProviderHealth {
  ok: boolean;
  mode: ExternalOrderProviderMode;
  configured: boolean;
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
