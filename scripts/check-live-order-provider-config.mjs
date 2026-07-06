#!/usr/bin/env node
/**
 * Validates external order provider live env configuration without calling live APIs.
 * Loads .env.local from the project root when present.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.warn("⚠️  No .env.local found — using process environment only.\n");
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function emptyToUndefined(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBoolEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function validate() {
  const mode = emptyToUndefined(process.env.EXTERNAL_ORDER_PROVIDER_MODE) ?? "mock";

  if (mode !== "mock" && mode !== "live") {
    throw new Error(
      `EXTERNAL_ORDER_PROVIDER_MODE must be "mock" or "live" (got "${mode}")`,
    );
  }

  const liveBaseRequired = [
    "EXTERNAL_ORDER_API_BASE_URL",
    "EXTERNAL_ORDER_API_KEY",
    "EXTERNAL_ORDER_API_PASS",
  ];

  const liveOrdersRequired = [
    ...liveBaseRequired,
    "EXTERNAL_ORDER_LOCATION_ID",
  ];

  if (mode === "live") {
    const missing = liveBaseRequired.filter((key) => !emptyToUndefined(process.env[key]));
    if (missing.length > 0) {
      throw new Error(
        `Mode is "live" but required env vars are missing: ${missing.join(", ")}`,
      );
    }
  }

  const configured =
    mode === "mock" ||
    liveBaseRequired.every((key) => Boolean(emptyToUndefined(process.env[key])));

  const ordersConfigured =
    mode === "mock" ||
    liveOrdersRequired.every((key) => Boolean(emptyToUndefined(process.env[key])));

  const liveReadsEnabled = parseBoolEnv(process.env.EXTERNAL_ORDER_LIVE_READS_ENABLED, false);
  const liveSyncEnabled = parseBoolEnv(process.env.EXTERNAL_ORDER_LIVE_SYNC_ENABLED, false);
  const apiPathPrefix =
    emptyToUndefined(process.env.EXTERNAL_ORDER_API_PATH_PREFIX) ?? "/swagger";

  return {
    ok: true,
    mode,
    configured,
    ordersConfigured,
    apiPathPrefix,
    locationId: emptyToUndefined(process.env.EXTERNAL_ORDER_LOCATION_ID) ?? null,
    liveReadsEnabled,
    liveSyncEnabled,
    readsDisabled: mode === "live" && configured && !liveReadsEnabled,
    hasOtp: Boolean(emptyToUndefined(process.env.EXTERNAL_ORDER_OTP)),
    hasWebhookSecret: Boolean(emptyToUndefined(process.env.EXTERNAL_ORDER_WEBHOOK_SECRET)),
    liveApiCallsAllowed: mode === "live" && configured && liveReadsEnabled,
    liveOrdersAllowed: mode === "live" && ordersConfigured && liveReadsEnabled,
    liveSyncAllowed: mode === "live" && ordersConfigured && liveReadsEnabled && liveSyncEnabled,
  };
}

loadEnvLocal();

try {
  const status = validate();
  console.log("✅ External order provider live config validation passed (no API calls made)");
  console.log(JSON.stringify(status, null, 2));
  process.exit(0);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("❌ External order provider live config validation failed");
  console.error(message);
  process.exit(1);
}
