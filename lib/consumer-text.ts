export const CONSUMER_NOTE_MAX_LENGTH = 750;

/** Trim surrounding whitespace from consumer-entered plain text. */
export function sanitizeConsumerText(input: string): string {
  return input.trim();
}

/** Escape plain text for safe HTML rendering (defense in depth — React text nodes also escape). */
export function escapeConsumerText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isConsumerNoteValid(text: string): boolean {
  const sanitized = sanitizeConsumerText(text);
  return sanitized.length > 0 && sanitized.length <= CONSUMER_NOTE_MAX_LENGTH;
}

/** Consumer-safe delivery destination — area and unit only, no full street address. */
export function formatConsumerDeliveryDestination(order: {
  deliveryArea?: string;
  deliveryUnit?: string;
}): string {
  const parts: string[] = [];
  if (order.deliveryArea?.trim()) {
    parts.push(order.deliveryArea.trim());
  }
  if (order.deliveryUnit?.trim()) {
    parts.push(`Unit ${order.deliveryUnit.trim()}`);
  }
  if (parts.length > 0) return parts.join(" · ");
  return "Your delivery address on file";
}
