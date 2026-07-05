import type { ImportLog, Order } from "@/lib/types/backend";
import type { AuthUser } from "@/lib/server/auth";
import { COLLECTIONS } from "@/lib/server/firestore/collections";
import { docToImportLog, formatCentsToDisplay, nowIso } from "@/lib/server/firestore/helpers";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { writeAuditLog } from "@/lib/server/services/audit";
import { createOrder } from "@/lib/server/services/orders";
import type { CreateOrderInput } from "@/lib/server/validation/orders";
import {
  MockAmazonPayloadSchema,
  MockDoorDashPayloadSchema,
  MockUberPayloadSchema,
  type MockProviderPayload,
  type OrderImportInput,
  type ListImportLogsQuery,
} from "@/lib/server/validation/import";
import { MOCK_IMPORT_FIXTURES } from "@/lib/import/mock-fixtures";

export { MOCK_IMPORT_FIXTURES };

function payloadToCreateOrder(
  payload: MockProviderPayload,
  source: string,
): CreateOrderInput {
  return {
    customerName: payload.customer,
    customerPhone: payload.phone,
    pickupName: payload.pickupName,
    pickupAddress: payload.pickupAddress,
    deliveryAddress: payload.address,
    externalOrderId: payload.externalId,
    totalCents: payload.totalCents,
    notes: payload.notes,
    source,
    paymentStatus: "Pending",
  };
}

function parsePayload(source: OrderImportInput["source"], payload: unknown): MockProviderPayload {
  switch (source) {
    case "mock-uber":
      return MockUberPayloadSchema.parse(payload);
    case "mock-doordash":
      return MockDoorDashPayloadSchema.parse(payload);
    case "mock-amazon":
      return MockAmazonPayloadSchema.parse(payload);
  }
}

export async function importOrders(
  input: OrderImportInput,
  actor: AuthUser,
): Promise<{ imported: number; orders: Order[]; errors: string[]; log: ImportLog }> {
  const db = getAdminFirestore();
  const logRef = db.collection(COLLECTIONS.importLogs).doc();
  const createdAt = nowIso();
  const errors: string[] = [];
  const orders: Order[] = [];

  let payloads: MockProviderPayload[];
  try {
    if (Array.isArray(input.payload)) {
      payloads = input.payload.map((p) => parsePayload(input.source, p));
    } else {
      payloads = [parsePayload(input.source, input.payload)];
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid import payload";
    const failedLog: ImportLog = {
      id: logRef.id,
      source: input.source,
      status: "failed",
      ordersImported: 0,
      ordersFailed: 1,
      errors: [message],
      payloadSummary: "Validation failed",
      initiatedBy: actor.uid,
      createdAt,
      completedAt: nowIso(),
    };
    await logRef.set(failedLog);
    return { imported: 0, orders: [], errors: [message], log: failedLog };
  }

  for (const item of payloads) {
    try {
      const order = await createOrder(payloadToCreateOrder(item, input.source), actor);
      orders.push(order);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Import row failed");
    }
  }

  const status: ImportLog["status"] =
    errors.length === 0
      ? "success"
      : orders.length > 0
        ? "partial"
        : "failed";

  const log: ImportLog = {
    id: logRef.id,
    source: input.source,
    status,
    ordersImported: orders.length,
    ordersFailed: errors.length,
    errors: errors.length > 0 ? errors : undefined,
    payloadSummary: `${orders.length} orders from ${input.source} (${formatCentsToDisplay(payloads[0]?.totalCents ?? 0)} sample)`,
    initiatedBy: actor.uid,
    createdAt,
    completedAt: nowIso(),
  };

  await logRef.set(log);
  await writeAuditLog({
    action: "import.run",
    entityType: "import",
    entityId: logRef.id,
    actorId: actor.uid,
    actorRole: actor.role,
    metadata: { source: input.source, imported: orders.length, failed: errors.length },
  });

  return { imported: orders.length, orders, errors, log };
}

export async function listImportLogs(
  query: ListImportLogsQuery,
): Promise<{ logs: ImportLog[]; nextCursor?: string }> {
  const db = getAdminFirestore();
  let ref: FirebaseFirestore.Query = db
    .collection(COLLECTIONS.importLogs)
    .orderBy("createdAt", "desc");

  if (query.source) ref = ref.where("source", "==", query.source);

  if (query.cursor) {
    const cursorSnap = await db.collection(COLLECTIONS.importLogs).doc(query.cursor).get();
    if (cursorSnap.exists) ref = ref.startAfter(cursorSnap);
  }

  const snap = await ref.limit(query.limit + 1).get();
  const logs = snap.docs.map((doc) => docToImportLog(doc.id, doc.data()));
  const hasMore = logs.length > query.limit;
  const page = hasMore ? logs.slice(0, query.limit) : logs;

  return {
    logs: page,
    nextCursor: hasMore ? page[page.length - 1]?.id : undefined,
  };
}
