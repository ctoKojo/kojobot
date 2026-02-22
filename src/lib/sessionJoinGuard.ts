/**
 * Cairo-based session join guard.
 * Determines whether a user can join a live session based on Cairo time.
 * Uses Intl.DateTimeFormat parts — same pattern as sessionTimeGuard.ts.
 */

type JoinReason = 'too_early' | 'on_time' | 'late' | 'too_late' | 'session_ended';
type AttendanceStatus = 'present' | 'late' | 'absent';
type UserRole = 'admin' | 'instructor' | 'student' | 'reception';

export interface SessionJoinStatus {
  canJoin: boolean;
  reason: JoinReason;
  attendanceStatus: AttendanceStatus | null;
  minutesUntilStart: number | null;
  minutesSinceStart: number | null;
}

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

/** Convert DateTimeParts to total minutes since midnight of a reference epoch day. */
function partsToTotalMinutes(p: DateTimeParts): number {
  // Simple: days since a reference * 1440 + hours * 60 + minutes
  // For comparing same-day or cross-midnight, we need absolute minutes.
  // Using a simplified epoch: days from year 2000
  const daysFromRef = daysSince2000(p.year, p.month, p.day);
  return daysFromRef * 1440 + p.hour * 60 + p.minute;
}

function daysSince2000(year: number, month: number, day: number): number {
  // Approximate but sufficient for minute-level comparison within a few days
  let total = 0;
  for (let y = 2000; y < year; y++) {
    total += isLeapYear(y) ? 366 : 365;
  }
  const monthDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (isLeapYear(year)) monthDays[2] = 29;
  for (let m = 1; m < month; m++) {
    total += monthDays[m];
  }
  total += day;
  return total;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function parseSessionStart(sessionDate: string, sessionTime: string): DateTimeParts | null {
  const dateParts = sessionDate.split('-');
  if (dateParts.length !== 3) return null;
  const year = Number(dateParts[0]);
  const month = Number(dateParts[1]);
  const day = Number(dateParts[2]);

  const timeParts = sessionTime.split(':');
  if (timeParts.length < 2) return null;
  const hour = Number(timeParts[0]);
  const minute = Number(timeParts[1]);
  const second = timeParts.length >= 3 ? Number(timeParts[2]) : 0;

  if ([year, month, day, hour, minute, second].some(Number.isNaN)) return null;

  return { year, month, day, hour, minute, second };
}

/**
 * Determine whether a user can join a live session and their attendance status.
 *
 * Rules:
 * - Student: too_early (before start), on_time (0-15min, present),
 *   late (15-20min, late), too_late (20min+ until end, absent viewer),
 *   session_ended (after end)
 * - Instructor: allowed 5min before start, no restrictions after
 * - Admin: always allowed
 */
export function getSessionJoinStatus(
  sessionDate: string | null | undefined,
  sessionTime: string | null | undefined,
  durationMinutes: number | null | undefined,
  role: UserRole,
): SessionJoinStatus {
  // Default: allow (safe fallback for missing data)
  if (!sessionDate || !sessionTime) {
    return { canJoin: true, reason: 'on_time', attendanceStatus: null, minutesUntilStart: null, minutesSinceStart: null };
  }

  const start = parseSessionStart(sessionDate, sessionTime);
  if (!start) {
    return { canJoin: true, reason: 'on_time', attendanceStatus: null, minutesUntilStart: null, minutesSinceStart: null };
  }

  const dur = durationMinutes != null && durationMinutes > 0 ? durationMinutes : 120;
  const now = getCairoNowParts();

  const nowMinutes = partsToTotalMinutes(now);
  const startMinutes = partsToTotalMinutes(start);
  const endMinutes = startMinutes + dur;

  const diff = nowMinutes - startMinutes; // positive = after start, negative = before start

  // Admin: always allowed
  if (role === 'admin') {
    return {
      canJoin: true,
      reason: diff < 0 ? 'too_early' : 'on_time',
      attendanceStatus: null,
      minutesUntilStart: diff < 0 ? -diff : null,
      minutesSinceStart: diff >= 0 ? diff : null,
    };
  }

  // Instructor: allowed 5 min before start
  if (role === 'instructor') {
    if (diff < -5) {
      return {
        canJoin: false,
        reason: 'too_early',
        attendanceStatus: null,
        minutesUntilStart: -diff,
        minutesSinceStart: null,
      };
    }
    return {
      canJoin: true,
      reason: diff < 0 ? 'too_early' : 'on_time',
      attendanceStatus: null,
      minutesUntilStart: diff < 0 ? -diff : null,
      minutesSinceStart: diff >= 0 ? diff : null,
    };
  }

  // Student rules
  if (nowMinutes >= endMinutes) {
    return {
      canJoin: false,
      reason: 'session_ended',
      attendanceStatus: null,
      minutesUntilStart: null,
      minutesSinceStart: diff,
    };
  }

  if (diff < 0) {
    return {
      canJoin: false,
      reason: 'too_early',
      attendanceStatus: null,
      minutesUntilStart: -diff,
      minutesSinceStart: null,
    };
  }

  if (diff <= 15) {
    return {
      canJoin: true,
      reason: 'on_time',
      attendanceStatus: 'present',
      minutesUntilStart: null,
      minutesSinceStart: diff,
    };
  }

  if (diff <= 20) {
    return {
      canJoin: true,
      reason: 'late',
      attendanceStatus: 'late',
      minutesUntilStart: null,
      minutesSinceStart: diff,
    };
  }

  // After 20 min but before session end: viewer mode, marked absent
  return {
    canJoin: true,
    reason: 'too_late',
    attendanceStatus: 'absent',
    minutesUntilStart: null,
    minutesSinceStart: diff,
  };
}
