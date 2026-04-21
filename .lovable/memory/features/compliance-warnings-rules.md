---
name: compliance-warnings-rules
description: V4 — Deterministic fingerprint dedup, dedicated /compliance-monitor admin page, server-side jsPDF export, scan timeline + anomalies dashboard
type: feature
---

# Compliance Warnings — V4 Production + Observability

## Deterministic Dedup (V4)
- `instructor_warnings.warning_fingerprint` = `md5(session_id|warning_type|instructor_id|level_id|content_number)` STORED generated column.
- `idx_warnings_fingerprint_active` UNIQUE WHERE `is_active=true` يضمن استحالة وجود أي إنذار مكرر.
- `insert_warning_deduped(...)` RPC: SECURITY DEFINER, يحسب الـ fingerprint، يفحص، يدخل، أو يرجع `inserted=false` مع الإنذار الأصلي.
- `warning_dedup_log` يسجل كل محاولة تكرار بـ `trace_id` و `attempted_payload`.
- `compliance-monitor/index.ts` يستدعي `insert_warning_deduped` بدل INSERT المباشر — يتم الـ race re-check قبل، والـ RPC تتولى الباقي.

## Admin Observability
- صفحة `/compliance-monitor` (admin only) تحتوي 3 تبويبات:
  1. **Scan timeline** — آخر 50 run مع `trace_id`, `settings_version`, duration, ومقاييس مفصّلة + زر تنزيل PDF.
  2. **Anomalies** — قائمة `data_quality_issues` مع فلتر بالنوع وبحث بالـ entity_id.
  3. **Dedup log** — كل محاولة تكرار: fingerprint, existing_warning_id, trace_id.
- زر "Run scan now" يستدعي `compliance-monitor` يدويًا.

## PDF Export
- Edge function `export-compliance-report` (Deno + jsPDF + jspdf-autotable).
- Input: `{ trace_id }`. Output: PDF binary.
- يجمع: run telemetry + breakdown by type + anomalies + warnings.
- يفرض role check (admin/reception) عبر JWT.

## Files
- `supabase/functions/compliance-monitor/index.ts` — يستخدم `insert_warning_deduped` RPC.
- `supabase/functions/export-compliance-report/index.ts` — PDF generator.
- `src/pages/ComplianceMonitor.tsx` — لوحة الـ admin.
- `src/components/settings/ComplianceGracePeriodsSettings.tsx` — UI تعديل القيم.
- DB: `warning_fingerprint` column, `warning_dedup_log` table, `insert_warning_deduped` RPC.

## V3 Foundations (still active)
- Grace periods من `system_settings.compliance_grace_periods` مع `validate_grace_settings` trigger.
- `sessions.start_at`/`end_at` UTC من trigger `compute_session_time_bounds` (Cairo -3h).
- Makeup-aware grace via `makeup_multiplier` (1.0–3.0).
- 4 auto-resolve triggers على attendance/assignments/quiz_assignments/session_evaluations.
- `compliance_scan_runs` يحتفظ بـ `trace_id` و `settings_version` في metadata.
