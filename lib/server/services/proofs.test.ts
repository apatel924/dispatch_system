import { describe, expect, it } from "vitest";
import {
  buildProofStoragePath,
  decodeProofDataUrl,
  proofSignedUrlTtlMs,
} from "@/lib/server/services/proofs";

describe("proof upload helpers", () => {
  it("decodes a PNG data URL", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");
    const dataUrl = `data:image/png;base64,${png}`;
    const decoded = decodeProofDataUrl(dataUrl);
    expect(decoded.mimeType).toBe("image/png");
    expect(decoded.buffer.equals(Buffer.from(png, "base64"))).toBe(true);
  });

  it("builds scoped storage paths under the order proofs prefix", () => {
    const path = buildProofStoragePath("ORD-1001", "signature", "png");
    expect(path).toMatch(/^orders\/ORD-1001\/proofs\/signature-\d+\.png$/);
  });

  it("defaults signed URL TTL to 15 minutes", () => {
    const previous = process.env.PROOF_SIGNED_URL_TTL_MS;
    delete process.env.PROOF_SIGNED_URL_TTL_MS;
    expect(proofSignedUrlTtlMs()).toBe(15 * 60 * 1000);
    process.env.PROOF_SIGNED_URL_TTL_MS = previous;
  });
});
