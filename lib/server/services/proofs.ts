import type { ProofAsset, ProofType } from "@/lib/types/backend";
import type { AuthUser } from "@/lib/server/auth";
import { conflictError, notFoundError, rateLimitedError, ServiceError } from "@/lib/server/errors";
import { orderProofsCollection } from "@/lib/server/firestore/collections";
import { docToProof, nowIso } from "@/lib/server/firestore/helpers";
import { getAdminFirestore, getAdminStorage } from "@/lib/server/firebase-admin";
import {
  getFirebaseStorageBucketName,
  isFirebaseStorageConfigured,
} from "@/lib/server/env";
import {
  DEFAULT_PROOF_SIGNED_URL_TTL_MS,
  proofDuplicateWindowMs,
  proofRateLimitPerDriverPerHour,
  proofRateLimitPerOrderPerMinute,
} from "@/lib/server/proof-limits";
import { validateAndDecodeProofDataUrl } from "@/lib/server/proof-validation";
import { checkRateLimitAsync, hashRateLimitComponent } from "@/lib/server/rate-limit";
import { writeAuditLog } from "@/lib/server/services/audit";
import {
  addStatusEvent,
  getOrderById,
  updateOrder,
} from "@/lib/server/services/orders";
import type { ReviewProofInput, UploadProofInput } from "@/lib/server/validation/proofs";

export type ProofUploadStage =
  | "request_parsing"
  | "authentication"
  | "authorization"
  | "validation"
  | "decode"
  | "storage_config"
  | "storage_upload"
  | "firestore_proof"
  | "order_steps"
  | "rollback";

export function proofSignedUrlTtlMs(): number {
  const parsed = Number.parseInt(process.env.PROOF_SIGNED_URL_TTL_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PROOF_SIGNED_URL_TTL_MS;
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "bin";
}

/** @deprecated Use validateAndDecodeProofDataUrl for production paths. */
export function decodeProofDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] ?? "application/octet-stream";
  return { buffer: Buffer.from(base64, "base64"), mimeType };
}

/** Deterministic proof document id — one active record per proof type per order. */
export function proofDocumentIdForType(proofType: ProofType): string {
  return proofType;
}

export function buildProofStoragePath(orderId: string, proofType: ProofType, ext: string): string {
  return `orders/${orderId}/proofs/${proofType}-${Date.now()}.${ext}`;
}

export async function deleteProofFile(storagePath: string): Promise<void> {
  const bucket = getAdminStorage().bucket();
  await bucket.file(storagePath).delete({ ignoreNotFound: true });
}

function safeFirebaseCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" || typeof code === "number") return String(code);
  const errors = (err as { errors?: Array<{ reason?: unknown }> }).errors;
  if (Array.isArray(errors) && errors[0]?.reason != null) {
    return String(errors[0].reason);
  }
  return undefined;
}

function safeHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const status = (err as { status?: unknown; statusCode?: unknown }).status
    ?? (err as { statusCode?: unknown }).statusCode
    ?? (err as { error?: { status?: unknown } }).error?.status;
  if (typeof status === "number") return status;
  if (typeof status === "string" && /^\d+$/.test(status)) return Number(status);
  const code = safeFirebaseCode(err);
  if (code === "404" || code === "403" || code === "401" || code === "429" || code === "500" || code === "503") {
    return Number(code);
  }
  return undefined;
}

function storageFailureKind(
  err: unknown,
): "bucket_missing" | "bucket_not_found" | "permission_denied" | "invalid_credentials" | "transient" {
  if (!isFirebaseStorageConfigured()) return "bucket_missing";
  const code = (safeFirebaseCode(err) ?? "").toLowerCase();
  const status = safeHttpStatus(err);
  const message = err instanceof Error ? err.message.toLowerCase() : "";

  if (
    status === 404 ||
    code === "404" ||
    message.includes("bucket does not exist") ||
    message.includes("notfound") ||
    code.includes("notfound")
  ) {
    return "bucket_not_found";
  }
  if (
    status === 401 ||
    code === "401" ||
    message.includes("invalid_grant") ||
    message.includes("invalid credentials") ||
    message.includes("unauthenticated")
  ) {
    return "invalid_credentials";
  }
  if (
    status === 403 ||
    code === "403" ||
    message.includes("permission") ||
    message.includes("forbidden") ||
    message.includes("access denied")
  ) {
    return "permission_denied";
  }
  return "transient";
}

