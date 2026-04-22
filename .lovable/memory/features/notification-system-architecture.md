---
name: notification-system-architecture
description: Email + Telegram notification system — convention-based template resolver, idempotent UPDATE pattern, dry_run/smoke-test mode, NotificationsHealth dashboard with separate Smoke tab + E2E tester, 15-min stale-cleanup cron, hardened Resend webhook
type: feature
---

# Notification System Architecture (Email + Telegram)

## Template Resolution (Convention-Based)
Both `send-email/index.ts` and `send-telegram/index.ts` resolve templates in this order:
1. **Explicit mapping** in `email_event_mappings` (event_key + audience) → uses `template_id`.
2. **Direct name lookup** by `templateName` in `email_templates` (for test sends from UI).
3. **Convention fallback**: `default-{eventKey}` lookup in `email_templates`.
4. **Built-in code template** (last resort, e.g. `<b>{{title}}</b>\n\n{{message}}`).

To add a new event: just create a template named `default-{event_key}` — no manual mapping required.

## Idempotency & Race Protection (Email)
`send-email/index.ts` uses an UPDATE-based pattern keyed on `message_id` (= idempotencyKey):
- **Pre-check**: query existing log by `message_id`. Skip if `sent`/`pending` already exists.
- **INSERT pending**: protected by partial unique index `uniq_email_log_pending_per_message` on `email_send_log (message_id) WHERE status = 'pending'`.
- **Conditional UPDATE** to final status: `.eq('message_id', key).eq('status', 'pending')` — never overwrites a `sent` row.

Result: each email = exactly one row in `email_send_log` (no pending+sent duplicates).

## Dry-Run / Smoke-Test Mode (Sprint 2)
Both `send-email` and `send-telegram` accept `dryRun: true` + `smokeTest: true`:
- **Dry-run**: resolves the template + renders variables, **never calls Resend/Telegram**, logs row with `status='dry_run'` and `metadata.smoke_test=true`. Returns rendered subject/html for preview.
- **Live + smokeTest=true**: real send but tagged in `metadata.smoke_test=true` so it can be filtered out of production stats.
- **DB enforcement**: `dry_run` is in the CHECK constraint of both log tables; partial unique index excludes it (only `status='pending'` rows are deduped).

## Health Dashboard — Production / Smoke Separation
- **Route**: `/notifications-health` (admin-only).
- **Production stats card** (Sent / Failed / Success rate): **always excludes** `is_smoke_test` rows (detected via `status='dry_run'` OR `metadata.smoke_test === true` OR `metadata.dry_run === true`).
- **Logs view** uses two tabs (NOT mixed):
  - `Production` — clean operational logs.
  - `Smoke Tests` — tagged dry-runs and smoke live sends, with a banner explaining they're excluded from stats.
- **E2E Tester card** (separate, in-page — NOT a popup): Run button calls `notifications-e2e-test` which iterates `email_event_catalog`, runs dry-run for each event, and returns a per-event report (ok / missing_template / disabled / error). Results render inline in a scrollable table.
- **Smoke Test entry**: header action button links to `/notifications-smoke-test`.

## Smoke Test Page (`/notifications-smoke-test`)
- Admin-only.
- Event picker (grouped by category) auto-populates `audience` + `preview_data` from `email_event_catalog`.
- JSON variables editor with live validation.
- **Dry-run is default**. "Live Mode" switch is visually warning-tinted.
- Toggling Live → "Send" → opens `AlertDialog` showing exact recipient email + count of messages + ⚠️ confirmation. No silent live sends.
- Optional `Include Telegram` toggle (uses logged-in user's linked chat).
- Side-by-side Email/Telegram preview tabs render the resolved output.

## E2E Tester Edge Function (`notifications-e2e-test`)
- Admin-only (verifies `user_roles.role='admin'` server-side).
- Iterates active events in `email_event_catalog`.
- For each event: pre-checks mapping + `default-{event_key}` template existence, then invokes `send-email` with `dryRun=true, smokeTest=true, skipTelegramFanout=true`.
- Returns `{ summary, reports[] }` where each report has `status`, `has_mapping`, `has_template`, `resolved_via`.
- Recipient defaults to caller's email; can be overridden via body.

## Stale Cleanup Cron
- **Edge function**: `cleanup-stale-notifications`.
- **Schedule**: every 15 minutes via `pg_cron` (jobid 31).
- **Behavior**: any `pending` row older than 60 min → `failed` with timeout message.
- **Auth**: accepts `x-cron-token` (verified via `verify_cron_token` RPC) OR service-role JWT.

## Resend Webhook Hardening
- `resend-webhook/index.ts` verifies Svix signature (`svix-id` + `svix-timestamp` + `svix-signature`) when `RESEND_WEBHOOK_SECRET` is configured.
- Replay protection: rejects payloads with timestamps > 5 min old.
- Idempotency via unique `resend_event_id` on `email_delivery_events` (handles 23505 duplicate gracefully).
- Updates `email_send_log.delivery_status` based on event type (sent/delivered/bounced/etc).

## Backup Tables
- `email_send_log_archive_2026_04` — pre-Sprint 1 cleanup snapshot.

## Resend Connector Note
Resend API key is managed via the Lovable Connector. On 401 errors, user must reconnect in **Connectors → Resend → Reconnect**.
