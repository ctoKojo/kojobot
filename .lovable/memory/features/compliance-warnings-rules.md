---
name: compliance-warnings-rules
description: V3 — Compliance monitor مع makeup-aware grace, end_at من DB, settings versioning, trace_id لكل run/warning, anti-spam dedup, auto-resolve triggers
type: feature
---

# Compliance Warnings — V3 Production Hardened

## Grace Periods (settings-driven)
- مصدر القيم: `system_settings.value` تحت `key='compliance_grace_periods'`.
- المفاتيح: `attendance_minutes`, `quiz_hours`, `assignment_hours`, `evaluation_hours`, `makeup_multiplier` (1.0–3.0).
- Validation trigger `validate_grace_settings` يفرض الحدود ويزيد `version` تلقائياً.
- التعديل: admin فقط، RLS ينفذ ذلك. Audit في `activity_logs` بـ `trace_id`.

## Time Source of Truth
- `sessions.start_at` و `sessions.end_at` — `TIMESTAMPTZ` يحسبهم trigger `compute_session_time_bounds` (BEFORE INSERT/UPDATE) بصيغة `local Cairo - INTERVAL '3 hours'` → UTC.
- الـ edge function يقرأ `end_at` مباشرة (مش يحسبه في JS) — مفيش timezone bugs ولا NaN.
- `duration_minutes`: `NOT NULL DEFAULT 60 CHECK > 0 AND ≤ 480`.

## Makeup-aware Logic
- `effectiveGraceSeconds = base * makeup_multiplier` لو `is_makeup=true`.
- Resolver المدرب: `makeup_sessions.assigned_instructor_id` ?? `groups.instructor_id`.
- نص الإنذار يضيف `(تعويضية لسيشن YYYY-MM-DD)` بدل رقم السيشن.
- Anomaly: makeup فيها أكتر من طالب حاضر → يُسجَّل في `data_quality_issues` عبر RPC `log_dq_issue` (idempotent، unique daily index).

## Idempotency & State
- `instructor_warnings.trace_id` + `settings_version` — كل warning مرتبط بالـ run والـ config اللي بناه.
- Partial unique index على `(session_id, warning_type, instructor_id) WHERE is_active`.
- 4 auto-resolve triggers: attendance/assignments/quiz_assignments/session_evaluations يحدّثوا `status='resolved'` و `resolution_reason`.

## Run Telemetry
- كل run يحجز `compliance_scan_runs` row فيه `metadata.trace_id` و `settings_version`.
- Structured logs: `compliance_run_started` و `compliance_run_finished` بـ JSON.

## Files
- `supabase/functions/compliance-monitor/index.ts` — الـ scanner.
- `supabase/functions/_shared/cairoTime.ts` — IANA Cairo helpers.
- `src/components/settings/ComplianceGracePeriodsSettings.tsx` — admin UI لتعديل القيم + version display.
