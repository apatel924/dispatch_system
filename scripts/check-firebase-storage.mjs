#!/usr/bin/env node
/**
 * Dev-only Firebase Admin Storage diagnostic.
 * Verifies Admin init, project/bucket presence, and bucket metadata reachability.
 * Never prints credentials, private keys, or uploads customer proof data.
 *
 * Usage: node scripts/check-firebase-storage.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = {
  ...loadEnvFile(resolve(root, ".env.example")),
  ...loadEnvFile(resolve(root, ".env.local")),
  ...process.env,
};

const projectId = String(env.FIREBASE_PROJECT_ID ?? "").trim();
const clientEmail = String(env.FIREBASE_CLIENT_EMAIL ?? "").trim();
const privateKeyRaw = String(env.FIREBASE_PRIVATE_KEY ?? "");
const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
const bucketName = String(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "").trim();
const clientProjectId = String(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "").trim();

const emailProject =
  clientEmail.match(/@([^.]+)\.iam\.gserviceaccount\.com$/)?.[1] ?? null;

const report = {
  adminConfigured: Boolean(projectId && clientEmail && privateKey),
  projectIdPresent: Boolean(projectId),
  clientProjectIdPresent: Boolean(clientProjectId),
  projectsAligned: Boolean(projectId && clientProjectId && projectId === clientProjectId),
  clientEmailPresent: Boolean(clientEmail),
  emailMatchesProject: Boolean(projectId && emailProject && emailProject === projectId),
  privateKeyParses: Boolean(
    privateKey.includes("BEGIN PRIVATE KEY") && privateKey.includes("END PRIVATE KEY"),
  ),
  bucketNamePresent: Boolean(bucketName),
  bucketLooksLikeGsUrl: bucketName.startsWith("gs://"),
  bucketLooksLikeAppspot: bucketName.endsWith(".appspot.com"),
  bucketLooksLikeFirebasestorage: bucketName.endsWith(".firebasestorage.app"),
  bucketContainsProjectId: Boolean(projectId && bucketName.includes(projectId)),
  adminInitialized: false,
  bucketResolved: false,
  bucketExists: false,
  errorCode: undefined,
  errorStatus: undefined,
  errorKind: undefined,
  guidance: [],
};

function classify(err) {
  const code = err?.code ?? err?.error?.code;
  const status = err?.status ?? err?.statusCode ?? err?.error?.status;
  const message = typeof err?.message === "string" ? err.message.toLowerCase() : "";
  if (status === 404 || code === 404 || message.includes("bucket does not exist")) {
    return "bucket_not_found";
  }
  if (status === 403 || code === 403 || message.includes("permission") || message.includes("billing")) {
    return "permission_or_billing";
  }
  if (status === 401 || message.includes("invalid_grant") || message.includes("credential")) {
    return "invalid_credentials";
  }
  return "unknown";
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_STORAGE_DIAG !== "1") {
    console.error("Refusing to run storage diagnostic in production without ALLOW_STORAGE_DIAG=1");
    process.exit(2);
  }

  if (!report.adminConfigured || !report.bucketNamePresent) {
    report.guidance.push("Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in .env.local.");
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  for (const app of getApps()) {
    await deleteApp(app);
  }

  try {
    const app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: bucketName,
    });
    report.adminInitialized = true;
    const bucket = getStorage(app).bucket(bucketName);
    report.bucketResolved = Boolean(bucket?.name);
    try {
      const [meta] = await bucket.getMetadata();
      report.bucketExists = Boolean(meta?.name);
    } catch (err) {
      report.errorCode = err?.code ?? err?.error?.code;
      report.errorStatus = err?.status ?? err?.statusCode ?? err?.error?.status;
      report.errorKind = classify(err);
      if (report.errorKind === "bucket_not_found") {
        report.guidance.push(
          "Configured bucket was not found. Enable Firebase Storage in the Firebase console (requires a billing account) so the default bucket is created.",
        );
      } else if (report.errorKind === "permission_or_billing") {
        report.guidance.push(
          "Service account cannot access or create Storage. Enable billing on the Firebase/GCP project and grant the service account Storage Object Admin (or equivalent).",
        );
      } else if (report.errorKind === "invalid_credentials") {
        report.guidance.push("Firebase Admin credentials failed to authenticate. Re-download the service account key for this project.");
      }
    }
    await deleteApp(app);
  } catch (err) {
    report.errorCode = err?.code ?? "init_failed";
    report.errorKind = classify(err);
    report.guidance.push("Firebase Admin failed to initialize. Check FIREBASE_* values and restart the Next.js server.");
  }

  if (report.bucketExists) {
    report.guidance.push("Storage bucket is reachable. Proof uploads should be able to call file.save.");
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.bucketExists ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, errorKind: classify(err) }));
  process.exit(1);
});
