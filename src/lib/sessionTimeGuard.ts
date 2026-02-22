/**
 * Cairo-based session end time guard.
 * Uses Intl.DateTimeFormat parts — no `new Date()` in completion decisions,
 * no Luxon on the frontend.
 */

interface DateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

// Module-scope formatter — created once
const cairoFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Cairo',
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** Extract Cairo now as numeric parts, ignoring literal parts. */
function getCairoNowParts(): DateTimeParts {
  const parts = cairoFormatter.formatToParts(new Date());
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = Number(p.value);
    }
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const table = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) return 29;
  return table[month] ?? 30;
}

/** Add arbitrary number of days, handling month/year rollovers. */
function addDaysToDate(
  year: number,
  month: number,
  day: number,
  daysToAdd: number,
): { year: number; month: number; day: number } {
  day += daysToAdd;
  while (day > daysInMonth(year, month)) {
    day -= daysInMonth(year, month);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return { year, month, day };
}

/**
 * Build session-end parts from date string, time string, and duration.
 * Returns null on any parse error so the caller defaults to "not ended".
 */
function buildSessionEndParts(
  sessionDate: string,
  sessionTime: string,
  durationMinutes: number | null | undefined,
): DateTimeParts | null {
  // Parse date
  const dateParts = sessionDate.split('-');
  if (dateParts.length !== 3) return null;
  const year = Number(dateParts[0]);
  const month = Number(dateParts[1]);
  const day = Number(dateParts[2]);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;

  // Parse time — supports HH:MM and HH:MM:SS
  const timeParts = sessionTime.split(':');
  if (timeParts.length < 2) return null;
  const hour = Number(timeParts[0]);
  const minute = Number(timeParts[1]);
  const second = timeParts.length >= 3 ? Number(timeParts[2]) : 0;
  if (Number.isNaN(hour) || Number.isNaN(minute) || Number.isNaN(second)) return null;

  // Safe duration
  const dur = durationMinutes != null && durationMinutes > 0 ? durationMinutes : 120;

  // Add duration with carry
  let endSecond = second;
  let endMinute = minute + dur;
  let endHour = hour;

  // second -> minute carry (second is always 0 from duration, but keep generic)
  endMinute += Math.floor(endSecond / 60);
  endSecond = endSecond % 60;

  // minute -> hour carry
  endHour += Math.floor(endMinute / 60);
  endMinute = endMinute % 60;

  // hour -> day carry
  const daysToAdd = Math.floor(endHour / 24);
  endHour = endHour % 24;

  const endDate = addDaysToDate(year, month, day, daysToAdd);

  return {
    year: endDate.year,
    month: endDate.month,
    day: endDate.day,
    hour: endHour,
    minute: endMinute,
    second: endSecond,
  };
}

/** Numeric lexicographic comparison. Returns negative / 0 / positive. */
function compareParts(a: DateTimeParts, b: DateTimeParts): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day !== b.day) return a.day - b.day;
  if (a.hour !== b.hour) return a.hour - b.hour;
  if (a.minute !== b.minute) return a.minute - b.minute;
  return a.second - b.second;
}

/**
 * Returns true when the current Cairo time is **at or past** the session end time.
 * Safe: returns false on missing/invalid inputs (never causes accidental completion).
 */
export function isSessionEndedCairo(
  sessionDate: string | null | undefined,
  sessionTime: string | null | undefined,
  durationMinutes?: number | null,
): boolean {
  if (!sessionDate || !sessionTime) return false;

  const end = buildSessionEndParts(sessionDate, sessionTime, durationMinutes);
  if (!end) return false;

  return compareParts(getCairoNowParts(), end) >= 0;
}

/**
 * Returns true when the current Cairo time is within the session window:
 *   start <= now < end
 * Safe: returns false on missing/invalid inputs (never allows accidental assignment).
 */
export function isSessionActiveCairo(
  sessionDate: string | null | undefined,
  sessionTime: string | null | undefined,
  durationMinutes?: number | null,
): boolean {
  if (!sessionDate || !sessionTime) return false;

  // Build start parts
  const dateParts = sessionDate.split('-');
  if (dateParts.length !== 3) return false;
  const year = Number(dateParts[0]);
  const month = Number(dateParts[1]);
  const day = Number(dateParts[2]);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return false;

  const timeParts = sessionTime.split(':');
  if (timeParts.length < 2) return false;
  const hour = Number(timeParts[0]);
  const minute = Number(timeParts[1]);
  const second = timeParts.length >= 3 ? Number(timeParts[2]) : 0;
  if (Number.isNaN(hour) || Number.isNaN(minute) || Number.isNaN(second)) return false;

  const start: DateTimeParts = { year, month, day, hour, minute, second };

  const end = buildSessionEndParts(sessionDate, sessionTime, durationMinutes);
  if (!end) return false;

  const now = getCairoNowParts();
  return compareParts(now, start) >= 0 && compareParts(now, end) < 0;
}
