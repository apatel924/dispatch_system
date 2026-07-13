/**
 * Application timezone for operational calendar boundaries.
 * Defaults to America/Edmonton (Quick Run Express HQ). Override with APP_TIMEZONE.
 * Uses Intl — never a fixed UTC offset (handles MST/MDT transitions).
 */

export const DEFAULT_APP_TIMEZONE = "America/Edmonton";

/** Server reads APP_TIMEZONE; client code uses DEFAULT_APP_TIMEZONE unless passed explicitly. */
export function getAppTimeZone(): string {
  return process.env.APP_TIMEZONE ?? DEFAULT_APP_TIMEZONE;
}

const dayKeyFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

/** Local calendar day key (YYYY-MM-DD) for an ISO timestamp. */
export function localDayKey(iso: string, timeZone = getAppTimeZone()): string {
  return dayKeyFormatter(timeZone).format(new Date(iso));
}

/** Local calendar day key for the current instant. */
export function todayLocalDayKey(now = new Date(), timeZone = getAppTimeZone()): string {
  return localDayKey(now.toISOString(), timeZone);
}

/** Add calendar days to a YYYY-MM-DD key (timezone-agnostic date arithmetic). */
export function addLocalDays(dayKey: string, days: number): string {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** UTC instant for 00:00:00.000 on dayKey in the given IANA timezone. */
export function localDayStartUtcIso(dayKey: string, timeZone = getAppTimeZone()): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  let low = Date.UTC(year, month - 1, day - 2);
  let high = Date.UTC(year, month - 1, day + 2);

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midKey = localDayKey(new Date(mid).toISOString(), timeZone);
    if (midKey < dayKey) low = mid + 1;
    else high = mid;
  }

  return new Date(low).toISOString();
}

/** Exclusive UTC instant for the start of the next local calendar day. */
export function localDayEndExclusiveUtcIso(dayKey: string, timeZone = getAppTimeZone()): string {
  return localDayStartUtcIso(addLocalDays(dayKey, 1), timeZone);
}

export interface LocalDayUtcRange {
  startUtcIso: string;
  endExclusiveUtcIso: string;
}

/** Inclusive local day range converted to a UTC half-open interval [start, end). */
export function utcRangeForLocalDayKeys(
  fromDayKey: string,
  toDayKey: string,
  timeZone = getAppTimeZone(),
): LocalDayUtcRange {
  return {
    startUtcIso: localDayStartUtcIso(fromDayKey, timeZone),
    endExclusiveUtcIso: localDayEndExclusiveUtcIso(toDayKey, timeZone),
  };
}

/** UTC range for a single local calendar day. */
export function utcRangeForLocalDay(
  dayKey: string,
  timeZone = getAppTimeZone(),
): LocalDayUtcRange {
  return utcRangeForLocalDayKeys(dayKey, dayKey, timeZone);
}

/** Start of the current local calendar day as a UTC Date. */
export function startOfLocalDay(now = new Date(), timeZone = getAppTimeZone()): Date {
  return new Date(localDayStartUtcIso(todayLocalDayKey(now, timeZone), timeZone));
}

export function isOnLocalDay(
  iso: string,
  dayKey: string,
  timeZone = getAppTimeZone(),
): boolean {
  return localDayKey(iso, timeZone) === dayKey;
}

export function isInLocalDayRange(
  iso: string,
  fromDayKey: string,
  toDayKey: string,
  timeZone = getAppTimeZone(),
): boolean {
  const key = localDayKey(iso, timeZone);
  return key >= fromDayKey && key <= toDayKey;
}

export function isOnOrAfterLocalDay(iso?: string, timeZone = getAppTimeZone()): boolean {
  if (!iso) return false;
  const todayKey = todayLocalDayKey(new Date(), timeZone);
  return localDayKey(iso, timeZone) >= todayKey;
}
