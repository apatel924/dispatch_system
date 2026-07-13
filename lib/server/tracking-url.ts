import { getAppBaseUrl } from "@/lib/server/notifications/config";

/** Build a consumer-facing tracking URL. Only use when returning a freshly issued token. */
export function buildPublicTrackingUrl(rawToken: string): string {
  return `${getAppBaseUrl()}/track/${rawToken}`;
}
