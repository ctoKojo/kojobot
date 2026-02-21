/**
 * Cairo Timezone SSOT for Edge Functions
 * 
 * All time operations in edge functions MUST use this module.
 * Uses Africa/Cairo IANA identifier — never hardcoded UTC offsets.
 * 
 * Dependencies: luxon@3.5.0 (pinned)
 */

import { DateTime } from "https://esm.sh/luxon@3.5.0";

// ============================================================
// AC-1: Module-scope cached formatter (created once, reused)
// ============================================================
const cairoFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Cairo",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

// ============================================================
// Types
// ============================================================
export interface CairoNow {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** yyyy-MM-dd */
  today: string;
  /** HH:mm:ss */
  timeHHMMSS: string;
  /** HH:mm */
  timeHHMM: string;
}

export interface CairoTimeWindow {
  startDate: string;
  startTime: string; // HH:mm:ss
  endDate: string;
  endTime: string;   // HH:mm:ss
  crossesMidnight: boolean;
}

// ============================================================
// getCairoNow — pure Intl, no luxon dependency
// Accepts optional timestamp (ms) for deterministic testing
// ============================================================
const pad2 = (n: number): string => n.toString().padStart(2, "0");

export function getCairoNow(timestampMs?: number): CairoNow {
  const date = timestampMs != null ? new Date(timestampMs) : new Date();
  const parts = cairoFormatter.formatToParts(date);

  // AC-1: Filter literal parts, extract by type
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      map[p.type] = p.value;
    }
  }

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);
  const hour = parseInt(map.hour, 10);
  const minute = parseInt(map.minute, 10);
  const second = parseInt(map.second, 10);

  const today = `${year}-${pad2(month)}-${pad2(day)}`;
  const timeHHMMSS = `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
  const timeHHMM = `${pad2(hour)}:${pad2(minute)}`;

  return { year, month, day, hour, minute, second, today, timeHHMMSS, timeHHMM };
}

// ============================================================
// isCairoTimePastSessionEnd — uses luxon for date math
// AC-2: Handles HH:MM and HH:MM:SS, all values parsed as Number
// ============================================================
export function isCairoTimePastSessionEnd(
  sessionDate: string,
  sessionTime: string,
  durationMinutes: number
): boolean {
  if (!sessionDate || !sessionTime || !durationMinutes) return false;

  // AC-2: Split and fill missing second with 0
  const timeParts = sessionTime.split(":");
  const h = Number(timeParts[0]);
  const m = Number(timeParts[1]);
  const s = Number(timeParts[2] || "0");

  const dateParts = sessionDate.split("-");
  const year = Number(dateParts[0]);
  const month = Number(dateParts[1]);
  const day = Number(dateParts[2]);

  // Guard against NaN from malformed data
  if ([h, m, s, year, month, day].some(isNaN)) return false;

  const sessionStart = DateTime.fromObject(
    { year, month, day, hour: h, minute: m, second: s },
    { zone: "Africa/Cairo" }
  );

  if (!sessionStart.isValid) return false;

  const sessionEnd = sessionStart.plus({ minutes: durationMinutes });
  const now = DateTime.now().setZone("Africa/Cairo");

  return now >= sessionEnd;
}

// ============================================================
// getCairoDatePlusDays — for "yesterday", "5 days from now", etc.
// ============================================================
export function getCairoDatePlusDays(days: number): string {
  return DateTime.now()
    .setZone("Africa/Cairo")
    .plus({ days })
    .toFormat("yyyy-MM-dd");
}

// ============================================================
// getCairoToday — convenience wrapper
// ============================================================
export function getCairoToday(): string {
  return DateTime.now().setZone("Africa/Cairo").toFormat("yyyy-MM-dd");
}

// ============================================================
// getCairoCurrentMonth — returns yyyy-MM-01 for month grouping
// ============================================================
export function getCairoCurrentMonth(): string {
  const now = DateTime.now().setZone("Africa/Cairo");
  return `${now.toFormat("yyyy-MM")}-01`;
}

// ============================================================
// getCairoTimeWindowDates — for session-reminders window queries
// AC-3: Returns HH:mm:ss, uses gte/lt, handles midnight crossing
// ============================================================
export function getCairoTimeWindowDates(hoursAhead: number): CairoTimeWindow {
  const start = DateTime.now().setZone("Africa/Cairo");
  const end = start.plus({ hours: hoursAhead });

  const startDate = start.toFormat("yyyy-MM-dd");
  const endDate = end.toFormat("yyyy-MM-dd");

  return {
    startDate,
    startTime: start.toFormat("HH:mm:ss"),
    endDate,
    endTime: end.toFormat("HH:mm:ss"),
    crossesMidnight: startDate !== endDate,
  };
}
