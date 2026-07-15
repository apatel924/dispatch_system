import type { ProofType } from "@/lib/types/backend";
import { requiredProofTypesForDelivery } from "@/lib/delivery-workflow";
import { conflictError } from "@/lib/server/errors";
import { orderProofsCollection } from "@/lib/server/firestore/collections";
import { getAdminFirestore } from "@/lib/server/firebase-admin";

/**
 * Rejects Delivered transitions when required proof documents are missing on the server.
 * Kept separate from proofs.ts / orders.ts to avoid circular imports.
 */
export async function assertRequiredProofsForDelivery(orderId: string): Promise<void> {
  const required = requiredProofTypesForDelivery();
  const db = getAdminFirestore();
  const snap = await orderProofsCollection(db, orderId).get();
  const present = new Set<ProofType>();
  for (const doc of snap.docs) {
    const data = doc.data();
    const type = data.type as ProofType | undefined;
    const storagePath = typeof data.storagePath === "string" ? data.storagePath : "";
    if (type && storagePath) present.add(type);
  }

  const missing = required.filter((type) => !present.has(type));
  if (missing.length === 0) return;

  throw conflictError(
    `Cannot complete delivery until required proofs are uploaded (${missing.join(", ")}).`,
  );
}
