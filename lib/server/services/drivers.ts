import type { DriverProfile } from "@/lib/types/backend";
import type { AuthUser } from "@/lib/server/auth";
import { notFoundError } from "@/lib/server/errors";
import { COLLECTIONS } from "@/lib/server/firestore/collections";
import { docToDriver, initialsFromName, nowIso } from "@/lib/server/firestore/helpers";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { writeAuditLog } from "@/lib/server/services/audit";
import { generateDriverId } from "@/lib/server/firestore/ids";
import type {
  CreateDriverInput,
  ListDriversQuery,
  UpdateDriverInput,
} from "@/lib/server/validation/drivers";

export async function getDriverById(id: string): Promise<DriverProfile> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.drivers).doc(id).get();
  if (!snap.exists) throw notFoundError("Driver", id);
  return docToDriver(snap.id, snap.data()!);
}

export async function getDriverByUserId(userId: string): Promise<DriverProfile | null> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.drivers)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return docToDriver(doc.id, doc.data());
}

function matchesDriverSearch(driver: DriverProfile, search: string): boolean {
  const q = search.toLowerCase();
  return (
    driver.id.toLowerCase().includes(q) ||
    driver.name.toLowerCase().includes(q) ||
    driver.email.toLowerCase().includes(q) ||
    driver.phone.toLowerCase().includes(q)
  );
}

export async function listDrivers(
  query: ListDriversQuery,
): Promise<{ drivers: DriverProfile[]; nextCursor?: string }> {
  const db = getAdminFirestore();
  let ref: FirebaseFirestore.Query = db
    .collection(COLLECTIONS.drivers)
    .orderBy("name", "asc");

  if (query.status) ref = ref.where("status", "==", query.status);

  const fetchLimit = query.search ? 200 : query.limit + 1;

  if (query.cursor) {
    const cursorSnap = await db.collection(COLLECTIONS.drivers).doc(query.cursor).get();
    if (cursorSnap.exists) ref = ref.startAfter(cursorSnap);
  }

  const snap = await ref.limit(fetchLimit).get();
  let drivers = snap.docs.map((doc) => docToDriver(doc.id, doc.data()));

  if (query.search) {
    drivers = drivers.filter((d) => matchesDriverSearch(d, query.search!));
  }

  const hasMore = drivers.length > query.limit;
  const page = hasMore ? drivers.slice(0, query.limit) : drivers;

  return {
    drivers: page,
    nextCursor: hasMore ? page[page.length - 1]?.id : undefined,
  };
}

export async function createDriver(
  input: CreateDriverInput,
  actor: AuthUser,
): Promise<DriverProfile> {
  const db = getAdminFirestore();
  const id = await generateDriverId();
  const now = nowIso();

  const driver: DriverProfile = {
    id,
    userId: input.userId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    status: input.status ?? "Inactive",
    vehicle: input.vehicle,
    avatarColor: input.avatarColor ?? "bg-info-soft text-info",
    initials: initialsFromName(input.name),
    activeDeliveries: 0,
    completedToday: 0,
    failedToday: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.drivers).doc(id).set(driver);

  await writeAuditLog({
    action: "driver.create",
    entityType: "driver",
    entityId: id,
    actorId: actor.uid,
    actorRole: actor.role,
  });

  return driver;
}

export async function updateDriver(
  id: string,
  input: UpdateDriverInput,
  actor: AuthUser,
): Promise<DriverProfile> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.drivers).doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw notFoundError("Driver", id);

  const patch: Record<string, unknown> = {
    ...input,
    updatedAt: nowIso(),
  };

  if (input.name) patch.initials = initialsFromName(input.name);

  await ref.update(patch);

  await writeAuditLog({
    action: "driver.update",
    entityType: "driver",
    entityId: id,
    actorId: actor.uid,
    actorRole: actor.role,
    metadata: { fields: Object.keys(input) },
  });

  return getDriverById(id);
}
