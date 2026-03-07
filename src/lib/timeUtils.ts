import { APP_TIMEZONE } from './constants';
import { TZDate } from 'date-fns-tz';

// ============================================================
// Timezone Detection Helpers
// ============================================================

/**
 * Get the user's IANA timezone identifier.
 * Falls back to APP_TIMEZONE (Africa/Cairo) if detection fails.
 */
export function getUserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || APP_TIMEZONE;
  } catch {
    return APP_TIMEZONE;
  }
}

/**
 * Check if the user's timezone is Africa/Cairo.
 */
export function isCairoTimezone(): boolean {
  return getUserTimezone() === APP_TIMEZONE;
}

// ============================================================
// Session Time Formatting for Dual-Timezone Display
// ============================================================

/**
 * Build a Cairo-anchored Date from sessionDate + sessionTime.
 * sessionTime is stored as Cairo local time in the DB (NOT UTC).
 * We use TZDate from date-fns-tz to correctly represent this.
 */
function buildCairoDate(sessionDate: string, sessionTime: string): Date | null {
  if (!sessionDate || !sessionTime) return null;

  const dateParts = sessionDate.split('-');
  const timeParts = sessionTime.split(':');

  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10);
  const day = parseInt(dateParts[2], 10);
  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);

  if ([year, month, day, hour, minute].some(isNaN)) return null;

  // TZDate creates a Date anchored to the specified timezone
  // so hour=15 in Africa/Cairo means 15:00 Cairo local time
  return new TZDate(year, month - 1, day, hour, minute, 0, APP_TIMEZONE);
}

/**
 * Format a time for display in a specific timezone.
 */
function formatTimeInTz(date: Date, timezone: string, isRTL: boolean): string {
  return date.toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });
}

/**
 * Format session time for the viewer.
 * - If user is in Cairo: shows Cairo time only (e.g. "3:00 PM")
 * - If user is outside Cairo: shows local + Cairo reference
 *   (e.g. "10:00 AM (3:00 PM Cairo)")
 *
 * sessionDate + sessionTime are required together for DST-correct conversion.
 * If only time is available (e.g. schedule_time), pass getCairoToday() as
 * sessionDate — this is a display approximation for the current offset.
 *
 * @returns { cairoTime, localTime, showDual } object
 */
export function formatSessionTimeForViewer(
  sessionDate: string,
  sessionTime: string,
  isRTL: boolean
): { cairoTime: string; localTime: string; showDual: boolean } {
  if (!sessionDate || !sessionTime) {
    return { cairoTime: '-', localTime: '-', showDual: false };
  }

  const date = buildCairoDate(sessionDate, sessionTime);
  if (!date) {
    return { cairoTime: '-', localTime: '-', showDual: false };
  }

  const cairoTime = formatTimeInTz(date, APP_TIMEZONE, isRTL);
  const userTz = getUserTimezone();
  const showDual = !isCairoTimezone();
  const localTime = showDual ? formatTimeInTz(date, userTz, isRTL) : cairoTime;

  return { cairoTime, localTime, showDual };
}

/**
 * Format session date+time for the viewer (includes date).
 */
export function formatSessionDateTimeForViewer(
  sessionDate: string,
  sessionTime: string,
  isRTL: boolean
): { cairoDateTime: string; localDateTime: string; showDual: boolean } {
  if (!sessionDate || !sessionTime) {
    return { cairoDateTime: '-', localDateTime: '-', showDual: false };
  }

  const date = buildCairoDate(sessionDate, sessionTime);
  if (!date) {
    return { cairoDateTime: '-', localDateTime: '-', showDual: false };
  }

  const locale = isRTL ? 'ar-EG' : 'en-US';
  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  const cairoDateTime = date.toLocaleString(locale, { ...opts, timeZone: APP_TIMEZONE });
  const userTz = getUserTimezone();
  const showDual = !isCairoTimezone();
  const localDateTime = showDual ? date.toLocaleString(locale, { ...opts, timeZone: userTz }) : cairoDateTime;

  return { cairoDateTime, localDateTime, showDual };
}

/**
 * Convert 24-hour time format to 12-hour format with AM/PM
 * (Legacy fallback for non-session contexts)
 * @param time24 - Time in 24-hour format (HH:MM or HH:MM:SS)
 * @param isRTL - Whether to use Arabic labels
 * @returns Formatted time string in 12-hour format
 */
export function formatTime12Hour(time24: string, isRTL: boolean = false): string {
  if (!time24) return '';
  
  // Handle both HH:MM and HH:MM:SS formats
  const [hoursStr, minutesStr] = time24.split(':');
  let hours = parseInt(hoursStr, 10);
  const minutes = minutesStr;
  
  if (isNaN(hours)) return time24;
  
  const ampm = hours >= 12 
    ? (isRTL ? 'م' : 'PM') 
    : (isRTL ? 'ص' : 'AM');
  
  hours = hours % 12;
  hours = hours ? hours : 12; // Handle midnight (0 hours)
  
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Safely parse a date string, applying the "UTC noon trick" for date-only strings
 * to avoid timezone-shift issues (e.g. "2025-01-15" becoming Jan 14 in some timezones).
 */
function safeParseDateString(date: string): Date {
  // Date-only format: yyyy-MM-dd → append T12:00:00Z to avoid day shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Date(`${date}T12:00:00Z`);
  }
  return new Date(date);
}

/**
 * Format a date string to localized date (short format)
 * @param date - Date string or ISO date string
 * @param language - 'ar' or 'en'
 * @param timezone - IANA timezone identifier (defaults to APP_TIMEZONE)
 * @returns Formatted date string (e.g. "Jan 15, 2025" or "١٥ يناير ٢٠٢٥")
 */
export function formatDate(date: string, language: string = 'en', timezone: string = APP_TIMEZONE): string {
  if (!date) return '-';
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  };
  return safeParseDateString(date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', options);
}

/**
 * Format a date string to localized date with time
 * @param date - Date string or ISO date string
 * @param language - 'ar' or 'en'
 * @param timezone - IANA timezone identifier (defaults to APP_TIMEZONE)
 * @returns Formatted date+time string (e.g. "Jan 15, 2025, 02:30 PM")
 */
export function formatDateTime(date: string, language: string = 'en', timezone: string = APP_TIMEZONE): string {
  if (!date) return '-';
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  };
  return safeParseDateString(date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', options);
}

/**
 * Format a date string to localized time in 12-hour format
 * AC-6: hour12 always true, timeZone passed, locales ar-EG/en-US
 * @param dateString - ISO date string
 * @param isRTL - Whether to use Arabic format
 * @param timezone - IANA timezone identifier (defaults to APP_TIMEZONE)
 * @returns Formatted time string
 */
export function formatDateTime12Hour(dateString: string, isRTL: boolean = false, timezone: string = APP_TIMEZONE): string {
  const date = new Date(dateString);
  
  return date.toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });
}

/**
 * Get today's date string (YYYY-MM-DD) in Cairo timezone.
 * Uses Intl.DateTimeFormat to avoid relying on the browser's local timezone.
 */
export function getCairoToday(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

/**
 * Get a date string (YYYY-MM-DD) offset by N days from today in Cairo timezone.
 */
export function getCairoDateOffset(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}
