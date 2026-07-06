import { z } from "zod";
import type {
  ExternalOrderProviderConfig,
  ExternalOrderProviderMode,
} from "@/lib/integrations/order-provider/types";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

function parseBoolEnv(value: unknown, defaultValue = false): boolean {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parsePositiveIntEnv(value: unknown, defaultValue: number): number {
  if (value === undefined || value === null || value === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return defaultValue;
  return Math.floor(parsed);
}

const EnvSchema = z.object({
  EXTERNAL_ORDER_PROVIDER_MODE: z
    .enum(["mock", "live"])
    .optional()
    .default("mock"),
  EXTERNAL_ORDER_API_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  EXTERNAL_ORDER_API_PATH_PREFIX: z.preprocess(
    (value) => emptyToUndefined(value) ?? "/swagger",
    z.string().min(1),
  ),
  EXTERNAL_ORDER_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  EXTERNAL_ORDER_API_PASS: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  EXTERNAL_ORDER_LOCATION_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  EXTERNAL_ORDER_OTP: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  EXTERNAL_ORDER_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  EXTERNAL_ORDER_LIVE_READS_ENABLED: z.preprocess(
    (value) => parseBoolEnv(value, false),
    z.boolean(),
  ),
  EXTERNAL_ORDER_LIVE_SYNC_ENABLED: z.preprocess(
    (value) => parseBoolEnv(value, false),
    z.boolean(),
  ),
  EXTERNAL_ORDER_CUSTOMER_MESSAGING_ENABLED: z.preprocess(
    (value) => parseBoolEnv(value, false),
    z.boolean(),
  ),
  EXTERNAL_ORDER_SYNC_PAGES: z.preprocess(
    (value) => parsePositiveIntEnv(value, 5),
    z.number().int().min(1).max(10),
  ),
  EXTERNAL_ORDER_SYNC_ITEMS_PER_PAGE: z.preprocess(
    (value) => parsePositiveIntEnv(value, 20),
    z.number().int().min(1),
  ),
});

/** Base live credentials — required for GET /locations and live config. */
const LIVE_BASE_REQUIRED_KEYS = [
  "EXTERNAL_ORDER_API_BASE_URL",
  "EXTERNAL_ORDER_API_KEY",
  "EXTERNAL_ORDER_API_PASS",
] as const;

/** Orders live config — base credentials plus location ID for GET /orders. */
const LIVE_ORDERS_REQUIRED_KEYS = [
  ...LIVE_BASE_REQUIRED_KEYS,
  "EXTERNAL_ORDER_LOCATION_ID",
] as const;

function parseEnv() {
  return EnvSchema.parse({
    EXTERNAL_ORDER_PROVIDER_MODE: process.env.EXTERNAL_ORDER_PROVIDER_MODE,
    EXTERNAL_ORDER_API_BASE_URL: process.env.EXTERNAL_ORDER_API_BASE_URL,
    EXTERNAL_ORDER_API_PATH_PREFIX: process.env.EXTERNAL_ORDER_API_PATH_PREFIX,
    EXTERNAL_ORDER_API_KEY: process.env.EXTERNAL_ORDER_API_KEY,
    EXTERNAL_ORDER_API_PASS: process.env.EXTERNAL_ORDER_API_PASS,
    EXTERNAL_ORDER_LOCATION_ID: process.env.EXTERNAL_ORDER_LOCATION_ID,
    EXTERNAL_ORDER_OTP: process.env.EXTERNAL_ORDER_OTP,
    EXTERNAL_ORDER_WEBHOOK_SECRET: process.env.EXTERNAL_ORDER_WEBHOOK_SECRET,
    EXTERNAL_ORDER_LIVE_READS_ENABLED: process.env.EXTERNAL_ORDER_LIVE_READS_ENABLED,
    EXTERNAL_ORDER_LIVE_SYNC_ENABLED: process.env.EXTERNAL_ORDER_LIVE_SYNC_ENABLED,
    EXTERNAL_ORDER_CUSTOMER_MESSAGING_ENABLED:
      process.env.EXTERNAL_ORDER_CUSTOMER_MESSAGING_ENABLED,
    EXTERNAL_ORDER_SYNC_PAGES: process.env.EXTERNAL_ORDER_SYNC_PAGES,
    EXTERNAL_ORDER_SYNC_ITEMS_PER_PAGE: process.env.EXTERNAL_ORDER_SYNC_ITEMS_PER_PAGE,
  });
}

function assertLiveBaseEnvComplete(
  mode: ExternalOrderProviderMode,
  env: z.infer<typeof EnvSchema>,
): void {
  if (mode === "mock") return;

  const missing = LIVE_BASE_REQUIRED_KEYS.filter((key) => {
    const value = env[key];
    return typeof value !== "string" || value.length === 0;
  });

  if (missing.length > 0) {
    throw new Error(
      `External order provider mode is "${mode}" but required env vars are missing: ${missing.join(", ")}`,
    );
  }
}

function assertLiveOrdersEnvComplete(
  mode: ExternalOrderProviderMode,
  env: z.infer<typeof EnvSchema>,
): void {
  if (mode === "mock") return;

  assertLiveBaseEnvComplete(mode, env);

  const locationId = env.EXTERNAL_ORDER_LOCATION_ID;
  if (typeof locationId !== "string" || locationId.length === 0) {
    throw new Error(
      'External order provider mode is "live" but EXTERNAL_ORDER_LOCATION_ID is required for order reads',
    );
  }
}

/**
 * Returns safe provider config for server routes and UI.
 * Never includes API keys, passwords, OTPs, or webhook secrets.
 */
export function getExternalOrderProviderConfig(): ExternalOrderProviderConfig {
  const env = parseEnv();
  assertLiveBaseEnvComplete(env.EXTERNAL_ORDER_PROVIDER_MODE, env);

  const mode = env.EXTERNAL_ORDER_PROVIDER_MODE;

  return {
    mode,
    apiBaseUrl: env.EXTERNAL_ORDER_API_BASE_URL ?? null,
    apiPathPrefix: env.EXTERNAL_ORDER_API_PATH_PREFIX,
    locationId: env.EXTERNAL_ORDER_LOCATION_ID ?? null,
    configured:
      mode === "mock" ||
      LIVE_BASE_REQUIRED_KEYS.every((key) => Boolean(env[key])),
    ordersConfigured:
      mode === "mock" ||
      LIVE_ORDERS_REQUIRED_KEYS.every((key) => Boolean(env[key])),
    liveReadsEnabled: env.EXTERNAL_ORDER_LIVE_READS_ENABLED,
    liveSyncEnabled: env.EXTERNAL_ORDER_LIVE_SYNC_ENABLED,
    customerMessagingEnabled: env.EXTERNAL_ORDER_CUSTOMER_MESSAGING_ENABLED,
    hasOtp: Boolean(env.EXTERNAL_ORDER_OTP),
    hasWebhookSecret: Boolean(env.EXTERNAL_ORDER_WEBHOOK_SECRET),
  };
}

/**
 * Server-only secrets for live provider adapters.
 * Never log or return values from this function.
 */
export function getExternalOrderProviderSecrets(): {
  apiKey: string | null;
  apiPass: string | null;
  otp: string | null;
  webhookSecret: string | null;
} {
  const env = parseEnv();
  assertLiveBaseEnvComplete(env.EXTERNAL_ORDER_PROVIDER_MODE, env);

  return {
    apiKey: env.EXTERNAL_ORDER_API_KEY ?? null,
    apiPass: env.EXTERNAL_ORDER_API_PASS ?? null,
    otp: env.EXTERNAL_ORDER_OTP ?? null,
    webhookSecret: env.EXTERNAL_ORDER_WEBHOOK_SECRET ?? null,
  };
}

/** Gate: live mode + live reads flag must be enabled before any Barnet GET. */
export function assertLiveReadsAllowed(): void {
  const config = getExternalOrderProviderConfig();
  if (config.mode !== "live") {
    throw new Error(
      "Live reads require EXTERNAL_ORDER_PROVIDER_MODE=live (mock mode is active)",
    );
  }
  if (!config.configured) {
    throw new Error("Live provider is not fully configured");
  }
  if (!config.liveReadsEnabled) {
    throw new Error(
      "Live reads are disabled (set EXTERNAL_ORDER_LIVE_READS_ENABLED=true)",
    );
  }
}

/** Gate: location ID required before Barnet order GETs, preview, or sync. */
export function assertLiveOrdersReadsAllowed(): void {
  assertLiveReadsAllowed();
  const env = parseEnv();
  assertLiveOrdersEnvComplete(env.EXTERNAL_ORDER_PROVIDER_MODE, env);
}

/** Gate: live sync flag must be enabled before writing Barnet data to Firestore. */
export function assertLiveSyncAllowed(): void {
  assertLiveOrdersReadsAllowed();
  const config = getExternalOrderProviderConfig();
  if (!config.liveSyncEnabled) {
    throw new Error(
      "Live sync is disabled (set EXTERNAL_ORDER_LIVE_SYNC_ENABLED=true)",
    );
  }
}