function logProofDiagnostic(fields: {
  stage: ProofUploadStage;
  orderId?: string;
  driverId?: string;
  proofType?: ProofType;
  stepKey?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  durationMs?: number;
  firebaseCode?: string;
  httpStatus?: number;
  bucketResolved?: boolean;
  cleanupAttempted?: boolean;
  cleanupSucceeded?: boolean;
  message?: string;
}): void {
  console.info(
    "[proof]",
    JSON.stringify({
      ...fields,
      // Never log data URLs, tokens, addresses, or raw payload contents.
    }),
  );
}

function userFacingUploadError(proofType: ProofType): string {
  if (proofType === "signature") {
    return "The signature could not be uploaded. Your captured signature has been kept so you can retry.";
  }
  return "The photo could not be uploaded. Your captured photo has been kept so you can retry.";
}

function mapStorageFailure(err: unknown, _proofType: ProofType): ServiceError {
  if (err instanceof ServiceError) return err;
  const kind = storageFailureKind(err);
  if (kind === "bucket_missing" || kind === "bucket_not_found") {
    return new ServiceError(
      "Proof storage is temporarily unavailable. Please retry.",
      "STORAGE_NOT_CONFIGURED",
      503,
    );
  }
  if (kind === "invalid_credentials" || kind === "permission_denied") {
    return new ServiceError(
      "Proof storage is temporarily unavailable. Please retry.",
      "STORAGE_UNAVAILABLE",
      503,
    );
  }
  return new ServiceError(
    "Proof storage is temporarily unavailable. Please retry.",
    "STORAGE_UNAVAILABLE",
    503,
  );
}

function assertStorageConfigured(orderId: string, proofType: ProofType, driverId: string): void {
  if (!isFirebaseStorageConfigured()) {
    logProofDiagnostic({
      stage: "storage_config",
      orderId,
      driverId,
      proofType,
      message: "storage_bucket_missing",
    });
    throw new ServiceError(
      "Proof storage is temporarily unavailable. Please retry.",
      "STORAGE_NOT_CONFIGURED",
      503,
    );
  }
  // Touch bucket accessor so misconfigured Admin init fails here with a staged error.
  try {
    getAdminStorage().bucket(getFirebaseStorageBucketName());
  } catch (err) {
    logProofDiagnostic({
      stage: "storage_config",
      orderId,
      driverId,
      proofType,
      firebaseCode: safeFirebaseCode(err),
      message: "storage_init_failed",
    });
    throw new ServiceError(
      "Proof storage is temporarily unavailable. Please retry.",
      "STORAGE_NOT_CONFIGURED",
      503,
    );
  }
}

export async function uploadProofFile(
  orderId: string,
  proofType: ProofType,
  dataUrl: string,
  options?: { driverId?: string },
): Promise<{ storagePath: string; mimeType: string; fileSizeBytes: number }> {
  const started = Date.now();
  let validated;
  try {
    validated = validateAndDecodeProofDataUrl(dataUrl, proofType);
  } catch (err) {
    logProofDiagnostic({
      stage: err instanceof ServiceError && err.code === "PAYLOAD_TOO_LARGE" ? "validation" : "decode",
      orderId,
      driverId: options?.driverId,
      proofType,
      durationMs: Date.now() - started,
      firebaseCode: safeFirebaseCode(err),
    });
    throw err;
  }

  assertStorageConfigured(orderId, proofType, options?.driverId ?? "");

  const storagePath = buildProofStoragePath(orderId, proofType, extensionForMime(validated.detectedMime));
  const bucketName = getFirebaseStorageBucketName();
  const bucket = getAdminStorage().bucket(bucketName);
  const file = bucket.file(storagePath);

  try {
    await file.save(validated.buffer, {
      contentType: validated.detectedMime,
      resumable: false,
      metadata: { metadata: { orderId, proofType } },
    });
  } catch (err) {
    const kind = storageFailureKind(err);
    logProofDiagnostic({
      stage: "storage_upload",
      orderId,
      driverId: options?.driverId,
      proofType,
      mimeType: validated.detectedMime,
      fileSizeBytes: validated.buffer.length,
      durationMs: Date.now() - started,
      firebaseCode: safeFirebaseCode(err),
      httpStatus: safeHttpStatus(err),
      bucketResolved: Boolean(bucketName),
      message: kind,
    });
    throw mapStorageFailure(err, proofType);
  }

  logProofDiagnostic({
    stage: "storage_upload",
    orderId,
    driverId: options?.driverId,
    proofType,
    mimeType: validated.detectedMime,
    fileSizeBytes: validated.buffer.length,
    durationMs: Date.now() - started,
    message: "upload_ok",
  });

  return {
    storagePath,
    mimeType: validated.detectedMime,
    fileSizeBytes: validated.buffer.length,
  };
}

