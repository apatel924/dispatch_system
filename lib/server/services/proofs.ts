import type { ProofAsset, ProofType } from "@/lib/types/backend";
import type { AuthUser } from "@/lib/server/auth";
import { conflictError, notFoundError, rateLimitedError } from "@/lib/server/errors";
import { orderProofsCollection } from "@/lib/server/firestore/collections";
import { docToProof, nowIso } from "@/lib/server/firestore/helpers";
import { getAdminFirestore, getAdminStorage } from "@/lib/server/firebase-admin";
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

export function buildProofStoragePath(orderId: string, proofType: ProofType, ext: string): string {
  return `orders/${orderId}/proofs/${proofType}-${Date.now()}.${ext}`;
}

export async function deleteProofFile(storagePath: string): Promise<void> {
  const bucket = getAdminStorage().bucket();
  await bucket.file(storagePath).delete({ ignoreNotFound: true });
}

export async function uploadProofFile(
  orderId: string,
  proofType: ProofType,
  dataUrl: string,
): Promise<{ storagePath: string; mimeType: string; fileSizeBytes: number }> {
  const { buffer, detectedMime } = validateAndDecodeProofDataUrl(dataUrl, proofType);
  const storagePath = buildProofStoragePath(orderId, proofType, extensionForMime(detectedMime));
  const bucket = getAdminStorage().bucket();
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    contentType: detectedMime,
    resumable: false,
    metadata: { metadata: { orderId, proofType } },
  });

  return { storagePath, mimeType: detectedMime, fileSizeBytes: buffer.length };
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

export async function createProof(
  orderId: string,
  input: UploadProofInput,
  actor: AuthUser,
  driverId: string,
): Promise<ProofAsset> {
  const order = await getOrderById(orderId);
  await assertProofUploadAllowed(orderId, input.type, driverId);

  let storagePath: string | undefined;
  let uploaded: { storagePath: string; mimeType: string; fileSizeBytes: number };

  uploaded = await uploadProofFile(orderId, input.type, input.dataUrl);
  storagePath = uploaded.storagePath;

  const db = getAdminFirestore();
  const ref = orderProofsCollection(db, orderId).doc();
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
    if (storagePath) {
      await deleteProofFile(storagePath).catch(() => {});
    }
    throw err;
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
  const bucket = getAdminStorage().bucket();
  const file = bucket.file(storagePath);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresInMs,
    version: "v4",
  });
  return url;
}
