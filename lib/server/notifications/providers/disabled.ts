import type { SendSmsResult, SmsProvider } from "@/lib/server/notifications/types";

const notConfigured = (): SendSmsResult => ({
  ok: false,
  provider: "disabled",
  failureCategory: "SMS_NOT_CONFIGURED",
  providerErrorCode: "SMS_NOT_CONFIGURED",
});

export const disabledSmsProvider: SmsProvider = {
  name: "disabled",

  async sendTrackingLink(): Promise<SendSmsResult> {
    return notConfigured();
  },

  async sendSms(): Promise<SendSmsResult> {
    return notConfigured();
  },
};
