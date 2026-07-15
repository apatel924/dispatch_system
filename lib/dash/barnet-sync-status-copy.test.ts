import { describe, expect, it } from "vitest";
import {
  describeBarnetSyncResult,
  formatEdmontonExact,
  formatEdmontonRelative,
} from "@/lib/dash/barnet-sync-status-copy";

describe("barnet sync status copy", () => {
  it("formats relative and exact America/Edmonton timestamps", () => {
    const now = new Date("2026-07-14T20:00:00.000Z");
    const scanAt = "2026-07-14T19:45:00.000Z";
    expect(formatEdmontonRelative(scanAt, now)).toBe("15 minutes ago");
    expect(formatEdmontonExact(scanAt)).toMatch(/July 14, 2026/);
    expect(formatEdmontonExact(scanAt)).toMatch(/MDT|MST/);
  });

  it("describes zero-new as not a failure", () => {
    expect(
      describeBarnetSyncResult({ lastResult: "no_new_orders" }),
    ).toBe("Last scan found no new delivery orders");
    expect(
      describeBarnetSyncResult({ lastResult: "imported_new", inserted: 2 }),
    ).toBe("Last scan imported 2 new delivery orders");
    expect(
      describeBarnetSyncResult({ lastResult: "skipped_quiet_hours" }),
    ).toBe("Skipped during quiet hours");
    expect(
      describeBarnetSyncResult({ lastResult: "failed" }),
    ).toBe("Last scan failed");
    expect(
      describeBarnetSyncResult({ isRunning: true }),
    ).toBe("Sync currently running");
  });
});
