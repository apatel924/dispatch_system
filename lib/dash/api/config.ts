/** When true, admin pages fetch from /api/*. */
export function isApiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_API === "true";
}

/**
 * Dev-only mock data. Requires explicit opt-in and must not be combined with API mode.
 * Never enable in production.
 */
export function isDevMockEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_DEV_MOCK === "true" &&
    process.env.NEXT_PUBLIC_USE_API !== "true"
  );
}

export type DataSource = "api" | "mock";
