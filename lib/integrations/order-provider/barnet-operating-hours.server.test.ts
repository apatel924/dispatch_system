import { describe, expect, it } from "vitest";
import {
  edmontonWallTimeToUtc,
  getEdmontonClockParts,
  getNextBarnetOperatingWindowStart,
  isBarnetScanningAllowed,
  isWithinBarnetQuietHours,
  OUTSIDE_OPERATING_HOURS_REASON,
} from "@/lib/integrations/order-provider/barnet-operating-hours.server";

describe("Barnet operating hours (America/Edmonton)", () => {
  it("treats 00:00 as quiet", () => {
    const winter = edmontonWallTimeToUtc(2026, 1, 15, 0, 0, 0);
    const summer = edmontonWallTimeToUtc(2026, 7, 14, 0, 0, 0);
    expect(isWithinBarnetQuietHours(winter)).toBe(true);
    expect(isBarnetScanningAllowed(winter)).toBe(false);
    expect(isWithinBarnetQuietHours(summer)).toBe(true);
  });

  it("treats 08:29 as quiet", () => {
    const t = edmontonWallTimeToUtc(2026, 7, 14, 8, 29, 0);
    expect(getEdmontonClockParts(t).minutesSinceMidnight).toBe(8 * 60 + 29);
    expect(isWithinBarnetQuietHours(t)).toBe(true);
    expect(isBarnetScanningAllowed(t)).toBe(false);
  });

  it("treats 08:30 as allowed", () => {
    const t = edmontonWallTimeToUtc(2026, 7, 14, 8, 30, 0);
    expect(getEdmontonClockParts(t).minutesSinceMidnight).toBe(8 * 60 + 30);
    expect(isWithinBarnetQuietHours(t)).toBe(false);
    expect(isBarnetScanningAllowed(t)).toBe(true);
  });

  it("treats 12:00 as allowed", () => {
    const t = edmontonWallTimeToUtc(2026, 7, 14, 12, 0, 0);
    expect(isBarnetScanningAllowed(t)).toBe(true);
  });

  it("treats 23:59 as allowed", () => {
    const t = edmontonWallTimeToUtc(2026, 7, 14, 23, 59, 0);
    expect(isBarnetScanningAllowed(t)).toBe(true);
  });

  it("handles DST spring-forward day correctly", () => {
    // 2026-03-08 America/Edmonton springs forward; 08:30 still maps by wall clock.
    const before = edmontonWallTimeToUtc(2026, 3, 8, 8, 29, 0);
    const after = edmontonWallTimeToUtc(2026, 3, 8, 8, 30, 0);
    expect(isWithinBarnetQuietHours(before)).toBe(true);
    expect(isBarnetScanningAllowed(after)).toBe(true);
  });

  it("handles DST fall-back day correctly", () => {
    const before = edmontonWallTimeToUtc(2026, 11, 1, 8, 29, 0);
    const after = edmontonWallTimeToUtc(2026, 11, 1, 8, 30, 0);
    expect(isWithinBarnetQuietHours(before)).toBe(true);
    expect(isBarnetScanningAllowed(after)).toBe(true);
  });

  it("computes next operating window start during quiet hours", () => {
    const quiet = edmontonWallTimeToUtc(2026, 7, 14, 2, 0, 0);
    const next = getNextBarnetOperatingWindowStart(quiet);
    expect(getEdmontonClockParts(next)).toMatchObject({
      year: 2026,
      month: 7,
      day: 14,
      hour: 8,
      minute: 30,
    });
  });

  it("exports machine-readable quiet-hours reason", () => {
    expect(OUTSIDE_OPERATING_HOURS_REASON).toBe("outside_operating_hours");
  });
});
