import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeBarnetSync } = vi.hoisted(() => ({
  executeBarnetSync: vi.fn(),
}));

vi.mock("@/lib/integrations/order-provider/execute-barnet-sync.server", () => ({
  executeBarnetSync,
}));

import { executeBarnetCronSync } from "@/lib/integrations/order-provider/barnet-cron-sync.server";

describe("executeBarnetCronSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to shared executeBarnetSync with cron source", async () => {
    executeBarnetSync.mockResolvedValue({
      ok: true,
      pagesScanned: 1,
      ordersSeen: 5,
      deliveryCandidates: 0,
      newDeliveries: 0,
      updatedDeliveries: 0,
      unchangedOrders: 5,
      pickupOrdersIgnored: 5,
      unknownOrdersIgnored: 0,
      invalid: 0,
      enrichmentErrors: 0,
      syncErrors: 0,
      durationMs: 10,
      status: "success",
    });

    const result = await executeBarnetCronSync("cron-run");
    expect(executeBarnetSync).toHaveBeenCalledWith({
      runId: "cron-run",
      source: "cron",
    });
    expect(result.ok).toBe(true);
  });
});
