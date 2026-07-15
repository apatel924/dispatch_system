/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const { postOrderProof } = vi.hoisted(() => ({
  postOrderProof: vi.fn(
    () =>
      new Promise<{ proof: { id: string } }>((resolve) => {
        setTimeout(() => resolve({ proof: { id: "p1" } }), 50);
      }),
  ),
}));

vi.mock("@/lib/dash/api/config", () => ({ isApiEnabled: () => true }));
vi.mock("@/lib/dash/api/driver-client", () => ({
  postOrderProof,
  postOrderStatus: vi.fn(),
}));

import {
  isProofUploadInFlight,
  resetProofUploadStateForTests,
  saveProofAsync,
} from "@/lib/dash/driver-store";

const DRIVER = "DRV-TEST";

describe("driver-store upload deduplication", () => {
  afterEach(() => {
    resetProofUploadStateForTests();
    vi.clearAllMocks();
  });

  it("deduplicates concurrent saveProofAsync calls for the same proof type", async () => {
    const dataUrl = "data:image/png;base64,aaaa";
    const first = saveProofAsync(DRIVER, "ORD-1", "signature", dataUrl);
    expect(isProofUploadInFlight(DRIVER, "ORD-1", "signature")).toBe(true);

    const second = saveProofAsync(DRIVER, "ORD-1", "signature", dataUrl);
    await Promise.all([first, second]);

    expect(isProofUploadInFlight(DRIVER, "ORD-1", "signature")).toBe(false);
    expect(postOrderProof).toHaveBeenCalledTimes(1);
  });
});
