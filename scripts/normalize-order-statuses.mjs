/**
 * Dry-run / optional write migration: normalize legacy order status strings.
 *
 * Usage:
 *   node scripts/normalize-order-statuses.mjs           # dry-run (default)
 *   node scripts/normalize-order-statuses.mjs --write   # apply updates
 *
 * Does not run in production automatically. Admin must invoke intentionally.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const ALIASES = {
  "En Route": "Out for Delivery",
  "en route": "Out for Delivery",
  enroute: "Out for Delivery",
  "out for delivery": "Out for Delivery",
  "picked up": "Picked Up",
};

const CANONICAL = new Set([
  "New",
  "Scheduled",
  "Assigned",
  "Picked Up",
  "Out for Delivery",
  "Delivered",
  "Failed",
  "Returned",
]);

function normalize(raw) {
  if (raw == null || typeof raw !== "string") return { status: null, reason: "missing" };
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (CANONICAL.has(trimmed)) return { status: trimmed, reason: "already_canonical" };
  if (ALIASES[trimmed]) return { status: ALIASES[trimmed], reason: "alias" };
  if (ALIASES[trimmed.toLowerCase()]) {
    return { status: ALIASES[trimmed.toLowerCase()], reason: "alias_case" };
  }
  return { status: null, reason: "unknown", raw: trimmed };
}

async function main() {
  const write = process.argv.includes("--write");
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  if (!getApps().length) {
    // Prefer the same Admin env names as the Next.js server (`FIREBASE_*`).
    // Accept legacy `FIREBASE_ADMIN_*` aliases if present.
    const projectId =
      process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail =
      process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = (
      process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY
    )?.replace(/\\n/g, "\n");
    if (!projectId || !clientEmail || !privateKey) {
      console.error(
        "Missing Firebase admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY (same as the app).",
      );
      process.exit(1);
    }
    console.log(
      JSON.stringify({
        projectId,
        mode: write ? "write" : "dry-run",
        warning:
          "Back up / export the orders collection before --write. Unknown statuses are never rewritten.",
      }),
    );
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  const db = getFirestore();
  const snap = await db.collection("orders").get();

  const counts = {
    scanned: 0,
    alreadyCanonical: 0,
    wouldUpdate: 0,
    unknown: 0,
    updated: 0,
  };
  const samples = [];

  for (const doc of snap.docs) {
    counts.scanned += 1;
    const raw = doc.data().status;
    const result = normalize(raw);
    if (result.reason === "already_canonical") {
      counts.alreadyCanonical += 1;
      continue;
    }
    if (result.reason === "unknown" || !result.status) {
      counts.unknown += 1;
      if (samples.length < 20) samples.push({ id: doc.id, raw });
      continue;
    }
    counts.wouldUpdate += 1;
    if (samples.length < 20) {
      samples.push({ id: doc.id, from: raw, to: result.status, reason: result.reason });
    }
    if (write) {
      await doc.ref.update({
        status: result.status,
        updatedAt: new Date().toISOString(),
        statusNormalizedAt: new Date().toISOString(),
      });
      counts.updated += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: write ? "write" : "dry-run",
        counts,
        samples,
        note: write
          ? "Updates applied. Review unknown samples manually."
          : "No writes performed. Re-run with --write to apply alias normalizations.",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
