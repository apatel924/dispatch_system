/** When true, admin/driver pages fetch from /api/*. */
export function isApiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_API === "true";
}

/**
 * Explicit development/demo mock mode.
 * Requires NEXT_PUBLIC_ENABLE_DEV_MOCK=true and must not combine with API mode.
 * Never enable in production or normal staging.
 */
export function isDevMockEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_DEV_MOCK === "true" &&
    process.env.NEXT_PUBLIC_USE_API !== "true"
  );
}

/**
 * Single decision for whether UIs may seed or return mock operational data.
 * API-enabled and API-failure paths must never use this as a silent fallback.
 */
export function shouldUseMockData(): boolean {
  return isDevMockEnabled();
}

export type DataSource = "api" | "mock";
