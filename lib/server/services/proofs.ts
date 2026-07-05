import type { ProofAsset } from "@/lib/types/backend";
import type { AuthUser } from "@/lib/server/auth";
import { notFoundError } from "@/lib/server/errors";
import { orderProofsCollection } from "@/lib/server/firestore/collections";
import { docToProof, nowIso } from "@/lib/server/firestore/helpers";
import { getAdminFirestore, getAdminStorage } from "@/lib/server/firebase-admin";
import { writeAuditLog } from "@/lib/server/services/audit";
import {
  addStatusEvent,
  getOrderById,
  updateOrder,
} from "@/lib/server/services/orders";
import type { ReviewProofInput, UploadProofInput } from "@/lib/server/validation/proofs";

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
    const bucket = getAdminStorage().bucket();
    const file = bucket.file(proof.storagePath);
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });
    return { ...proof, downloadUrl: url };
  } catch {
    return proof;
  }
}

export async function createProof(
  orderId: string,
  input: UploadProofInput,
  actor: AuthUser,
): Promise<ProofAsset> {
  const order = await getOrderById(orderId);
  const db = getAdminFirestore();
  const ref = orderProofsCollection(db, orderId).doc();
  const uploadedAt = nowIso();

  const proof: Omit<ProofAsset, "id"> = {
    orderId,
    type: input.type,
    stepKey: input.stepKey,
    storagePath: input.storagePath,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    uploadedBy: actor.uid,
    uploadedAt,
    reviewStatus: "pending",
  };

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
  expiresInMs = 60 * 60 * 1000,
): Promise<string> {
  const bucket = getAdminStorage().bucket();
  const file = bucket.file(storagePath);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresInMs,
  });
  return url;
}
