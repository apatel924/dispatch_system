import { afterEach, describe, expect, it } from "vitest";
import { ServiceError } from "@/lib/server/errors";
import {
  detectImageMimeFromBuffer,
  validateAndDecodeProofDataUrl,
} from "@/lib/server/proof-validation";

const MINIMAL_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

const MINIMAL_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

function dataUrl(mime: string, buffer: Buffer): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

describe("proof validation", () => {
  const prevMaxBytes = process.env.PROOF_MAX_UPLOAD_BYTES;
  const prevMaxChars = process.env.PROOF_MAX_DATA_URL_CHARS;

  afterEach(() => {
    process.env.PROOF_MAX_UPLOAD_BYTES = prevMaxBytes;
    process.env.PROOF_MAX_DATA_URL_CHARS = prevMaxChars;
  });

  it("accepts a valid JPEG proof", () => {
    const url = dataUrl("image/jpeg", MINIMAL_JPEG);
    const result = validateAndDecodeProofDataUrl(url, "exteriorPhoto");
    expect(result.detectedMime).toBe("image/jpeg");
    expect(result.buffer.length).toBe(MINIMAL_JPEG.length);
  });

  it("accepts a valid PNG signature", () => {
    const url = dataUrl("image/png", MINIMAL_PNG);
    const result = validateAndDecodeProofDataUrl(url, "signature");
    expect(result.detectedMime).toBe("image/png");
  });

  it("rejects invalid MIME type for proof category", () => {
    const url = dataUrl("image/png", MINIMAL_PNG);
    expect(() => validateAndDecodeProofDataUrl(url, "exteriorPhoto")).toThrow(ServiceError);
    try {
      validateAndDecodeProofDataUrl(url, "exteriorPhoto");
    } catch (err) {
      expect((err as ServiceError).status).toBe(400);
    }
  });

  it("rejects spoofed MIME type (declared jpeg, content png)", () => {
    const url = dataUrl("image/jpeg", MINIMAL_PNG);
    expect(() => validateAndDecodeProofDataUrl(url, "signature")).toThrow(ServiceError);
    try {
      validateAndDecodeProofDataUrl(url, "signature");
    } catch (err) {
      expect((err as ServiceError).code).toBe("INVALID_PROOF");
    }
  });

  it("rejects malformed base64", () => {
    expect(() =>
      validateAndDecodeProofDataUrl("data:image/png;base64,%%%not-base64!!!", "signature"),
    ).toThrow(ServiceError);
  });

  it("rejects oversized encoded payload", () => {
    process.env.PROOF_MAX_DATA_URL_CHARS = "50";
    const url = dataUrl("image/png", MINIMAL_PNG);
    try {
      validateAndDecodeProofDataUrl(url, "signature");
    } catch (err) {
      expect((err as ServiceError).status).toBe(413);
      expect((err as ServiceError).code).toBe("PAYLOAD_TOO_LARGE");
    }
  });

  it("rejects oversized decoded payload", () => {
    process.env.PROOF_MAX_UPLOAD_BYTES = "4";
    const url = dataUrl("image/png", MINIMAL_PNG);
    try {
      validateAndDecodeProofDataUrl(url, "signature");
    } catch (err) {
      expect((err as ServiceError).status).toBe(413);
    }
  });

  it("rejects empty payload", () => {
    expect(() => validateAndDecodeProofDataUrl("data:image/png;base64,", "signature")).toThrow(
      ServiceError,
    );
  });

  it("detects image magic bytes", () => {
    expect(detectImageMimeFromBuffer(MINIMAL_PNG)).toBe("image/png");
    expect(detectImageMimeFromBuffer(MINIMAL_JPEG)).toBe("image/jpeg");
    expect(detectImageMimeFromBuffer(Buffer.from([0x00, 0x01]))).toBeNull();
  });
});
