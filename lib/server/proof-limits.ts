/** Server-only proof upload limits. Never expose via NEXT_PUBLIC_. */

import type { ProofType } from "@/lib/types/backend";

/** Default decoded binary ceiling (~2.5 MB). Fits under Vercel ~4.5 MB JSON body with base64 overhead. */
export const DEFAULT_PROOF_MAX_UPLOAD_BYTES = 2_621_440;

/** Per-type decoded ceilings (must remain ≤ DEFAULT_PROOF_MAX_UPLOAD_BYTES / env override). */
export const DEFAULT_PROOF_MAX_BYTES_BY_TYPE: Record<ProofType, number> = {
  signature: 1_048_576,
  exteriorPhoto: DEFAULT_PROOF_MAX_UPLOAD_BYTES,
  idVerification: DEFAULT_PROOF_MAX_UPLOAD_BYTES,
};

/** Default encoded data URL ceiling (~3.5 MB chars). ~33% base64 overhead + `data:...;base64,` header. */
export const DEFAULT_PROOF_MAX_DATA_URL_CHARS = 3_500_000;

/** Default max decoded image dimension (server advisory; client should resize first). */
export const DEFAULT_PROOF_MAX_IMAGE_DIMENSION = 2048;

/** Default signed download URL lifetime (15 minutes). */
export const DEFAULT_PROOF_SIGNED_URL_TTL_MS = 15 * 60 * 1000;

/** Default max proof uploads per driver per hour. */
export const DEFAULT_PROOF_RATE_LIMIT_PER_DRIVER_PER_HOUR = 60;

/** Default max proof uploads per order per minute (prevents double-tap bursts). */
export const DEFAULT_PROOF_RATE_LIMIT_PER_ORDER_PER_MINUTE = 10;

/** Minimum spacing between same proof-type uploads for one order (ms). */
export const DEFAULT_PROOF_DUPLICATE_WINDOW_MS = 5_000;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function proofMaxUploadBytes(): number {
  return parsePositiveInt(process.env.PROOF_MAX_UPLOAD_BYTES, DEFAULT_PROOF_MAX_UPLOAD_BYTES);
}

export function proofMaxUploadBytesForType(proofType: ProofType): number {
  const globalMax = proofMaxUploadBytes();
  const typeDefault = DEFAULT_PROOF_MAX_BYTES_BY_TYPE[proofType] ?? globalMax;
  return Math.min(typeDefault, globalMax);
}

export function proofMaxDataUrlChars(): number {
  return parsePositiveInt(process.env.PROOF_MAX_DATA_URL_CHARS, DEFAULT_PROOF_MAX_DATA_URL_CHARS);
}

export function proofMaxImageDimension(): number {
  return parsePositiveInt(process.env.PROOF_MAX_IMAGE_DIMENSION, DEFAULT_PROOF_MAX_IMAGE_DIMENSION);
}

export function proofRateLimitPerDriverPerHour(): number {
  return parsePositiveInt(
    process.env.PROOF_RATE_LIMIT_PER_DRIVER_PER_HOUR,
    DEFAULT_PROOF_RATE_LIMIT_PER_DRIVER_PER_HOUR,
  );
}

export function proofRateLimitPerOrderPerMinute(): number {
  return parsePositiveInt(
    process.env.PROOF_RATE_LIMIT_PER_ORDER_PER_MINUTE,
    DEFAULT_PROOF_RATE_LIMIT_PER_ORDER_PER_MINUTE,
  );
}

export function proofDuplicateWindowMs(): number {
  return parsePositiveInt(
    process.env.PROOF_DUPLICATE_WINDOW_MS,
    DEFAULT_PROOF_DUPLICATE_WINDOW_MS,
  );
}
