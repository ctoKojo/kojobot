/**
 * Session Resolver — Single Source of Truth for "displayed session"
 *
 * Concept: A scheduled session may be overridden by a makeup session.
 * The makeup is NOT a separate session — it's a runtime override of the
 * original (different time / instructor / room) but identical content,
 * quizzes, assignments, attendance ledger, and progression impact.
 *
 *   resolveSession(original) =
 *     if a confirmed makeup exists for it → return overridden view
 *     else                                → return the original
 *
 * The DB id used for navigation/details is ALWAYS the original session id
 * (since attendance, content, and progress are all keyed off it).
 */

export interface RawSession {
  id: string;
  group_id: string;
  session_date: string;
  session_time: string;
  duration_minutes: number;
  topic: string | null;
  topic_ar: string | null;
  status: string;
  notes: string | null;
  session_number: number | null;
  content_number: number | null;
  attendance_mode?: string | null;
  session_link?: string | null;
}

export interface RawMakeupSession {
  id: string;
  original_session_id: string;
  group_id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string; // 'scheduled' | 'completed' | 'pending' | ...
  notes: string | null;
  assigned_instructor_id: string | null;
  student_confirmed?: boolean;
}

export interface ResolvedSession extends RawSession {
  /** True when a confirmed makeup session is overriding this row. */
  is_makeup: boolean;
  /** Source makeup session id (for cancel / reassign actions). */
  makeup_session_id: string | null;
  /** Original date/time before override — useful for "rescheduled from …" UI. */
  original_date?: string;
  original_time?: string;
  /** Number of distinct students attached to this override (collective vs individual). */
  makeup_student_count?: number;
}

/**
 * Group raw makeup rows by their logical "session occurrence":
 * same original session + group + date + time + instructor.
 * One occurrence may bundle several students (collective makeup).
 */
function groupMakeupOccurrences(
  makeups: RawMakeupSession[]
): Map<string, RawMakeupSession[]> {
  const map = new Map<string, RawMakeupSession[]>();
  for (const m of makeups) {
    if (!m.original_session_id) continue;
    const key = [
      m.group_id,
      m.original_session_id,
      m.scheduled_date,
      m.scheduled_time,
      m.assigned_instructor_id ?? '',
    ].join('|');
    const arr = map.get(key) ?? [];
    arr.push(m);
    map.set(key, arr);
  }
  return map;
}

/**
 * Pick the "winning" makeup occurrence per original_session_id.
 * If multiple exist, we prefer:
 *   1. Status 'scheduled' over 'completed' over others
 *   2. Soonest scheduled_date+time
 */
function pickWinningOverride(
  occurrences: RawMakeupSession[][]
): Map<string, RawMakeupSession[]> {
  const winners = new Map<string, RawMakeupSession[]>();
  const STATUS_RANK: Record<string, number> = {
    scheduled: 0,
    completed: 1,
    pending: 2,
  };

  for (const occ of occurrences) {
    const first = occ[0];
    const originalId = first.original_session_id;
    const existing = winners.get(originalId);
    if (!existing) {
      winners.set(originalId, occ);
      continue;
    }
    const a = existing[0];
    const b = first;
    const ra = STATUS_RANK[a.status] ?? 99;
    const rb = STATUS_RANK[b.status] ?? 99;
    if (rb < ra) {
      winners.set(originalId, occ);
      continue;
    }
    if (rb === ra) {
      const aKey = `${a.scheduled_date}T${a.scheduled_time}`;
      const bKey = `${b.scheduled_date}T${b.scheduled_time}`;
      if (bKey < aKey) winners.set(originalId, occ);
    }
  }
  return winners;
}

/**
 * Apply the makeup override on top of an original session.
 */
function applyOverride(
  original: RawSession,
  override: RawMakeupSession[]
): ResolvedSession {
  const winner = override[0];
  return {
    ...original,
    session_date: winner.scheduled_date,
    session_time: winner.scheduled_time,
    // The override represents the actual occurrence — its status reflects
    // the rescheduled event lifecycle (scheduled / completed / cancelled),
    // NOT the original session row (which may already be 'completed' when
    // a makeup is created from a cancellation/absence).
    status: winner.status || original.status,
    notes: winner.notes ?? original.notes,
    is_makeup: true,
    makeup_session_id: winner.id,
    original_date: original.session_date,
    original_time: original.session_time,
    makeup_student_count: override.length,
  };
}

/**
 * MAIN ENTRY: resolve a list of original sessions against confirmed makeups.
 *
 * Returns one logical row per session:
 *  - Sessions WITH a confirmed makeup are overridden (date/time/instructor swapped).
 *  - Sessions WITHOUT a makeup pass through unchanged.
 *  - Pure "orphan" makeups (no matching original in input) become standalone
 *    rows so collective makeups still surface even if the original isn't loaded.
 */
export function resolveSessions(
  sessions: RawSession[],
  makeups: RawMakeupSession[],
  options?: {
    /** Pre-fetched original session metadata for orphan makeups. */
    originalsLookup?: Map<string, Partial<RawSession>>;
  }
): ResolvedSession[] {
  const grouped = groupMakeupOccurrences(makeups);
  const winners = pickWinningOverride(Array.from(grouped.values()));

  const sessionIds = new Set(sessions.map((s) => s.id));
  const result: ResolvedSession[] = [];

  // 1. Resolve known sessions (override or pass-through)
  for (const s of sessions) {
    const override = winners.get(s.id);
    if (override) {
      result.push(applyOverride(s, override));
    } else {
      result.push({ ...s, is_makeup: false, makeup_session_id: null });
    }
  }

  // 2. Surface orphan makeups (their original isn't in the list)
  const lookup = options?.originalsLookup ?? new Map();
  for (const [originalId, occ] of winners.entries()) {
    if (sessionIds.has(originalId)) continue;
    const orig = lookup.get(originalId);
    if (!orig) continue;
    const winner = occ[0];
    result.push({
      id: originalId,
      group_id: winner.group_id,
      session_date: winner.scheduled_date,
      session_time: winner.scheduled_time,
      duration_minutes: orig.duration_minutes ?? 60,
      topic: orig.topic ?? null,
      topic_ar: orig.topic_ar ?? null,
      status: winner.status === 'completed' ? 'completed' : 'scheduled',
      notes: winner.notes ?? null,
      session_number: orig.session_number ?? null,
      content_number: orig.content_number ?? null,
      attendance_mode: orig.attendance_mode ?? null,
      session_link: orig.session_link ?? null,
      is_makeup: true,
      makeup_session_id: winner.id,
      original_date: undefined,
      original_time: undefined,
      makeup_student_count: occ.length,
    });
  }

  return result;
}

/**
 * Predicate helpers — the canonical way to ask "is this overridden?".
 */
export const isOverridden = (s: ResolvedSession): boolean => s.is_makeup;

/**
 * Display label for the override badge.
 */
export const getMakeupBadgeText = (
  s: ResolvedSession,
  isRTL: boolean
): string => {
  if (!s.is_makeup) return '';
  if (s.makeup_student_count && s.makeup_student_count > 1) {
    return isRTL
      ? `تعويضية (${s.makeup_student_count} طلاب)`
      : `Makeup (${s.makeup_student_count} students)`;
  }
  return isRTL ? 'تعويضية' : 'Makeup';
};
