import { describe, expect, it } from "vitest";
import {
  REQUIRED_PROOF_UPLOADS,
  requiredProofTypesForDelivery,
  requiredProofStepKeysForDelivery,
  requiredProofUploadForType,
} from "@/lib/delivery-workflow";
import { DELIVERY_STEPS } from "@/lib/dash/driver-mock-data";

describe("required proof source-of-truth alignment", () => {
  it("gives every required proof exactly one UI definition", () => {
    const types = requiredProofTypesForDelivery();
    expect(new Set(types).size).toBe(types.length);
    for (const type of types) {
      const def = requiredProofUploadForType(type);
      expect(def).toBeDefined();
      expect(def!.proofType).toBe(type);
      expect(def!.label.length).toBeGreaterThan(0);
      expect(def!.cardLabel.length).toBeGreaterThan(0);
      expect(def!.required).toBe(true);
    }
  });

  it("aligns client helper proof types with REQUIRED_PROOF_UPLOADS", () => {
    expect(requiredProofTypesForDelivery()).toEqual(
      REQUIRED_PROOF_UPLOADS.map((e) => e.proofType),
    );
    expect(requiredProofStepKeysForDelivery()).toEqual(
      REQUIRED_PROOF_UPLOADS.map((e) => e.stepKey),
    );
  });

  it("derives delivery checklist proof rows from REQUIRED_PROOF_UPLOADS", () => {
    const proofSteps = DELIVERY_STEPS.filter((s) => s.type === "proof");
    expect(proofSteps).toHaveLength(REQUIRED_PROOF_UPLOADS.length);
    for (const upload of REQUIRED_PROOF_UPLOADS) {
      const step = proofSteps.find((s) => s.key === upload.stepKey);
      expect(step).toBeDefined();
      expect(step!.label).toBe(upload.label);
      expect(step!.proofType).toBe(upload.captureMode);
    }
  });

  it("does not hardcode a separate required-proof list in DELIVERY_STEPS beyond the SoT", () => {
    const proofKeys = DELIVERY_STEPS.filter((s) => s.type === "proof").map((s) => s.key);
    expect(proofKeys).toEqual(REQUIRED_PROOF_UPLOADS.map((p) => p.stepKey));
  });
});