async function assertProofUploadAllowed(
  orderId: string,
  proofType: ProofType,
  driverId: string,
): Promise<void> {
  const driverLimit = await checkRateLimitAsync({
    key: `proof:driver:${hashRateLimitComponent(driverId)}`,
    limit: proofRateLimitPerDriverPerHour(),
    windowMs: 60 * 60 * 1000,
  });
  if (!driverLimit.allowed) {
    throw rateLimitedError("Too many proof uploads. Please wait before trying again.");
  }

  const orderLimit = await checkRateLimitAsync({
    key: `proof:order:${hashRateLimitComponent(orderId)}`,
    limit: proofRateLimitPerOrderPerMinute(),
    windowMs: 60 * 1000,
  });
  if (!orderLimit.allowed) {
    throw rateLimitedError("Too many proof uploads for this order. Please wait a moment.");
  }

  const duplicateWindow = proofDuplicateWindowMs();
  const typeLimit = await checkRateLimitAsync({
    key: `proof:order:${hashRateLimitComponent(orderId)}:${proofType}`,
    limit: 1,
    windowMs: duplicateWindow,
  });
  if (!typeLimit.allowed) {
    throw conflictError(
      `A ${proofType} upload is already in progress or was just submitted. Please wait.`,
    );
  }
}

async function listProofDocs(orderId: string): Promise<ProofAsset[]> {
  const db = getAdminFirestore();
  const snap = await orderProofsCollection(db, orderId).get();
  return snap.docs.map((doc) => docToProof(doc.id, doc.data()));
}

export async function findProofByType(
  orderId: string,
  proofType: ProofType,
): Promise<ProofAsset | null> {
  const db = getAdminFirestore();
  const snap = await orderProofsCollection(db, orderId).doc(proofDocumentIdForType(proofType)).get();
  if (snap.exists) {
    return docToProof(snap.id, snap.data()!);
  }

  // Legacy docs used auto-ids — fall back to a type scan once.
  const all = await listProofDocs(orderId);
  const match = all.find((p) => p.type === proofType && p.storagePath);
  return match ?? null;
}

export async function listProofs(orderId: string): Promise<ProofAsset[]> {
  await getOrderById(orderId);
  const db = getAdminFirestore();
  const snap = await orderProofsCollection(db, orderId)
    .orderBy("uploadedAt", "asc")
    .get();

  const proofs = snap.docs.map((doc) => docToProof(doc.id, doc.data()));
  return Promise.all(proofs.map((p) => attachSignedUrl(p)));
}

export async function getProof(orderId: string, proofId: string): Promise<ProofAsset> {
  const db = getAdminFirestore();
  const snap = await orderProofsCollection(db, orderId).doc(proofId).get();
  if (!snap.exists) throw notFoundError("Proof", proofId);
  return attachSignedUrl(docToProof(snap.id, snap.data()!));
}

async function attachSignedUrl(proof: ProofAsset): Promise<ProofAsset> {
  if (!proof.storagePath) return proof;
  try {
    const downloadUrl = await getSignedDownloadUrl(proof.storagePath);
    return { ...proof, downloadUrl };
  } catch {
    return proof;
  }
}

async function ensureCompletedStep(
  orderId: string,
  stepKey: UploadProofInput["stepKey"],
  actor: AuthUser,
  existingSteps: UploadProofInput["stepKey"][],
): Promise<void> {
  if (existingSteps.includes(stepKey)) return;
  await updateOrder(orderId, { completedSteps: [...existingSteps, stepKey] }, actor);
}

