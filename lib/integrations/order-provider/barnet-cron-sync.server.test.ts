import { beforeEach, describe, expect, it, vi } from "vitest";
import { BarnetUpstreamTimeoutError } from "@/lib/integrations/order-provider/barnet-client.server";

const {
  acquireBarnetSyncLock,
  releaseBarnetSyncLock,
  runBarnetOrderSync,
  getExternalOrderProviderConfig,
} = vi.hoisted(() => ({
  acquireBarnetSyncLock: vi.fn(),
  releaseBarnetSyncLock: vi.fn(),
  runBarnetOrderSync: vi.fn(),
  getExternalOrderProviderConfig: vi.fn(),
}));

vi.mock("@/lib/integrations/order-provider/sync-lock.server", () => ({
  acquireBarnetSyncLock,
  releaseBarnetSyncLock,
}));

vi.mock("@/lib/integrations/order-provider/run-barnet-order-sync.server", () => ({
  runBarnetOrderSync,
}));

vi.mock("@/lib/integrations/order-provider/env.server", () => ({
  getExternalOrderProviderConfig,
}));

import { executeBarnetCronSync } from "@/lib/integrations/order-provider/barnet-cron-sync.server";

describe("executeBarnetCronSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getExternalOrderProviderConfig.mockReturnValue({
      mode: "live",
      liveSyncEnabled: true,
    });
    acquireBarnetSyncLock.mockResolvedValue("acquired");
    releaseBarnetSyncLock.mockResolvedValue(undefined);
  });

  it("skips when provider is not live", async () => {
    getExternalOrderProviderConfig.mockReturnValue({
      mode: "mock",
      liveSyncEnabled: true,
    });

    const result = await executeBarnetCronSync("run-1");
    expect(result).toEqual({
      ok: true,
      skipped: true,
      reason: "provider_not_live",
    });
    expect(acquireBarnetSyncLock).not.toHaveBeenCalled();
  });

  it("skips when live sync is disabled", async () => {
    getExternalOrderProviderConfig.mockReturnValue({
      mode: "live",
      liveSyncEnabled: false,
    });

    const result = await executeBarnetCronSync("run-1");
    expect(result).toEqual({
      ok: true,
      skipped: true,
      reason: "sync_disabled",
    });
    expect(acquireBarnetSyncLock).not.toHaveBeenCalled();
  });

  it("skips when another sync run holds the lock", async () => {
    acquireBarnetSyncLock.mockResolvedValue("skipped");

    const result = await executeBarnetCronSync("run-1");
    expect(result).toEqual({
      ok: true,
      skipped: true,
      reason: "sync_already_running",
    });
    expect(runBarnetOrderSync).not.toHaveBeenCalled();
    expect(releaseBarnetSyncLock).not.toHaveBeenCalled();
  });

  it("returns aggregate counts on success", async () => {
    runBarnetOrderSync.mockResolvedValue({
      pagesScanned: 2,
      ordersSeen: 40,
      deliveryCandidates: 3,
      newDeliveries: 1,
      updatedDeliveries: 1,
      unchangedOrders: 37,
      pickupOrdersIgnored: 35,
      unknownOrdersIgnored: 2,
    });

    const result = await executeBarnetCronSync("run-1");
    expect(result.ok).toBe(true);
    if (result.ok && !("skipped" in result)) {
      expect(result.pagesScanned).toBe(2);
      expect(result.ordersSeen).toBe(40);
      expect(result.deliveryCandidates).toBe(3);
      expect(result.newDeliveries).toBe(1);
      expect(result.updatedDeliveries).toBe(1);
      expect(result.unchangedOrders).toBe(37);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(JSON.stringify(result)).not.toMatch(/customer|phone|address|@/i);
    }
    expect(releaseBarnetSyncLock).toHaveBeenCalledWith("run-1");
  });

  it("returns upstream_timeout when Barnet fetch times out", async () => {
    runBarnetOrderSync.mockRejectedValue(
      new BarnetUpstreamTimeoutError("/orders", 1000),
    );

    const result = await executeBarnetCronSync("run-1");
    expect(result).toEqual({
      ok: false,
      error: "upstream_timeout",
      durationMs: expect.any(Number),
    });
    expect(releaseBarnetSyncLock).toHaveBeenCalledWith("run-1");
  });
});
