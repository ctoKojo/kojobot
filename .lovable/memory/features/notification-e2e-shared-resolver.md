---
name: notification-e2e-shared-resolver
description: notifications-e2e-test uses _shared/templateResolver.ts for in-process template resolution (zero edge function invokes, ~6s for 54 events). Production send-email/send-telegram still use inline duplicated logic — kept stable on purpose.
type: feature
---

# E2E Tester: In-Process Template Resolver

## Architecture
- `supabase/functions/_shared/templateResolver.ts` — single source of truth for the 4-step lookup (mapping → DB override → direct name → `default-{eventKey}` convention) + `renderTemplate` + `extractMissingVariables`. Zero side effects.
- `supabase/functions/notifications-e2e-test/index.ts` — calls `resolveTemplate` directly per event, then renders with `preview_data`. **Zero `supabase.functions.invoke` calls.** Throughput: ~54 events in 6s.
- `supabase/functions/send-email/index.ts` and `send-telegram/index.ts` still use inline copies of the resolution logic. Intentional — production proven; refactor deferred.

## Drift Detection
The E2E tester is the spec. Any divergence between the shared resolver and production inline logic will surface as failed E2E reports. If `send-email` is later refactored to use the shared module, no behavior change is expected.

## Status Codes
- `ok` — template resolved + rendered cleanly
- `missing_template` — no mapping, no `default-{event_key}` convention template
- `missing_vars` — leftover `{{var}}` literals after rendering (only triggers if a template references a variable that's not in `preview_data` AND not the default empty-string render)
- `disabled` — mapping exists with `is_enabled=false`
- `render_error` — exception during DB lookup or render
