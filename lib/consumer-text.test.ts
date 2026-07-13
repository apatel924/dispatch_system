import { describe, expect, it } from "vitest";
import {
  CONSUMER_NOTE_MAX_LENGTH,
  escapeConsumerText,
  formatConsumerDeliveryDestination,
  isConsumerNoteValid,
  sanitizeConsumerText,
} from "@/lib/consumer-text";

describe("consumer text utilities", () => {
  it("trims surrounding whitespace", () => {
    expect(sanitizeConsumerText("  buzzer 402  ")).toBe("buzzer 402");
  });

  it("escapes HTML entities", () => {
    expect(escapeConsumerText(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("rejects empty and oversized notes", () => {
    expect(isConsumerNoteValid("")).toBe(false);
    expect(isConsumerNoteValid("   ")).toBe(false);
    expect(isConsumerNoteValid("a".repeat(CONSUMER_NOTE_MAX_LENGTH))).toBe(true);
    expect(isConsumerNoteValid("a".repeat(CONSUMER_NOTE_MAX_LENGTH + 1))).toBe(false);
  });

  it("formats consumer-safe destination without street address", () => {
    expect(
      formatConsumerDeliveryDestination({
        deliveryArea: "Edmonton",
        deliveryUnit: "4B",
      }),
    ).toBe("Edmonton · Unit 4B");
  });
});
