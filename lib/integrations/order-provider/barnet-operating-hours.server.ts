/**
 * Authoritative Barnet scan operating-hours gate.
 * Quiet window: 12:00 AM inclusive → 8:30 AM exclusive (America/Edmonton).
 * Uses Intl timezone math — never a fixed UTC offset (handles MST/MDT).
 */

import { DEFAULT_APP_TIMEZONE } from "@/lib/app-timezone";

export const BARNET_OPERATING_TIMEZONE = DEFAULT_APP_TIMEZONE;

/** Quiet window ends at 08:30 local; scanning allowed from this minute inclusive. */
export const BARNET_QUIET_END_MINUTE = 8 * 60 + 30; // 510

export const OUTSIDE_OPERATING_HOURS_REASON = "outside_operating_hours" as const;

export interface EdmontonClockParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** Minutes since local midnight [0, 1440). */
  minutesSinceMidnight: number;
}

function readEdmontonParts(now: Date): EdmontonClockParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BARNET_OPERATING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((p) => p.type === type)?.value;
    return Number(value ?? 0);
  };

  const hour = read("hour");
  const minute = read("minute");
  const second = read("second");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour,
    minute,
    second,
    minutesSinceMidnight: hour * 60 + minute,
  };
}

/** True when scanning is disabled ([00:00, 08:30) Edmonton). */
export function isWithinBarnetQuietHours(now: Date = new Date()): boolean {
  return readEdmontonParts(now).minutesSinceMidnight < BARNET_QUIET_END_MINUTE;
}

/** True when Barnet scanning is allowed (08:30 through end of local day). */
export function isBarnetScanningAllowed(now: Date = new Date()): boolean {
  return !isWithinBarnetQuietHours(now);
}

export function getEdmontonClockParts(now: Date = new Date()): EdmontonClockParts {
  return readEdmontonParts(now);
}

/**
 * Next local 08:30 America/Edmonton as a UTC Date.
 * If currently at/after 08:30 today, returns tomorrow 08:30.
 */
export function getNextBarnetOperatingWindowStart(now: Date = new Date()): Date {
  const parts = readEdmontonParts(now);
  const targetDay =
    parts.minutesSinceMidnight < BARNET_QUIET_END_MINUTE
      ? { year: parts.year, month: parts.month, day: parts.day }
      : addOneEdmontonCalendarDay(parts.year, parts.month, parts.day);

  return edmontonWallTimeToUtc(
    targetDay.year,
    targetDay.month,
    targetDay.day,
    8,
    30,
    0,
  );
}

function addOneEdmontonCalendarDay(
  year: number,
  month: number,
  day: number,
): { year: number; month: number; day: number } {
  // Noon Edmonton avoids DST edge ambiguities when stepping calendar days.
  const noon = edmontonWallTimeToUtc(year, month, day, 12, 0, 0);
  const next = new Date(noon.getTime() + 24 * 60 * 60 * 1000);
  const p = readEdmontonParts(next);
  return { year: p.year, month: p.month, day: p.day };
}

/**
 * Convert an America/Edmonton wall-clock time to a UTC Date via binary search
 * against Intl (correct across DST transitions).
 */
export function edmontonWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): Date {
  const targetKey = [
    year,
    month,
    day,
    hour,
    minute,
    second,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join("-");

  let low = Date.UTC(year, month - 1, day - 1);
  let high = Date.UTC(year, month - 1, day + 2);

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const p = readEdmontonParts(new Date(mid));
    const key = [
      p.year,
      p.month,
      p.day,
      p.hour,
      p.minute,
      p.second,
    ]
      .map((n) => String(n).padStart(2, "0"))
      .join("-");

    if (key < targetKey) low = mid + 1;
    else high = mid;
  }

  return new Date(low);
}
