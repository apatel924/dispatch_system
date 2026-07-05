/** When true, admin pages fetch from /api/* with mock fallback on error. */
export function isApiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_API === "true";
}

export type DataSource = "api" | "mock";
