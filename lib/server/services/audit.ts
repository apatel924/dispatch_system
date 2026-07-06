import type { AuditLog, UserRole } from "@/lib/types/backend";
import { COLLECTIONS } from "@/lib/server/firestore/collections";
import { docToAuditLog, nowIso, omitUndefined } from "@/lib/server/firestore/helpers";
import { getAdminFirestore } from "@/lib/server/firebase-admin";

export interface WriteAuditLogInput {
  action: string;
  entityType: AuditLog["entityType"];
  entityId: string;
  actorId: string;
  actorRole: UserRole | "system";
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<AuditLog> {
  const db = getAdminFirestore();
  const createdAt = nowIso();
  const ref = db.collection(COLLECTIONS.auditLogs).doc();

  const record: Omit<AuditLog, "id"> = {
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    metadata: input.metadata,
    createdAt,
  };

  await ref.set(omitUndefined(record));
  return { id: ref.id, ...record };
}

export async function listAuditLogsForEntity(
  entityType: AuditLog["entityType"],
  entityId: string,
  limit = 50,
): Promise<AuditLog[]> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.auditLogs)
    .where("entityType", "==", entityType)
    .where("entityId", "==", entityId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => docToAuditLog(doc.id, doc.data()));
}
