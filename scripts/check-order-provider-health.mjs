#!/usr/bin/env node
/**
 * Validates external order provider env configuration without starting the dev server.
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

function validate() {
  const mode = emptyToUndefined(process.env.EXTERNAL_ORDER_PROVIDER_MODE) ?? "mock";

  if (mode !== "mock" && mode !== "live") {
    throw new Error(
      `EXTERNAL_ORDER_PROVIDER_MODE must be "mock" or "live" (got "${mode}")`,
    );
  }

  const liveRequired = [
    "EXTERNAL_ORDER_API_BASE_URL",
    "EXTERNAL_ORDER_API_KEY",
    "EXTERNAL_ORDER_API_PASS",
    "EXTERNAL_ORDER_LOCATION_ID",
  ];

  if (mode === "live") {
    const missing = liveRequired.filter((key) => !emptyToUndefined(process.env[key]));
    if (missing.length > 0) {
      throw new Error(
        `Mode is "live" but required env vars are missing: ${missing.join(", ")}`,
      );
    }
  }

  const configured =
    mode === "mock" ||
    liveRequired.every((key) => Boolean(emptyToUndefined(process.env[key])));

  return { ok: true, mode, configured };
}

loadEnvLocal();

try {
  const health = validate();
  console.log("✅ External order provider health check passed");
  console.log(JSON.stringify(health, null, 2));
  process.exit(0);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("❌ External order provider health check failed");
  console.error(message);
  process.exit(1);
}
