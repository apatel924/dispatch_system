import { createHash } from "node:crypto";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { COLLECTIONS } from "@/lib/server/firestore/collections";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, RateLimitBucket>();

export interface RateLimitConfig {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

function useMemoryRateLimitStore(): boolean {
  return process.env.VITEST === "true" || process.env.RATE_LIMIT_STORE === "memory";
}

/** Hash sensitive components before using them as rate-limit or Firestore keys. */
export function hashRateLimitComponent(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}

function checkRateLimitInMemory(config: RateLimitConfig): RateLimitResult {
  const storageKey = hashRateLimitComponent(config.key);
  const now = Date.now();
  const existing = memoryBuckets.get(storageKey);

  if (!existing || now >= existing.resetAt) {
    memoryBuckets.set(storageKey, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, config.limit - 1),
      retryAfterMs: 0,
    };
  }

  if (existing.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, existing.resetAt - now),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, config.limit - existing.count),
    retryAfterMs: 0,
  };
}

async function checkRateLimitFirestore(config: RateLimitConfig): Promise<RateLimitResult> {
  const db = getAdminFirestore();
  const docId = hashRateLimitComponent(config.key);
  const ref = db.collection(COLLECTIONS.rateLimits).doc(docId);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists
      ? (snap.data() as { count?: number; resetAt?: number })
      : undefined;

    if (!existing || now >= (existing.resetAt ?? 0)) {
      tx.set(ref, { count: 1, resetAt: now + config.windowMs });
      return {
        allowed: true,
        remaining: Math.max(0, config.limit - 1),
        retryAfterMs: 0,
      };
    }

    const count = existing.count ?? 0;
    if (count >= config.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, (existing.resetAt ?? now) - now),
      };
    }

    tx.update(ref, { count: count + 1 });
    return {
      allowed: true,
      remaining: Math.max(0, config.limit - count - 1),
      retryAfterMs: 0,
    };
  });
}

/** Serverless-compatible sliding window rate limiter (Firestore-backed in production). */
export async function checkRateLimitAsync(config: RateLimitConfig): Promise<RateLimitResult> {
  if (useMemoryRateLimitStore()) {
    return checkRateLimitInMemory(config);
  }
  return checkRateLimitFirestore(config);
}

/** @deprecated Use checkRateLimitAsync for production paths. */
export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  return checkRateLimitInMemory(config);
}

export function resetRateLimitsForTests(): void {
  memoryBuckets.clear();
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
