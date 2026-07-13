import type { SendSmsResult, SmsProvider } from "@/lib/server/notifications/types";

export const disabledSmsProvider: SmsProvider = {
  name: "disabled",

  async sendTrackingLink(): Promise<SendSmsResult> {
    return {
      ok: false,
      provider: "disabled",
      failureCategory: "SMS_NOT_CONFIGURED",
      providerErrorCode: "SMS_NOT_CONFIGURED",
    };
  },
};
