import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTrackingLinkForOrder,
  generateTrackingToken,
  getTrackingLinkByToken,
  hashTrackingToken,
  isSecureTrackingLinkDocId,
  isValidOpaqueTrackingToken,
  markLegacyInsecureTrackingLinks,
  resolveTrackingLink,
  rotateTrackingLinkForOrder,
} from "@/lib/server/services/tracking-links";
import { resetRateLimitsForTests } from "@/lib/server/rate-limit";
import { trackingInvalidError } from "@/lib/server/errors";

const firestoreState = vi.hoisted(() => ({
  trackingLinks: new Map<string, Record<string, unknown>>(),
  orders: new Map<string, Record<string, unknown>>(),
}));

const { getAdminFirestore, trackingLinkDoc, orderDoc, COLLECTIONS } = vi.hoisted(() => {
  const trackingLinks = firestoreState.trackingLinks;
  const orders = firestoreState.orders;

  function makeDocRef(id: string, collection: Map<string, Record<string, unknown>>) {
    return {
      id,
      set: vi.fn(async (data: Record<string, unknown>) => {
        collection.set(id, { ...data });
      }),
      update: vi.fn(async (patch: Record<string, unknown>) => {
        const existing = collection.get(id) ?? {};
        collection.set(id, { ...existing, ...patch });
      }),
      get: vi.fn(async () => {
        const data = collection.get(id);
        return {
          exists: data !== undefined,
          id,
          data: () => data,
        };
      }),
    };
  }

  return {
    COLLECTIONS: { trackingLinks: "trackingLinks", orders: "orders", rateLimits: "rateLimits" },
    trackingLinkDoc: vi.fn((_db: unknown, tokenHash: string) =>
      makeDocRef(tokenHash, trackingLinks),
    ),
    orderDoc: vi.fn((_db: unknown, orderId: string) => makeDocRef(orderId, orders)),
    getAdminFirestore: vi.fn(() => ({
      collection: vi.fn((name: string) => ({
        doc: vi.fn((id: string) => makeDocRef(id, name === "trackingLinks" ? trackingLinks : orders)),
        where: vi.fn((field: string, _op: string, value: unknown) => ({
          get: vi.fn(async () => ({
            docs: [...trackingLinks.entries()]
              .filter(([, data]) => {
                if (field === "orderId") return data.orderId === value;
                return true;
              })
              .map(([id, data]) => ({
                id,
                exists: true,
                data: () => data,
                ref: makeDocRef(id, trackingLinks),
              })),
          })),
        })),
        get: vi.fn(async () => ({
          docs: [...trackingLinks.entries()].map(([id, data]) => ({
            id,
            data: () => data,
            ref: makeDocRef(id, trackingLinks),
          })),
        })),
      })),
      runTransaction: vi.fn(),
    })),
  };
});

vi.mock("@/lib/server/firebase-admin", () => ({ getAdminFirestore }));
vi.mock("@/lib/server/firestore/collections", () => ({
  COLLECTIONS,
  trackingLinkDoc,
  orderDoc,
}));

const getOrderById = vi.fn();
vi.mock("@/lib/server/services/orders", () => ({
  getOrderById: (...args: unknown[]) => getOrderById(...args),
}));

function sampleToken(): string {
  return generateTrackingToken();
}

