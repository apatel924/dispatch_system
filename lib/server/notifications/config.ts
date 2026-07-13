export interface TwilioSmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

/** Server-side app base URL — prefers APP_URL over NEXT_PUBLIC_APP_URL. */
export function getAppBaseUrl(): string {
  const url =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export function readTwilioConfig(): TwilioSmsConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim();
  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
}

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}
