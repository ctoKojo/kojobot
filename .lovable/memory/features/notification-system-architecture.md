---
name: notification-system-architecture
description: Email + Telegram notification system — convention-based template resolver (default-{event_key}), idempotent UPDATE pattern in send-email, NotificationsHealth dashboard, and 15-min stale-cleanup cron
type: feature
---

# Notification System Architecture (Email + Telegram)

## Template Resolution (Convention-Based)
Both `send-email/index.ts` and `send-telegram/index.ts` resolve templates in this order:
1. **Explicit mapping** in `email_event_mappings` (event_key + audience) → uses `template_id`.
2. **Direct name lookup** by `templateName` in `email_templates` (for test sends from UI).
3. **Convention fallback**: `default-{eventKey}` lookup in `email_templates`.
4. **Built-in code template** (last resort, e.g. `<b>{{title}}</b>\n\n{{message}}`).

This means: to add a new event, just create a template named `default-{event_key}` — no manual mapping required.

## Idempotency & Race Protection (Email)
`send-email/index.ts` uses an UPDATE-based pattern keyed on `message_id` (= idempotencyKey):
- **Pre-check**: query existing log by `message_id`. Skip if `sent`/`pending` already exists.
- **INSERT pending**: protected by partial unique index `uniq_email_log_pending_per_message` on `email_send_log (message_id) WHERE status = 'pending'`.
- **Conditional UPDATE** to final status: `.eq('message_id', key).eq('status', 'pending')` — never overwrites a `sent` row.

Result: each email = exactly one row in `email_send_log` (no pending+sent duplicates).

## Health Dashboard
- **Route**: `/notifications-health` (admin-only via `ProtectedRoute`).
- **Sidebar link**: in admin section of `AppSidebar.tsx`.
- **Features**: deduplicated stats by `message_id`, unified Email+Telegram log view, manual Retry button (uses `idempotencyKey = retry-{original_id}-{ts}`), realtime failure alert if >5 failures/hour.

## Stale Cleanup Cron
- **Edge function**: `supabase/functions/cleanup-stale-notifications/index.ts`.
- **Schedule**: every 15 minutes via `pg_cron` job `cleanup-stale-notifications` (jobid 31).
- **Behavior**: any `pending` row in `email_send_log` or `telegram_send_log` older than 60 min → `failed` with `error_message='timeout: pending > 60 min (auto-cleanup)'`.
- **Auth**: accepts `x-cron-token` (verified via `verify_cron_token` RPC) OR service-role JWT.

## Backup Table
- `email_send_log_archive_2026_04` — snapshot of pending+failed rows taken before Sprint 1 cleanup (35 stale test rows).

## Resend Connector Note
The Resend API key is managed via the Lovable Connector (not `add_secret`). When 401 errors appear in `email_send_log`, the user must reconnect in **Connectors → Resend → Reconnect** in the UI.
