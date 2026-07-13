export interface PhoneNormalizationResult {
  ok: true;
  e164: string;
}

export interface PhoneNormalizationError {
  ok: false;
}

export type NormalizePhoneResult = PhoneNormalizationResult | PhoneNormalizationError;

const NANP_COUNTRY_CODE = "1";

/**
 * Normalize Canadian / North American numbers to E.164 (+1XXXXXXXXXX).
 * Does not log or expose the input number on failure.
 */
export function normalizeNorthAmericanPhone(raw: string | undefined | null): NormalizePhoneResult {
  if (!raw || typeof raw !== "string") return { ok: false };

  const trimmed = raw.trim();
  if (!trimmed) return { ok: false };

  let digits = trimmed.replace(/\D/g, "");
  if (digits.length === 0) return { ok: false };

  if (trimmed.startsWith("+")) {
    if (!digits.startsWith(NANP_COUNTRY_CODE)) return { ok: false };
    digits = digits.slice(NANP_COUNTRY_CODE.length);
  } else if (digits.length === 11 && digits.startsWith(NANP_COUNTRY_CODE)) {
    digits = digits.slice(NANP_COUNTRY_CODE.length);
  }

  if (digits.length !== 10) return { ok: false };

  const areaCode = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);
  if (areaCode[0] === "0" || areaCode[0] === "1") return { ok: false };
  if (exchange[0] === "0" || exchange[0] === "1") return { ok: false };

  return { ok: true, e164: `+${NANP_COUNTRY_CODE}${digits}` };
}

/** Mask an E.164 number for safe display (e.g. +1***-***-1234). */
export function maskPhoneE164(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  const last4 = digits.slice(-4);
  return `+${digits.startsWith("1") ? "1 " : ""}***-***-${last4}`;
}
