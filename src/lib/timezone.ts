/**
 * The business operates out of Zimbabwe (Africa/Harare), which has used a
 * fixed UTC+2 offset with no daylight saving for its entire history — so a
 * plain constant is just as correct as pulling in a timezone library, with
 * none of the bundle weight. If the business ever needs multiple timezones,
 * swap these for an IANA-aware helper (e.g. via Intl.DateTimeFormat with a
 * `timeZone` option) instead of adjusting the constant.
 *
 * This matters anywhere a "calendar day" boundary is used for page-view
 * stats — e.g. "Today"/"This month" ranges, or bucketing views by day.
 * Without it, day boundaries are computed in UTC, which is 2 hours behind
 * Harare: a view at 11:30pm local time would land in "tomorrow"'s bucket.
 */
export const BUSINESS_TZ_OFFSET_MINUTES = 120; // UTC+2, Africa/Harare

/** UTC instant of local midnight for a "YYYY-MM-DD" calendar date — the
 *  start of that day, as seen by someone in Harare. */
export function localDayStartUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000+02:00`);
}

/** UTC instant of the last millisecond of that local day. */
export function localDayEndUTC(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999+02:00`);
}

/** Given a UTC timestamp (e.g. a Postgres `timestamptz` as ISO text),
 *  returns the "YYYY-MM-DD" calendar date it falls on in the business's
 *  local time — not the UTC calendar date, which can be a day off near
 *  midnight. */
export function toLocalDateKey(isoUtc: string): string {
  const shifted = new Date(new Date(isoUtc).getTime() + BUSINESS_TZ_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** Adds `days` to a "YYYY-MM-DD" calendar date string. Pure calendar
 *  arithmetic — no timezone involved, since it's just "which date is N
 *  days after this one". */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}