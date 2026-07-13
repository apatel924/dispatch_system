/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import {
  formatProofByteSize,
  PROOF_PREPARE_SETTINGS,
} from "@/lib/dash/proof-image-prepare";

describe("proof image prepare", () => {
  it("formats byte sizes for display", () => {
    expect(formatProofByteSize(512)).toBe("512 B");
    expect(formatProofByteSize(2048)).toBe("2.0 KB");
    expect(formatProofByteSize(2_621_440)).toBe("2.50 MB");
  });

  it("uses separate settings for ID, exterior, and signature proofs", () => {
    expect(PROOF_PREPARE_SETTINGS.idVerification.maxDimension).toBe(2048);
    expect(PROOF_PREPARE_SETTINGS.idVerification.mimeType).toBe("image/jpeg");

    expect(PROOF_PREPARE_SETTINGS.exteriorPhoto.maxDimension).toBe(1920);
    expect(PROOF_PREPARE_SETTINGS.exteriorPhoto.mimeType).toBe("image/jpeg");

    expect(PROOF_PREPARE_SETTINGS.signature.maxDimension).toBe(1600);
    expect(PROOF_PREPARE_SETTINGS.signature.mimeType).toBe("image/png");
    expect(PROOF_PREPARE_SETTINGS.signature.quality).toBeGreaterThanOrEqual(0.9);
  });
});