export async function createProof(
  orderId: string,
  input: UploadProofInput,
  actor: AuthUser,
  driverId: string,
): Promise<ProofAsset> {
  const started = Date.now();
  const order = await getOrderById(orderId);

  const existing = await findProofByType(orderId, input.type);
  if (existing?.storagePath) {
    try {
      await ensureCompletedStep(orderId, input.stepKey, actor, order.completedSteps);
    } catch (err) {
      logProofDiagnostic({
        stage: "order_steps",
        orderId,
        driverId,
        proofType: input.type,
        stepKey: input.stepKey,
        durationMs: Date.now() - started,
        firebaseCode: safeFirebaseCode(err),
        message: "idempotent_step_update_failed",
      });
      throw new ServiceError(
        userFacingUploadError(input.type),
        "PROOF_STEP_UPDATE_FAILED",
        503,
      );
    }
    logProofDiagnostic({
      stage: "firestore_proof",
      orderId,
      driverId,
      proofType: input.type,
      stepKey: input.stepKey,
      durationMs: Date.now() - started,
      message: "idempotent_hit",
    });
    return attachSignedUrl(existing);
  }

  await assertProofUploadAllowed(orderId, input.type, driverId);

  let storagePath: string | undefined;
  let uploaded: { storagePath: string; mimeType: string; fileSizeBytes: number };

  try {
    uploaded = await uploadProofFile(orderId, input.type, input.dataUrl, { driverId });
    storagePath = uploaded.storagePath;
  } catch (err) {
    if (err instanceof ServiceError) throw err;
    throw mapStorageFailure(err, input.type);
  }

  const db = getAdminFirestore();
  const ref = orderProofsCollection(db, orderId).doc(proofDocumentIdForType(input.type));
  const uploadedAt = nowIso();

  const proof: Omit<ProofAsset, "id"> = {
    orderId,
    type: input.type,
    stepKey: input.stepKey,
    storagePath: uploaded.storagePath,
    mimeType: uploaded.mimeType,
    fileSizeBytes: uploaded.fileSizeBytes,
    uploadedBy: actor.uid,
    uploadedAt,
    reviewStatus: "pending",
  };

  try {
    await ref.set(proof);
    logProofDiagnostic({
      stage: "firestore_proof",
      orderId,
      driverId,
      proofType: input.type,
      stepKey: input.stepKey,
      mimeType: uploaded.mimeType,
      fileSizeBytes: uploaded.fileSizeBytes,
      durationMs: Date.now() - started,
      message: "proof_doc_ok",
    });
  } catch (err) {
    let cleanupSucceeded = false;
    let cleanupAttempted = false;
    if (storagePath) {
      cleanupAttempted = true;
      try {
        await deleteProofFile(storagePath);
        cleanupSucceeded = true;
      } catch (cleanupErr) {
        logProofDiagnostic({
          stage: "rollback",
          orderId,
          driverId,
          proofType: input.type,
          stepKey: input.stepKey,
          firebaseCode: safeFirebaseCode(cleanupErr),
          cleanupAttempted: true,
          cleanupSucceeded: false,
        });
      }
    }
    logProofDiagnostic({
      stage: "firestore_proof",
      orderId,
      driverId,
      proofType: input.type,
      stepKey: input.stepKey,
      mimeType: uploaded.mimeType,
      fileSizeBytes: uploaded.fileSizeBytes,
      durationMs: Date.now() - started,
      firebaseCode: safeFirebaseCode(err),
      cleanupAttempted,
      cleanupSucceeded,
    });
    throw new ServiceError(userFacingUploadError(input.type), "PROOF_PERSIST_FAILED", 503);
  }

  try {
    const completedSteps = order.completedSteps.includes(input.stepKey)
      ? order.completedSteps
      : [...order.completedSteps, input.stepKey];

    await updateOrder(orderId, { completedSteps }, actor);
    await addStatusEvent(orderId, order.status, actor, {
      stepKey: input.stepKey,
      note: `Proof uploaded: ${input.type}`,
    });

    await writeAuditLog({
      action: "proof.upload",
      entityType: "proof",
      entityId: ref.id,
      actorId: actor.uid,
      actorRole: actor.role,
      metadata: { orderId, type: input.type },
    });
  } catch (err) {
    // Proof document + Storage object are valid; do not roll them back.
    // Retry is idempotent via findProofByType and will finish the step update.
    logProofDiagnostic({
      stage: "order_steps",
      orderId,
      driverId,
      proofType: input.type,
      stepKey: input.stepKey,
      durationMs: Date.now() - started,
      firebaseCode: safeFirebaseCode(err),
      message: "proof_saved_step_pending",
    });
    throw new ServiceError(
      userFacingUploadError(input.type),
      "PROOF_STEP_UPDATE_FAILED",
      503,
    );
  }

  return attachSignedUrl({ id: ref.id, ...proof });
}

export async function reviewProof(
  orderId: string,
  proofId: string,
  input: ReviewProofInput,
  actor: AuthUser,
): Promise<ProofAsset> {
  const db = getAdminFirestore();
  const ref = orderProofsCollection(db, orderId).doc(proofId);
  const snap = await ref.get();
  if (!snap.exists) throw notFoundError("Proof", proofId);

  const reviewedAt = nowIso();
  await ref.update({
    reviewStatus: input.status,
    reviewNote: input.reviewNote,
    reviewedBy: actor.uid,
    reviewedAt,
  });

  await writeAuditLog({
    action: "proof.review",
    entityType: "proof",
    entityId: proofId,
    actorId: actor.uid,
    actorRole: actor.role,
    metadata: { orderId, status: input.status },
  });

  return getProof(orderId, proofId);
}

export async function getSignedDownloadUrl(
  storagePath: string,
  expiresInMs = proofSignedUrlTtlMs(),
): Promise<string> {
  const bucket = getAdminStorage().bucket(getFirebaseStorageBucketName());
  const file = bucket.file(storagePath);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresInMs,
    version: "v4",
  });
  return url;
}
