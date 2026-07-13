import { createHash, randomBytes } from "node:crypto";
import type { TrackingLink } from "@/lib/types/backend";
import {
  isLegacyPublicReference,
  isValidOpaqueTrackingToken,
  MAX_TRACKING_TOKEN_INPUT_LENGTH,
  OPAQUE_TRACKING_TOKEN_BYTES,
  OPAQUE_TRACKING_TOKEN_LENGTH,
} from "@/lib/tracking-token";
import {
  rateLimitedError,
  trackingExpiredError,
  trackingInvalidError,
  trackingRevokedError,
} from "@/lib/server/errors";
import {
  COLLECTIONS,
  trackingLinkDoc,
} from "@/lib/server/firestore/collections";
import {
  docToTrackingLink,
  nowIso,
  omitUndefined,
} from "@/lib/server/firestore/helpers";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { checkRateLimitAsync, hashRateLimitComponent } from "@/lib/server/rate-limit";
import { buildPublicTrackingUrl } from "@/lib/server/tracking-url";
import { getOrderById } from "@/lib/server/services/orders";
import { orderDoc } from "@/lib/server/firestore/collections";

const DEFAULT_LINK_TTL_DAYS = 30;

export {
  OPAQUE_TRACKING_TOKEN_BYTES,
  OPAQUE_TRACKING_TOKEN_LENGTH,
  MAX_TRACKING_TOKEN_INPUT_LENGTH,
  isValidOpaqueTrackingToken,
} from "@/lib/tracking-token";

const SECURE_DOC_ID_PATTERN = /^[a-f0-9]{64}$/;

function trackingLinkTtlDays(): number {
  const raw = process.env.TRACKING_LINK_TTL_DAYS;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_LINK_TTL_DAYS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LINK_TTL_DAYS;
}

function defaultExpiresAt(): string {
  const days = trackingLinkTtlDays();
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires.toISOString();
}

export function generateTrackingToken(): string {
  return randomBytes(OPAQUE_TRACKING_TOKEN_BYTES).toString("base64url");
}

export function hashTrackingToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function isSecureTrackingLinkDocId(docId: string): boolean {
  return SECURE_DOC_ID_PATTERN.test(docId);
}

export function assertValidTrackingTokenFormat(token: string): void {
  const normalized = token.trim();
  if (!normalized || normalized.length > MAX_TRACKING_TOKEN_INPUT_LENGTH) {
    throw trackingInvalidError();
  }
  if (isLegacyPublicReference(normalized) || !isValidOpaqueTrackingToken(normalized)) {
    throw trackingInvalidError();
  }
}

function storedLinkFromSnapshot(
  snap: FirebaseFirestore.DocumentSnapshot,
): TrackingLink | null {
  if (!snap.exists) return null;

  const docId = snap.id;
  if (!isSecureTrackingLinkDocId(docId)) {
    return null;
  }

  const data = snap.data()!;
  const storedHash = data.tokenHash as string | undefined;
  if (!storedHash || storedHash !== docId) {
    return null;
  }

  if (data.legacyInsecure === true) {
    return null;
  }

  return docToTrackingLink(docId, data);
}

export async function createTrackingLinkForOrder(
  orderId: string,
  publicReference: string,
  options?: { version?: number },
): Promise<TrackingLink & { token: string }> {
  const db = getAdminFirestore();
  const token = generateTrackingToken();
  const tokenHash = hashTrackingToken(token);
  const createdAt = nowIso();

  const link: Omit<TrackingLink, "id" | "token"> = {
    orderId,
    publicReference,
    version: options?.version ?? 1,
    expiresAt: defaultExpiresAt(),
    createdAt,
    tokenHash,
  };

  await trackingLinkDoc(db, tokenHash).set(omitUndefined(link));
  return { id: tokenHash, token, ...link };
}

export async function getTrackingLinkByToken(token: string): Promise<TrackingLink | null> {
  const normalized = token.trim();
  if (!normalized) return null;

  try {
    assertValidTrackingTokenFormat(normalized);
  } catch {
    return null;
  }

  const db = getAdminFirestore();
  const tokenHash = hashTrackingToken(normalized);
  const snap = await trackingLinkDoc(db, tokenHash).get();
  return storedLinkFromSnapshot(snap);
}

export async function getActiveTrackingLinkForOrder(
  orderId: string,
): Promise<TrackingLink | null> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.trackingLinks)
    .where("orderId", "==", orderId)
    .get();

  const active = snap.docs
    .map((doc) => storedLinkFromSnapshot(doc))
    .filter((link): link is TrackingLink => link !== null)
    .filter((link) => !link.revokedAt && link.replacedByVersion === undefined)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return active[0] ?? null;
}

export async function ensureTrackingLinkForOrder(
  orderId: string,
  publicReference: string,
): Promise<TrackingLink & { token: string }> {
  const existing = await getActiveTrackingLinkForOrder(orderId);
  if (existing) {
    throw trackingInvalidError("An active tracking link already exists.");
  }
  return createTrackingLinkForOrder(orderId, publicReference);
}

export interface RotatedTrackingLink {
  link: TrackingLink & { token: string };
  trackingUrl: string;
}

