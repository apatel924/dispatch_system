import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY,
  getExternalOrderSyncPageConcurrency,
  MAX_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY,
} from "@/lib/integrations/order-provider/sync-pagination.server";
import { getBarnetSyncLockTtlMs, getBarnetUpstreamTimeoutMs } from "@/lib/integrations/order-provider/barnet-sync-config.server";

describe("barnet sync tuning defaults", () => {
  afterEach(() => {
    delete process.env.EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY;
    delete process.env.EXTERNAL_ORDER_SYNC_LOCK_TTL_MS;
    delete process.env.EXTERNAL_ORDER_UPSTREAM_TIMEOUT_MS;
  });

  it("defaults page concurrency to 3 and caps at 5", () => {
    expect(DEFAULT_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY).toBe(3);
    expect(getExternalOrderSyncPageConcurrency()).toBe(3);
    process.env.EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY = "99";
    expect(getExternalOrderSyncPageConcurrency()).toBe(
      MAX_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY,
    );
    expect(MAX_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY).toBe(5);
  });

  it("defaults upstream timeout to ~20s and lock TTL to 9 minutes", () => {
    expect(getBarnetUpstreamTimeoutMs()).toBe(20_000);
    expect(getBarnetSyncLockTtlMs()).toBe(9 * 60 * 1000);
  });
});
