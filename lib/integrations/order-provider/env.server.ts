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

const EnvSchema = z.object({
  EXTERNAL_ORDER_PROVIDER_MODE: z
    .enum(["mock", "live"])
    .optional()
    .default("mock"),
  EXTERNAL_ORDER_API_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  EXTERNAL_ORDER_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  EXTERNAL_ORDER_API_PASS: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  EXTERNAL_ORDER_LOCATION_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  EXTERNAL_ORDER_OTP: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  EXTERNAL_ORDER_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
});

const LIVE_REQUIRED_KEYS = [
  "EXTERNAL_ORDER_API_BASE_URL",
  "EXTERNAL_ORDER_API_KEY",
  "EXTERNAL_ORDER_API_PASS",
  "EXTERNAL_ORDER_LOCATION_ID",
] as const;

function parseEnv() {
  return EnvSchema.parse({
    EXTERNAL_ORDER_PROVIDER_MODE: process.env.EXTERNAL_ORDER_PROVIDER_MODE,
    EXTERNAL_ORDER_API_BASE_URL: process.env.EXTERNAL_ORDER_API_BASE_URL,
    EXTERNAL_ORDER_API_KEY: process.env.EXTERNAL_ORDER_API_KEY,
    EXTERNAL_ORDER_API_PASS: process.env.EXTERNAL_ORDER_API_PASS,
    EXTERNAL_ORDER_LOCATION_ID: process.env.EXTERNAL_ORDER_LOCATION_ID,
    EXTERNAL_ORDER_OTP: process.env.EXTERNAL_ORDER_OTP,
    EXTERNAL_ORDER_WEBHOOK_SECRET: process.env.EXTERNAL_ORDER_WEBHOOK_SECRET,
  });
}

function assertLiveEnvComplete(
  mode: ExternalOrderProviderMode,
  env: z.infer<typeof EnvSchema>,
): void {
  if (mode === "mock") return;

  const missing = LIVE_REQUIRED_KEYS.filter((key) => {
    const value = env[key];
    return typeof value !== "string" || value.length === 0;
  });

  if (missing.length > 0) {
    throw new Error(
      `External order provider mode is "${mode}" but required env vars are missing: ${missing.join(", ")}`,
    );
  }
}

/**
 * Returns safe provider config for server routes and UI.
 * Never includes API keys, passwords, OTPs, or webhook secrets.
 */
export function getExternalOrderProviderConfig(): ExternalOrderProviderConfig {
  const env = parseEnv();
  assertLiveEnvComplete(env.EXTERNAL_ORDER_PROVIDER_MODE, env);

  const mode = env.EXTERNAL_ORDER_PROVIDER_MODE;

  return {
    mode,
    apiBaseUrl: env.EXTERNAL_ORDER_API_BASE_URL ?? null,
    locationId: env.EXTERNAL_ORDER_LOCATION_ID ?? null,
    configured: mode === "mock" || LIVE_REQUIRED_KEYS.every((key) => Boolean(env[key])),
  };
}

/**
 * Server-only secrets for future live provider adapters.
 * Never log or return values from this function.
 */
export function getExternalOrderProviderSecrets(): {
  apiKey: string | null;
  apiPass: string | null;
  otp: string | null;
  webhookSecret: string | null;
} {
  const env = parseEnv();
  assertLiveEnvComplete(env.EXTERNAL_ORDER_PROVIDER_MODE, env);

  return {
    apiKey: env.EXTERNAL_ORDER_API_KEY ?? null,
    apiPass: env.EXTERNAL_ORDER_API_PASS ?? null,
    otp: env.EXTERNAL_ORDER_OTP ?? null,
    webhookSecret: env.EXTERNAL_ORDER_WEBHOOK_SECRET ?? null,
  };
}