describe("secure tracking token storage", () => {
  beforeEach(() => {
    firestoreState.trackingLinks.clear();
    firestoreState.orders.clear();
    resetRateLimitsForTests();
    vi.clearAllMocks();
    getOrderById.mockResolvedValue({
      id: "QRX-1001",
      trackingId: "QRX-1001",
      status: "Assigned",
      createdAt: "2026-07-13T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z",
    });
    firestoreState.orders.set("QRX-1001", {
      trackingId: "QRX-1001",
      status: "Assigned",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("generates 43-char base64url tokens from 32 random bytes", () => {
    const token = sampleToken();
    expect(token).toHaveLength(43);
    expect(isValidOpaqueTrackingToken(token)).toBe(true);
  });

  it("stores SHA-256 hash as document id, not the raw token", async () => {
    const link = await createTrackingLinkForOrder("QRX-1001", "QRX-1001");
    expect(link.id).toBe(hashTrackingToken(link.token));
    expect(link.id).not.toBe(link.token);
    expect(isSecureTrackingLinkDocId(link.id)).toBe(true);

    const stored = firestoreState.trackingLinks.get(link.id);
    expect(stored).toBeDefined();
    expect(JSON.stringify(stored)).not.toContain(link.token);
    expect(stored?.tokenHash).toBe(link.id);
  });

  it("resolves a valid secure token via hash lookup", async () => {
    const created = await createTrackingLinkForOrder("QRX-1001", "QRX-1001");
    const resolved = await getTrackingLinkByToken(created.token);
    expect(resolved?.orderId).toBe("QRX-1001");
    expect(resolved?.id).toBe(hashTrackingToken(created.token));
  });

  it("rejects QRX order numbers as public tracking credentials", async () => {
    await expect(resolveTrackingLink("QRX-10004")).rejects.toMatchObject({
      code: "TRACKING_INVALID",
    });
    await expect(getTrackingLinkByToken("QRX-28491")).resolves.toBeNull();
  });

  it("rejects legacy insecure documents stored with plaintext token ids", async () => {
    const legacyToken = sampleToken();
    firestoreState.trackingLinks.set(legacyToken, {
      orderId: "QRX-1001",
      publicReference: "QRX-1001",
      version: 1,
      createdAt: "2026-07-13T00:00:00.000Z",
      tokenHash: hashTrackingToken(legacyToken),
    });

    await expect(getTrackingLinkByToken(legacyToken)).resolves.toBeNull();
  });

  it("rejects revoked tokens", async () => {
    const created = await createTrackingLinkForOrder("QRX-1001", "QRX-1001");
    firestoreState.trackingLinks.set(created.id, {
      ...firestoreState.trackingLinks.get(created.id)!,
      revokedAt: "2026-07-13T12:00:00.000Z",
    });

    await expect(resolveTrackingLink(created.token)).rejects.toMatchObject({
      code: "TRACKING_REVOKED",
    });
  });

  it("rotates tokens and invalidates the previous link", async () => {
    const first = await createTrackingLinkForOrder("QRX-1001", "QRX-1001");
    const rotated = await rotateTrackingLinkForOrder("QRX-1001");

    expect(rotated.link.token).not.toBe(first.token);
    expect(rotated.trackingUrl).toContain(rotated.link.token);

    await expect(resolveTrackingLink(first.token)).rejects.toMatchObject({
      code: "TRACKING_REVOKED",
    });
    const revokedDoc = firestoreState.trackingLinks.get(first.id);
    expect(revokedDoc?.revokedAt).toBeTruthy();
    await expect(resolveTrackingLink(rotated.link.token)).resolves.toBeDefined();
    expect(revokedDoc?.replacedByVersion).toBe(rotated.link.version);
  });

  it("does not persist raw token on order documents during rotation", async () => {
    const rotated = await rotateTrackingLinkForOrder("QRX-1001");
    const orderData = firestoreState.orders.get("QRX-1001");
    expect(orderData?.trackingLinkVersion).toBe(rotated.link.version);
    expect(orderData?.trackingUrl).toBeUndefined();
    expect(JSON.stringify(orderData)).not.toContain(rotated.link.token);
  });

  it("marks legacy insecure link documents without recovering plaintext tokens", async () => {
    firestoreState.trackingLinks.set("plaintext-token-id", {
      orderId: "QRX-1001",
      version: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await markLegacyInsecureTrackingLinks();
    expect(result.marked).toBe(1);
    expect(firestoreState.trackingLinks.get("plaintext-token-id")?.legacyInsecure).toBe(true);
  });

  it("returns generic invalid errors that do not reveal order existence", async () => {
    getOrderById.mockRejectedValue(trackingInvalidError("This delivery is no longer available."));
    const created = await createTrackingLinkForOrder("QRX-1001", "QRX-1001");

    await expect(resolveTrackingLink(created.token)).rejects.toMatchObject({
      code: "TRACKING_INVALID",
      message: "This delivery is no longer available.",
    });
  });
});

describe("tracking token helpers", () => {
  it("accepts 43-char base64url opaque tokens", () => {
    const token = sampleToken();
    expect(isValidOpaqueTrackingToken(token)).toBe(true);
    expect(isValidOpaqueTrackingToken("short")).toBe(false);
    expect(isValidOpaqueTrackingToken("QRX-1001")).toBe(false);
  });

  it("hashes tokens deterministically without logging the raw value", () => {
    const token = sampleToken();
    const hash = hashTrackingToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashTrackingToken(token));
    expect(hash).not.toBe(token);
  });
});
