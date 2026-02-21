/**
 * Deterministic tests for cairoTime shared helper
 * 
 * AC-5: Uses Settings.now for luxon-based functions,
 *        timestampMs param for Intl-based getCairoNow.
 *        Resets Settings.now = undefined after each test.
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Settings, DateTime } from "https://esm.sh/luxon@3.5.0";
import {
  getCairoNow,
  isCairoTimePastSessionEnd,
  getCairoTimeWindowDates,
  getCairoDatePlusDays,
  getCairoToday,
  getCairoCurrentMonth,
} from "./cairoTime.ts";

// ============================================================
// Group 1: getCairoNow (uses Intl, tested via timestampMs)
// ============================================================
Deno.test("getCairoNow: returns padded Cairo time for summer (UTC+3)", () => {
  // 2025-07-15 02:05:03 UTC = 2025-07-15 05:05:03 Cairo (EET summer = UTC+3)
  const ts = Date.UTC(2025, 6, 15, 2, 5, 3); // month is 0-indexed
  const now = getCairoNow(ts);

  assertEquals(now.today, "2025-07-15");
  assertEquals(now.timeHHMMSS, "05:05:03");
  assertEquals(now.timeHHMM, "05:05");
  assertEquals(now.hour, 5);
  assertEquals(now.minute, 5);
  assertEquals(now.second, 3);
  assertEquals(now.year, 2025);
  assertEquals(now.month, 7);
  assertEquals(now.day, 15);
});

Deno.test("getCairoNow: handles winter time (UTC+2)", () => {
  // 2025-01-15 23:30:00 UTC = 2025-01-16 01:30:00 Cairo (EET winter = UTC+2)
  const ts = Date.UTC(2025, 0, 15, 23, 30, 0);
  const now = getCairoNow(ts);

  assertEquals(now.today, "2025-01-16");
  assertEquals(now.timeHHMMSS, "01:30:00");
  assertEquals(now.hour, 1);
  assertEquals(now.day, 16);
});

Deno.test("getCairoNow: midnight boundary", () => {
  // 2025-03-01 22:00:00 UTC = 2025-03-02 00:00:00 Cairo (UTC+2 winter)
  const ts = Date.UTC(2025, 2, 1, 22, 0, 0);
  const now = getCairoNow(ts);

  assertEquals(now.today, "2025-03-02");
  assertEquals(now.timeHHMMSS, "00:00:00");
  assertEquals(now.hour, 0);
});

Deno.test("getCairoNow: pads single-digit values", () => {
  // 2025-02-03 01:02:04 UTC = 2025-02-03 03:02:04 Cairo (UTC+2)
  const ts = Date.UTC(2025, 1, 3, 1, 2, 4);
  const now = getCairoNow(ts);

  assertEquals(now.today, "2025-02-03");
  assertEquals(now.timeHHMMSS, "03:02:04");
});

// ============================================================
// Group 2: isCairoTimePastSessionEnd (uses luxon DateTime.now)
// ============================================================
Deno.test("isCairoTimePastSessionEnd: session ended (HH:MM:SS format)", () => {
  // Cairo time: 2025-07-15 12:00:00, session was 10:00:00 + 90min = ends 11:30
  Settings.now = () => Date.UTC(2025, 6, 15, 9, 0, 0); // 9 UTC = 12 Cairo summer
  try {
    const result = isCairoTimePastSessionEnd("2025-07-15", "10:00:00", 90);
    assert(result, "Session should be past end");
  } finally {
    Settings.now = undefined as unknown as typeof Settings.now;
  }
});

Deno.test("isCairoTimePastSessionEnd: session NOT ended (HH:MM format)", () => {
  // AC-2: HH:MM without seconds
  // Cairo time: 2025-07-15 11:00:00, session 10:00 + 90min = ends 11:30
  Settings.now = () => Date.UTC(2025, 6, 15, 8, 0, 0); // 8 UTC = 11 Cairo summer
  try {
    const result = isCairoTimePastSessionEnd("2025-07-15", "10:00", 90);
    assert(!result, "Session should NOT be past end yet");
  } finally {
    Settings.now = undefined as unknown as typeof Settings.now;
  }
});

Deno.test("isCairoTimePastSessionEnd: late night session crossing midnight", () => {
  // Session at 23:30 + 90min = ends 01:00 next day
  // Cairo now: 2025-07-16 01:30:00 (past end)
  Settings.now = () => Date.UTC(2025, 6, 15, 22, 30, 0); // 22:30 UTC = 01:30 Cairo next day summer
  try {
    const result = isCairoTimePastSessionEnd("2025-07-15", "23:30", 90);
    assert(result, "Midnight-crossing session should be past end");
  } finally {
    Settings.now = undefined as unknown as typeof Settings.now;
  }
});

Deno.test("isCairoTimePastSessionEnd: returns false for null/invalid inputs", () => {
  assert(!isCairoTimePastSessionEnd("", "10:00", 90));
  assert(!isCairoTimePastSessionEnd("2025-07-15", "", 90));
  assert(!isCairoTimePastSessionEnd("2025-07-15", "10:00", 0));
  assert(!isCairoTimePastSessionEnd("bad-date", "10:00", 90));
  assert(!isCairoTimePastSessionEnd("2025-07-15", "bad", 90));
});

// ============================================================
// Group 3: getCairoTimeWindowDates (AC-3: reminders window)
// ============================================================
Deno.test("getCairoTimeWindowDates: normal window (no midnight crossing)", () => {
  // Cairo time: 2025-07-15 14:30:00
  Settings.now = () => Date.UTC(2025, 6, 15, 11, 30, 0); // 11:30 UTC = 14:30 Cairo
  try {
    const window = getCairoTimeWindowDates(1);
    assertEquals(window.startDate, "2025-07-15");
    assertEquals(window.endDate, "2025-07-15");
    assertEquals(window.startTime, "14:30:00");
    assertEquals(window.endTime, "15:30:00");
    assert(!window.crossesMidnight);
  } finally {
    Settings.now = undefined as unknown as typeof Settings.now;
  }
});

Deno.test("getCairoTimeWindowDates: midnight crossing window", () => {
  // AC-3: Cairo time: 2025-07-15 23:40:00, +1h = 00:40:00 next day
  Settings.now = () => Date.UTC(2025, 6, 15, 20, 40, 0); // 20:40 UTC = 23:40 Cairo
  try {
    const window = getCairoTimeWindowDates(1);
    assertEquals(window.startDate, "2025-07-15");
    assertEquals(window.endDate, "2025-07-16");
    assertEquals(window.startTime, "23:40:00");
    assertEquals(window.endTime, "00:40:00");
    assert(window.crossesMidnight, "Should detect midnight crossing");
  } finally {
    Settings.now = undefined as unknown as typeof Settings.now;
  }
});

// ============================================================
// Group 4: Utility functions
// ============================================================
Deno.test("getCairoToday: returns correct Cairo date", () => {
  // 2025-01-15 23:00 UTC = 2025-01-16 01:00 Cairo (winter UTC+2)
  Settings.now = () => Date.UTC(2025, 0, 15, 23, 0, 0);
  try {
    assertEquals(getCairoToday(), "2025-01-16");
  } finally {
    Settings.now = undefined as unknown as typeof Settings.now;
  }
});

Deno.test("getCairoDatePlusDays: adds days in Cairo timezone", () => {
  // Cairo: 2025-01-16 01:00:00 → +5 days = 2025-01-21
  Settings.now = () => Date.UTC(2025, 0, 15, 23, 0, 0);
  try {
    assertEquals(getCairoDatePlusDays(5), "2025-01-21");
    assertEquals(getCairoDatePlusDays(-1), "2025-01-15");
  } finally {
    Settings.now = undefined as unknown as typeof Settings.now;
  }
});

Deno.test("getCairoCurrentMonth: returns yyyy-MM-01", () => {
  Settings.now = () => Date.UTC(2025, 6, 15, 12, 0, 0);
  try {
    assertEquals(getCairoCurrentMonth(), "2025-07-01");
  } finally {
    Settings.now = undefined as unknown as typeof Settings.now;
  }
});

Deno.test("getCairoCurrentMonth: month rollover at midnight Cairo", () => {
  // 2025-07-31 22:00 UTC = 2025-08-01 01:00 Cairo (summer UTC+3)
  Settings.now = () => Date.UTC(2025, 6, 31, 22, 0, 0);
  try {
    assertEquals(getCairoCurrentMonth(), "2025-08-01");
  } finally {
    Settings.now = undefined as unknown as typeof Settings.now;
  }
});
