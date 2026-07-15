import { describe, expect, it } from "vitest";
import {
  BARNET_SYNC_CONSECUTIVE_FAILURE_THRESHOLD,
  BARNET_SYNC_STALE_AFTER_MS,
  deriveBarnetSyncHealth,
  resolveBarnetSyncRunStatus,
  type BarnetSyncHealthSnapshot,
} from "@/lib/integrations/order-provider/barnet-sync-health.server";

function snapshot(
  overrides: Partial<BarnetSyncHealthSnapshot> = {},
): BarnetSyncHealthSnapshot {
  return {
    providerConfigured: true,
    providerReadEnabled: true,
    liveSyncEnabled: true,
    mode: "live",
    lastAttemptedSyncAt: null,
    lastSuccessfulSyncAt: null,
    lastRunStatus: null,
    lastRunSource: null,
    lastDurationMs: null,
    lastSafeErrorMessage: null,
    lastErrorCode: null,
    consecutiveFailures: 0,
    lockRunId: null,
    lockExpiresAt: null,
    lockSource: null,
    lastCounts: null,
    outsideOperatingHours: false,
    ...overrides,
  };
}

describe("deriveBarnetSyncHealth", () => {
  const now = new Date("2026-07-14T18:00:00.000Z");

  it("returns never_run when no attempts exist", () => {
    const health = deriveBarnetSyncHealth(snapshot(), { now });
    expect(health.state).toBe("never_run");
  });

  it("returns healthy for a recent success inside hours", () => {
    const health = deriveBarnetSyncHealth(
      snapshot({
        lastSuccessfulSyncAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
        lastAttemptedSyncAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
        lastRunStatus: "success",
      }),
      { now },
    );
    expect(health.state).toBe("healthy");
  });

  it("returns running", () => {
    const health = deriveBarnetSyncHealth(
      snapshot({
        lastRunStatus: "running",
        lockRunId: "run-1",
        lockExpiresAt: new Date(now.getTime() + 60_000).toISOString(),
      }),
      { now },
    );
    expect(health.state).toBe("running");
    expect(health.isRunning).toBe(true);
  });

  it("returns outside_hours as informational during quiet window", () => {
    const health = deriveBarnetSyncHealth(
      snapshot({
        outsideOperatingHours: true,
        lastSuccessfulSyncAt: new Date(now.getTime() - 2 * 60 * 60_000).toISOString(),
        lastRunStatus: "success",
      }),
      { now },
    );
    expect(health.state).toBe("outside_hours");
  });

  it("returns stale when success is older than threshold during hours", () => {
    const health = deriveBarnetSyncHealth(
      snapshot({
        lastSuccessfulSyncAt: new Date(
          now.getTime() - BARNET_SYNC_STALE_AFTER_MS - 1,
        ).toISOString(),
        lastRunStatus: "success",
      }),
      { now },
    );
    expect(health.state).toBe("stale");
  });

  it("returns degraded for partial runs", () => {
    const health = deriveBarnetSyncHealth(
      snapshot({
        lastSuccessfulSyncAt: new Date(now.getTime() - 60_000).toISOString(),
        lastRunStatus: "partial",
      }),
      { now },
    );
    expect(health.state).toBe("degraded");
  });

  it("returns failed for latest failure", () => {
    const health = deriveBarnetSyncHealth(
      snapshot({
        lastSuccessfulSyncAt: new Date(now.getTime() - 60_000).toISOString(),
        lastRunStatus: "failed",
        lastSafeErrorMessage: "Synchronization failed.",
      }),
      { now },
    );
    expect(health.state).toBe("failed");
  });

  it("returns failed when consecutive failures exceed threshold", () => {
    const health = deriveBarnetSyncHealth(
      snapshot({
        lastSuccessfulSyncAt: new Date(now.getTime() - 60_000).toISOString(),
        lastRunStatus: "success",
        consecutiveFailures: BARNET_SYNC_CONSECUTIVE_FAILURE_THRESHOLD,
      }),
      { now },
    );
    expect(health.state).toBe("failed");
  });

  it("returns locked when another run holds an unexpired lock", () => {
    const health = deriveBarnetSyncHealth(
      snapshot({
        lastRunStatus: "success",
        lastSuccessfulSyncAt: new Date(now.getTime() - 60_000).toISOString(),
        lockRunId: "other",
        lockExpiresAt: new Date(now.getTime() + 120_000).toISOString(),
      }),
      { now },
    );
    expect(health.state).toBe("locked");
  });

  it("returns disabled / not_configured", () => {
    expect(
      deriveBarnetSyncHealth(snapshot({ liveSyncEnabled: false }), { now }).state,
    ).toBe("disabled");
    expect(
      deriveBarnetSyncHealth(snapshot({ mode: "mock" }), { now }).state,
    ).toBe("not_configured");
  });
});

describe("resolveBarnetSyncRunStatus", () => {
  it("marks partial when order-level errors exist", () => {
    expect(
      resolveBarnetSyncRunStatus({
        failedHard: false,
        enrichmentErrors: 1,
        syncErrors: 0,
        invalid: 0,
      }),
    ).toBe("partial");
  });

  it("marks success when clean", () => {
    expect(
      resolveBarnetSyncRunStatus({
        failedHard: false,
        enrichmentErrors: 0,
        syncErrors: 0,
        invalid: 0,
      }),
    ).toBe("success");
  });
});