async function updateOrderTrackingMetadata(
  orderId: string,
  version: number,
  issuedAt: string,
): Promise<void> {
  const db = getAdminFirestore();
  await orderDoc(db, orderId).update(
    omitUndefined({
      trackingLinkVersion: version,
      trackingLinkIssuedAt: issuedAt,
      updatedAt: nowIso(),
    }),
  );
}

export async function rotateTrackingLinkForOrder(orderId: string): Promise<RotatedTrackingLink> {
  const order = await getOrderById(orderId);
  const db = getAdminFirestore();
  const existing = await getActiveTrackingLinkForOrder(orderId);
  const nextVersion = (existing?.version ?? 0) + 1;

  const newLink = await createTrackingLinkForOrder(orderId, order.trackingId, {
    version: nextVersion,
  });

  if (existing) {
    await trackingLinkDoc(db, existing.id).update(
      omitUndefined({
        revokedAt: nowIso(),
        replacedByVersion: newLink.version,
      }),
    );
  }

  await updateOrderTrackingMetadata(orderId, newLink.version, newLink.createdAt);

  return {
    link: newLink,
    trackingUrl: buildPublicTrackingUrl(newLink.token),
  };
}

/**
 * Marks tracking link documents whose Firestore ID is a legacy plaintext token.
 * Does not recover plaintext tokens. Run once before production cutover.
 */
export async function markLegacyInsecureTrackingLinks(): Promise<{ marked: number }> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.trackingLinks).get();
  let marked = 0;

  for (const doc of snap.docs) {
    if (isSecureTrackingLinkDocId(doc.id)) continue;
    const data = doc.data();
    if (data.legacyInsecure === true) continue;

    await doc.ref.update(
      omitUndefined({
        legacyInsecure: true,
        revokedAt: data.revokedAt ?? nowIso(),
      }),
    );
    marked += 1;
  }

  return { marked };
}

export interface ResolvedTrackingLink {
  link: TrackingLink;
}

export async function resolveTrackingLink(token: string): Promise<ResolvedTrackingLink> {
  assertValidTrackingTokenFormat(token);
  const link = await getTrackingLinkByToken(token);
  if (!link) {
    throw trackingInvalidError();
  }

  if (link.revokedAt) {
    throw trackingRevokedError();
  }

  if (link.replacedByVersion !== undefined) {
    throw trackingRevokedError("This tracking link has been replaced.");
  }

  if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
    throw trackingExpiredError();
  }

  try {
    await getOrderById(link.orderId);
  } catch {
    throw trackingInvalidError("This delivery is no longer available.");
  }

  return { link };
}

export function assertNotesAllowedForLink(link: TrackingLink, orderDeliveredAt?: string): void {
  if (link.revokedAt || link.replacedByVersion !== undefined) {
    throw trackingRevokedError();
  }

  if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
    throw trackingExpiredError();
  }

  const terminalHours = Number.parseInt(process.env.TRACKING_NOTE_TERMINAL_HOURS ?? "72", 10);
  if (orderDeliveredAt && Number.isFinite(terminalHours) && terminalHours > 0) {
    const deliveredAt = new Date(orderDeliveredAt).getTime();
    const cutoff = deliveredAt + terminalHours * 60 * 60 * 1000;
    if (Date.now() > cutoff) {
      throw trackingExpiredError("The window to add delivery instructions has closed.");
    }
  }
}

function trackingRateLimitKey(
  action: "read" | "notes" | "invalid",
  token: string,
  ip: string,
): string {
  const tokenHash = hashTrackingToken(token);
  const ipHash = hashRateLimitComponent(ip);
  return `tracking:${action}:${ipHash}:${tokenHash}`;
}

function trackingInvalidRateLimitKey(ip: string): string {
  return `tracking:invalid:${hashRateLimitComponent(ip)}`;
}

export function trackingReadRateLimitPerMinute(): number {
  const parsed = Number.parseInt(process.env.TRACKING_READ_RATE_LIMIT_PER_MINUTE ?? "30", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

export function trackingNotesRateLimitPerHour(): number {
  const parsed = Number.parseInt(process.env.TRACKING_NOTE_RATE_LIMIT_PER_HOUR ?? "5", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

export function trackingInvalidRateLimitPerMinute(): number {
  const parsed = Number.parseInt(
    process.env.TRACKING_INVALID_RATE_LIMIT_PER_MINUTE ?? "20",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}

export async function enforceTrackingReadRateLimit(token: string, ip: string): Promise<void> {
  const result = await checkRateLimitAsync({
    key: trackingRateLimitKey("read", token, ip),
    limit: trackingReadRateLimitPerMinute(),
    windowMs: 60 * 1000,
  });
  if (!result.allowed) {
    throw rateLimitedError();
  }
}

export async function enforceTrackingNotesRateLimit(token: string, ip: string): Promise<void> {
  const result = await checkRateLimitAsync({
    key: trackingRateLimitKey("notes", token, ip),
    limit: trackingNotesRateLimitPerHour(),
    windowMs: 60 * 60 * 1000,
  });
  if (!result.allowed) {
    throw rateLimitedError();
  }
}

export async function enforceTrackingInvalidRateLimit(ip: string): Promise<void> {
  const result = await checkRateLimitAsync({
    key: trackingInvalidRateLimitKey(ip),
    limit: trackingInvalidRateLimitPerMinute(),
    windowMs: 60 * 1000,
  });
  if (!result.allowed) {
    throw rateLimitedError();
  }
}
