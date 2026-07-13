import type { TwilioSmsConfig } from "@/lib/server/notifications/config";
import type {
  SendSmsResult,
  SendTrackingLinkInput,
  SmsProvider,
} from "@/lib/server/notifications/types";

function buildTrackingSmsBody(input: SendTrackingLinkInput): string {
  const name = input.customerName?.trim() || "there";
  return `Hi ${name}, track your Quick Run Express delivery here: ${input.trackingUrl}`;
}

function sanitizeTwilioErrorCode(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { code?: number; message?: string };
    if (typeof parsed.code === "number") return `TWILIO_${parsed.code}`;
  } catch {
    // ignore parse errors
  }
  if (status === 401 || status === 403) return "TWILIO_AUTH_FAILED";
  if (status === 400) return "TWILIO_REJECTED";
  if (status >= 500) return "TWILIO_UNAVAILABLE";
  return "TWILIO_ERROR";
}

export function createTwilioSmsProvider(config: TwilioSmsConfig): SmsProvider {
  const authHeader = Buffer.from(`${config.accountSid}:${config.authToken}`).toString(
    "base64",
  );

  return {
    name: "twilio",

    async sendTrackingLink(input: SendTrackingLinkInput): Promise<SendSmsResult> {
      const body = buildTrackingSmsBody(input);
      const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`;

      const params = new URLSearchParams({
        From: config.fromNumber,
        To: input.phoneE164,
        Body: body,
      });

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        const responseText = await response.text();

        if (!response.ok) {
          return {
            ok: false,
            provider: "twilio",
            failureCategory: response.status === 400 ? "PROVIDER_REJECTED" : "PROVIDER_ERROR",
            providerErrorCode: sanitizeTwilioErrorCode(response.status, responseText),
          };
        }

        let messageSid: string | undefined;
        try {
          const parsed = JSON.parse(responseText) as { sid?: string };
          messageSid = typeof parsed.sid === "string" ? parsed.sid : undefined;
        } catch {
          // Twilio may still have accepted the message
        }

        return { ok: true, provider: "twilio", messageSid };
      } catch {
        return {
          ok: false,
          provider: "twilio",
          failureCategory: "NETWORK_ERROR",
          providerErrorCode: "NETWORK_ERROR",
        };
      }
    },
  };
}
