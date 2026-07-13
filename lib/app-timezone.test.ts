import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_APP_TIMEZONE,
  addLocalDays,
  getAppTimeZone,
  isInLocalDayRange,
  isOnLocalDay,
  localDayEndExclusiveUtcIso,
  localDayKey,
  localDayStartUtcIso,
  utcRangeForLocalDayKeys,
} from "@/lib/app-timezone";

const EDMONTON = "America/Edmonton";

describe("app-timezone (America/Edmonton)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to America/Edmonton", () => {
    expect(getAppTimeZone()).toBe(DEFAULT_APP_TIMEZONE);
    expect(DEFAULT_APP_TIMEZONE).toBe("America/Edmonton");
  });

  it("reads APP_TIMEZONE when set", () => {
    vi.stubEnv("APP_TIMEZONE", "America/Toronto");
    expect(getAppTimeZone()).toBe("America/Toronto");
  });

  describe("winter (MST, UTC-7)", () => {
    const winterDay = "2026-01-15";

    it("maps UTC boundaries to the Edmonton calendar day", () => {
      expect(localDayStartUtcIso(winterDay, EDMONTON)).toBe("2026-01-15T07:00:00.000Z");
      expect(localDayEndExclusiveUtcIso(winterDay, EDMONTON)).toBe("2026-01-16T07:00:00.000Z");
    });

    it("assigns timestamps near local midnight to the correct day", () => {
      expect(localDayKey("2026-01-16T06:59:59.000Z", EDMONTON)).toBe("2026-01-15");
      expect(localDayKey("2026-01-16T07:00:00.000Z", EDMONTON)).toBe("2026-01-16");
      expect(isOnLocalDay("2026-01-16T06:59:59.000Z", winterDay, EDMONTON)).toBe(true);
      expect(isOnLocalDay("2026-01-16T07:00:00.000Z", winterDay, EDMONTON)).toBe(false);
    });
  });

  describe("summer (MDT, UTC-6)", () => {
    const summerDay = "2026-07-13";

    it("maps UTC boundaries to the Edmonton calendar day", () => {
      expect(localDayStartUtcIso(summerDay, EDMONTON)).toBe("2026-07-13T06:00:00.000Z");
      expect(localDayEndExclusiveUtcIso(summerDay, EDMONTON)).toBe("2026-07-14T06:00:00.000Z");
    });

    it("assigns timestamps near local midnight to the correct day", () => {
      expect(localDayKey("2026-07-14T05:59:59.000Z", EDMONTON)).toBe("2026-07-13");
      expect(localDayKey("2026-07-14T06:00:00.000Z", EDMONTON)).toBe("2026-07-14");
    });
  });

  describe("DST transitions", () => {
    it("spring forward (2026-03-08): local day is 23 hours", () => {
      const springDay = "2026-03-08";
      const start = localDayStartUtcIso(springDay, EDMONTON);
      const end = localDayEndExclusiveUtcIso(springDay, EDMONTON);
      const hours = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
      expect(hours).toBe(23);
      expect(localDayKey("2026-03-08T07:00:00.000Z", EDMONTON)).toBe("2026-03-08");
    });

    it("fall back (2026-11-01): local day is 25 hours", () => {
      const fallDay = "2026-11-01";
      const start = localDayStartUtcIso(fallDay, EDMONTON);
      const end = localDayEndExclusiveUtcIso(fallDay, EDMONTON);
      const hours = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
      expect(hours).toBe(25);
      expect(localDayKey("2026-11-01T06:00:00.000Z", EDMONTON)).toBe("2026-11-01");
    });
  });

  it("builds inclusive local day ranges as UTC half-open intervals", () => {
    const range = utcRangeForLocalDayKeys("2026-01-14", "2026-01-15", EDMONTON);
    expect(range.startUtcIso).toBe("2026-01-14T07:00:00.000Z");
    expect(range.endExclusiveUtcIso).toBe("2026-01-16T07:00:00.000Z");
    expect(isInLocalDayRange("2026-01-15T12:00:00.000Z", "2026-01-14", "2026-01-15", EDMONTON)).toBe(
      true,
    );
    expect(isInLocalDayRange("2026-01-16T07:00:00.000Z", "2026-01-14", "2026-01-15", EDMONTON)).toBe(
      false,
    );
  });

  it("adds calendar days to day keys", () => {
    expect(addLocalDays("2026-01-31", 1)).toBe("2026-02-01");
  });
});
