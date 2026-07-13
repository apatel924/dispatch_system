import { readTwilioConfig } from "@/lib/server/notifications/config";
import { disabledSmsProvider } from "@/lib/server/notifications/providers/disabled";
import { testSmsProvider } from "@/lib/server/notifications/providers/test";
import { createTwilioSmsProvider } from "@/lib/server/notifications/providers/twilio";
import type { SmsProvider } from "@/lib/server/notifications/types";

let injectedProvider: SmsProvider | null = null;

/** Test-only hook to inject a provider without env changes. */
export function setSmsProviderForTests(provider: SmsProvider | null): void {
  injectedProvider = provider;
}

export function createSmsProvider(): SmsProvider {
  if (injectedProvider) return injectedProvider;

  if (process.env.SMS_PROVIDER === "test") {
    return testSmsProvider;
  }

  const twilioConfig = readTwilioConfig();
  if (twilioConfig) {
    return createTwilioSmsProvider(twilioConfig);
  }

  return disabledSmsProvider;
}
