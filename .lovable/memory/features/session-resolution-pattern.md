---
name: Session Resolution Pattern
description: Original sessions + makeup overrides resolved into single logical row via resolveSessions() helper — no duplicates, no missing rows
type: feature
---

# Session Resolution (Override Layer)

## Concept
A scheduled `session` may be overridden by a confirmed `makeup_session`.
The makeup is **NOT** a separate session — it's a runtime override of the
original (different time / instructor / room) but identical content,
quizzes, assignments, attendance ledger, and progression impact.

```
resolveSession(original) =
  if confirmed makeup exists → return overridden view (date/time/instructor swapped)
  else                       → return original unchanged
```

## Source of Truth
`src/lib/sessionResolver.ts` exports:
- `resolveSessions(sessions, makeups, { originalsLookup })` → `ResolvedSession[]`
- `getMakeupBadgeText(s, isRTL)` → "تعويضية" or "تعويضية (3 طلاب)" for collective
- `ResolvedSession` interface — extends raw with `is_makeup`, `makeup_session_id`, `original_date`, `original_time`, `makeup_student_count`

## Usage Rule
- **Sessions list / Today / Upcoming**: use `resolveSessions()` so overridden rows display the makeup's date/time, NOT the original's.
- **Identity**: navigation always uses original session id (`/session/${s.id}`). Attendance, content, and progression are all keyed off it.
- **Original visibility**: when overridden, original disappears from "Today/Upcoming" but remains addressable in "All/History" (its date is in the past).
- **MySessions (student history)**: does NOT need the resolver — it shows attended sessions where `compensation_status='compensated'` already marks makeup attendance correctly on the original session row.

## Collective Makeups
Multiple students sharing one makeup occurrence (same group + original + date + time + instructor) collapse to one row with `makeup_student_count > 1`.

## Why this pattern
Replaces the brittle "merge two row sets + dedup" approach that caused duplicate rows or disappearing sessions when filtering by date.
