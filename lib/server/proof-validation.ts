import type { ProofType } from "@/lib/types/backend";
import { ServiceError } from "@/lib/server/errors";
import {
  proofMaxDataUrlChars,
  proofMaxUploadBytesForType,
} from "@/lib/server/proof-limits";

const DATA_URL_RE = /^data:([^;]+);base64,([\s\S]+)$/;

/** MIME types accepted for each proof category. */
export const ALLOWED_PROOF_MIMES: Record<ProofType, readonly string[]> = {
  signature: ["image/png"],
  exteriorPhoto: ["image/jpeg", "image/webp"],
  idVerification: ["image/jpeg", "image/webp"],
};

const MAGIC: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
];

function payloadTooLargeError(message: string): ServiceError {
  return new ServiceError(message, "PAYLOAD_TOO_LARGE", 413);
}

function invalidProofError(message: string, proofType?: ProofType): ServiceError {
  if (proofType === "signature") {
    return new ServiceError(
      "The signature file was invalid. Please clear it and sign again.",
      "INVALID_PROOF",
      400,
    );
  }
  if (proofType === "exteriorPhoto" || proofType === "idVerification") {
    return new ServiceError(
      "The photo file was invalid. Please retake and try again.",
      "INVALID_PROOF",
      400,
    );
  }
  return new ServiceError(message, "INVALID_PROOF", 400);
}

/** Detect MIME from magic bytes; returns null when unrecognized. */
export function detectImageMimeFromBuffer(buffer: Buffer): string | null {
  if (buffer.length < 3) return null;

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  for (const rule of MAGIC) {
    const offset = rule.offset ?? 0;
    if (buffer.length < offset + rule.bytes.length) continue;
    const match = rule.bytes.every((b, i) => buffer[offset + i] === b);
    if (match) return rule.mime;
  }

  return null;
}

export interface ValidatedProofPayload {
  buffer: Buffer;
  declaredMime: string;
  detectedMime: string;
}

/**
 * Validate a base64 data URL before decode/upload.
 * Rejects oversize, malformed, empty, spoofed, or disallowed payloads.
 */
export function validateAndDecodeProofDataUrl(
  dataUrl: string,
  proofType: ProofType,
): ValidatedProofPayload {
  if (!dataUrl || dataUrl.length < 22) {
    throw invalidProofError("Proof payload is empty", proofType);
  }

  const maxChars = proofMaxDataUrlChars();
  if (dataUrl.length > maxChars) {
    throw payloadTooLargeError(
      "This proof is too large to upload. Please retake a smaller photo or resign.",
    );
  }

  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) {
    throw invalidProofError("dataUrl must be a base64 data URL", proofType);
  }

  const declaredMime = match[1].toLowerCase().trim();
  const base64 = match[2].replace(/\s/g, "");

  if (!base64) {
    throw invalidProofError("Proof base64 payload is empty", proofType);
  }

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw invalidProofError("Proof base64 payload is malformed", proofType);
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    throw invalidProofError("Proof base64 payload could not be decoded", proofType);
  }

  if (buffer.length === 0) {
    throw invalidProofError("Decoded proof is empty", proofType);
  }

  const maxBytes = proofMaxUploadBytesForType(proofType);
  if (buffer.length > maxBytes) {
    throw payloadTooLargeError(
      "This proof is too large to upload. Please retake a smaller photo or resign.",
    );
  }

  const detectedMime = detectImageMimeFromBuffer(buffer);
  if (!detectedMime) {
    throw invalidProofError("Proof file is not a recognized image format", proofType);
  }

  const allowed = ALLOWED_PROOF_MIMES[proofType];
  if (!allowed.includes(detectedMime)) {
    throw invalidProofError(
      `Proof type "${proofType}" requires ${allowed.join(" or ")}, got ${detectedMime}`,
      proofType,
    );
  }

  // Declared MIME must match detected bytes (prevents spoofing image/jpeg header on PNG bytes).
  const normalizedDeclared = declaredMime.split(";")[0]?.trim();
  if (normalizedDeclared && normalizedDeclared !== detectedMime) {
    throw invalidProofError(
      `Declared MIME "${normalizedDeclared}" does not match file content (${detectedMime})`,
      proofType,
    );
  }

  return { buffer, declaredMime: detectedMime, detectedMime };
}
