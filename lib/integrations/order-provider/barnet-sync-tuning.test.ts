import { afterEach, describe, expect, it } from "vitest";
import {
  BARNET_UPSTREAM_TIMEOUT_DEFAULT_MS,
  BARNET_UPSTREAM_TIMEOUT_MAX_MS,
  BARNET_UPSTREAM_TIMEOUT_MIN_MS,
  getBarnetSyncLockTtlMs,
  getBarnetUpstreamTimeoutMs,
} from "@/lib/integrations/order-provider/barnet-sync-config.server";
import {
  DEFAULT_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY,
  getExternalOrderSyncPageConcurrency,
  getExternalOrderSyncPageConcurrencyConfig,
  MAX_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY,
} from "@/lib/integrations/order-provider/sync-pagination.server";

describe("barnet sync tuning defaults", () => {
  afterEach(() => {
    delete process.env.EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY;
    delete process.env.EXTERNAL_ORDER_SYNC_LOCK_TTL_MS;
    delete process.env.EXTERNAL_ORDER_SYNC_UPSTREAM_TIMEOUT_MS;
    delete process.env.EXTERNAL_ORDER_UPSTREAM_TIMEOUT_MS;
  });

  it("defaults page concurrency to 1 and caps at 2", () => {
    expect(DEFAULT_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY).toBe(1);
    expect(getExternalOrderSyncPageConcurrency()).toBe(1);
    const config = getExternalOrderSyncPageConcurrencyConfig();
    expect(config.requestedConcurrency).toBe(1);
    expect(config.effectiveConcurrency).toBe(1);

    process.env.EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY = "99";
    const capped = getExternalOrderSyncPageConcurrencyConfig();
    expect(capped.requestedConcurrency).toBe(99);
    expect(capped.effectiveConcurrency).toBe(MAX_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY);
    expect(MAX_EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY).toBe(2);
  });

  it("treats invalid concurrency values as the default", () => {
    for (const invalid of ["0", "-1", "NaN", "abc", ""]) {
      process.env.EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY = invalid;
      expect(getExternalOrderSyncPageConcurrency()).toBe(1);
    }
    delete process.env.EXTERNAL_ORDER_SYNC_PAGE_CONCURRENCY;
    expect(getExternalOrderSyncPageConcurrency()).toBe(1);
  });

  it("defaults upstream timeout to 40s, clamps invalid values, and prefers EXTERNAL_ORDER_SYNC_UPSTREAM_TIMEOUT_MS", () => {
    expect(getBarnetUpstreamTimeoutMs()).toBe(BARNET_UPSTREAM_TIMEOUT_DEFAULT_MS);
    expect(BARNET_UPSTREAM_TIMEOUT_DEFAULT_MS).toBe(40_000);

    process.env.EXTERNAL_ORDER_SYNC_UPSTREAM_TIMEOUT_MS = "999999";
    expect(getBarnetUpstreamTimeoutMs()).toBe(BARNET_UPSTREAM_TIMEOUT_MAX_MS);

    process.env.EXTERNAL_ORDER_SYNC_UPSTREAM_TIMEOUT_MS = "1";
    expect(getBarnetUpstreamTimeoutMs()).toBe(BARNET_UPSTREAM_TIMEOUT_DEFAULT_MS);

    process.env.EXTERNAL_ORDER_SYNC_UPSTREAM_TIMEOUT_MS = "abc";
    expect(getBarnetUpstreamTimeoutMs()).toBe(BARNET_UPSTREAM_TIMEOUT_DEFAULT_MS);

    delete process.env.EXTERNAL_ORDER_SYNC_UPSTREAM_TIMEOUT_MS;
    process.env.EXTERNAL_ORDER_UPSTREAM_TIMEOUT_MS = "15000";
    expect(getBarnetUpstreamTimeoutMs()).toBe(15_000);
    expect(BARNET_UPSTREAM_TIMEOUT_MIN_MS).toBe(10_000);
  });

  it("defaults lock TTL to 9 minutes", () => {
    expect(getBarnetSyncLockTtlMs()).toBe(9 * 60 * 1000);
  });
});
