/** 32 random bytes encoded as base64url (43 characters, no padding). */
export const OPAQUE_TRACKING_TOKEN_BYTES = 32;
export const OPAQUE_TRACKING_TOKEN_LENGTH = 43;
export const MAX_TRACKING_TOKEN_INPUT_LENGTH = 128;

export function isLegacyPublicReference(token: string): boolean {
  return /^QRX-/i.test(token.trim());
}

export function isValidOpaqueTrackingToken(token: string): boolean {
  const normalized = token.trim();
  return (
    normalized.length === OPAQUE_TRACKING_TOKEN_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(normalized)
  );
}

/** Returns true only for 43-char base64url opaque tokens; rejects QRX-* and order IDs. */
export function isValidPublicTrackingToken(token: string): boolean {
  const normalized = token.trim();
  if (!normalized || normalized.length > MAX_TRACKING_TOKEN_INPUT_LENGTH) {
    return false;
  }
  if (isLegacyPublicReference(normalized)) {
    return false;
  }
  return isValidOpaqueTrackingToken(normalized);
}

/**
 * Demo tracking was removed. This gate exists so env vars can never re-enable
 * synthetic data in production, even if demo modules are reintroduced locally.
 */
export function isTrackingDemoEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return (
    process.env.ENABLE_TRACKING_DEMO === "true" &&
    process.env.NEXT_PUBLIC_ENABLE_TRACKING_DEMO === "true"
  );
}
