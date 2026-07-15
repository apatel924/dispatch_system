import { describe, expect, it } from "vitest";
import { shouldRecordBarnetSyncHistoryDoc } from "@/lib/integrations/order-provider/barnet-sync-run.server";
import { BARNET_SYNC_RUN_HISTORY_LIMIT } from "@/lib/integrations/order-provider/barnet-sync-health.server";

describe("shouldRecordBarnetSyncHistoryDoc", () => {
  it("records the first quiet-hours skip", () => {
    expect(
      shouldRecordBarnetSyncHistoryDoc({
        status: "skipped_outside_hours",
        priorLastRunStatus: "success",
      }),
    ).toBe(true);
    expect(
      shouldRecordBarnetSyncHistoryDoc({
        status: "skipped_outside_hours",
        priorLastRunStatus: null,
      }),
    ).toBe(true);
  });

  it("does not record identical consecutive quiet-hours skips", () => {
    expect(
      shouldRecordBarnetSyncHistoryDoc({
        status: "skipped_outside_hours",
        priorLastRunStatus: "skipped_outside_hours",
      }),
    ).toBe(false);
  });

  it("records success and failure after a quiet-hours period", () => {
    expect(
      shouldRecordBarnetSyncHistoryDoc({
        status: "success",
        priorLastRunStatus: "skipped_outside_hours",
      }),
    ).toBe(true);
    expect(
      shouldRecordBarnetSyncHistoryDoc({
        status: "failed",
        priorLastRunStatus: "skipped_outside_hours",
      }),
    ).toBe(true);
    expect(
      shouldRecordBarnetSyncHistoryDoc({
        status: "partial",
        priorLastRunStatus: "skipped_outside_hours",
      }),
    ).toBe(true);
  });

  it("collapses consecutive locked / disabled skips", () => {
    expect(
      shouldRecordBarnetSyncHistoryDoc({
        status: "skipped_locked",
        priorLastRunStatus: "skipped_locked",
      }),
    ).toBe(false);
    expect(
      shouldRecordBarnetSyncHistoryDoc({
        status: "disabled",
        priorLastRunStatus: "disabled",
      }),
    ).toBe(false);
  });

  it("keeps history bound well below overnight quiet-hours tick volume", () => {
    // ~8.5h quiet window × 4 ticks/hour ≈ 34 skips — historically could flush a 25-cap.
    expect(BARNET_SYNC_RUN_HISTORY_LIMIT).toBe(25);
    const overnightTicks = 34;
    expect(overnightTicks).toBeGreaterThan(BARNET_SYNC_RUN_HISTORY_LIMIT);
    // With collapse, overnight contributes at most one history doc.
    expect(
      shouldRecordBarnetSyncHistoryDoc({
        status: "skipped_outside_hours",
        priorLastRunStatus: "skipped_outside_hours",
      }),
    ).toBe(false);
  });
});
