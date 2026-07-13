import type {
  SendSmsResult,
  SendTrackingLinkInput,
  SmsProvider,
} from "@/lib/server/notifications/types";

export interface TestSmsRecord {
  input: SendTrackingLinkInput;
  sentAt: string;
}

const sentMessages: TestSmsRecord[] = [];
let shouldFail = false;
let failureCategory: SendSmsResult["failureCategory"] = "PROVIDER_ERROR";

export const testSmsProvider: SmsProvider = {
  name: "test",

  async sendTrackingLink(input: SendTrackingLinkInput): Promise<SendSmsResult> {
    if (shouldFail) {
      return {
        ok: false,
        provider: "test",
        failureCategory,
        providerErrorCode: failureCategory,
      };
    }

    sentMessages.push({ input, sentAt: new Date().toISOString() });
    return {
      ok: true,
      provider: "test",
      messageSid: `SM_test_${sentMessages.length}`,
    };
  },
};

export function resetTestSmsProvider(): void {
  sentMessages.length = 0;
  shouldFail = false;
  failureCategory = "PROVIDER_ERROR";
}

export function getTestSmsMessages(): readonly TestSmsRecord[] {
  return sentMessages;
}

export function setTestSmsProviderFailure(
  category: SendSmsResult["failureCategory"] = "PROVIDER_ERROR",
): void {
  shouldFail = true;
  failureCategory = category;
}
