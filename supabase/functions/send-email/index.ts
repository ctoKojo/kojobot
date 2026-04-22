// Generic email sender via Resend Gateway (Lovable Connector)
// Supports template-based emails with logging and idempotency

import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.23.8'

import { template as sessionReminderTpl } from '../_shared/email-templates/session-reminder.ts'
import { template as paymentDueTpl } from '../_shared/email-templates/payment-due.ts'
import { template as passwordResetTpl } from '../_shared/email-templates/password-reset.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM_ADDRESS = 'Kojobot Academy <academy@kojobot.com>'

interface EmailTemplate {
  subject: (data: any) => string
  render: (data: any) => string
}

// Built-in code templates (legacy fallback when no DB override exists)
const CODE_TEMPLATES: Record<string, EmailTemplate> = {
  'session-reminder': sessionReminderTpl,
  'session-reminder-1h': sessionReminderTpl,
  'session-reminder-1day': sessionReminderTpl,
  'payment-due': paymentDueTpl,
  'password-reset': passwordResetTpl,
}

// Accept any event_key from the catalog (validated against DB at runtime).
// We keep validation loose here to support custom events added via UI.
const AUDIENCES = ['student','parent','instructor','admin','reception','staff'] as const

const RequestSchema = z.object({
  to: z.string().email(),
  templateName: z.string().min(1).max(100),
  templateData: z.record(z.any()).optional(),
  idempotencyKey: z.string().min(1).max(255),
  // Audience for resolving the right template + mapping. Defaults to 'student' for backwards-compat.
  audience: z.enum(AUDIENCES).optional(),
  // Force-skip the auto Telegram fan-out (used by notifyEvent dispatcher to avoid double-send)
  skipTelegramFanout: z.boolean().optional(),
  // Optional overrides for bulk reminders / customized sends.
  customSubject: z.string().min(1).max(998).optional(),
  customBody: z.string().min(1).max(200000).optional(),
})

// Simple {{variable}} interpolation. Missing keys render as empty string.
function renderTemplate(tpl: string, data: Record<string, any>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = data[key]
    return v === undefined || v === null ? '' : String(v)
  })
}

// Resolve subject + html for a given templateName, preferring a DB override
// when use_db_template = true on the event mapping.
async function resolveTemplate(
  supabase: ReturnType<typeof createClient>,
  templateName: string,
  audience: string,
  data: Record<string, any>,
): Promise<{ subject: string; html: string; mapping: any } | null> {
  // 1. Look up mapping by (event_key, audience). Fall back to any audience if not found.
  let { data: mapping } = await supabase
    .from('email_event_mappings')
    .select('use_db_template, is_enabled, template_id, admin_channel_override, audience')
    .eq('event_key', templateName)
    .eq('audience', audience)
    .maybeSingle()

  if (!mapping) {
    const { data: fallbackMapping } = await supabase
      .from('email_event_mappings')
      .select('use_db_template, is_enabled, template_id, admin_channel_override, audience')
      .eq('event_key', templateName)
      .order('audience', { ascending: true })
      .limit(1)
      .maybeSingle()
    mapping = fallbackMapping
  }

  if (mapping && mapping.is_enabled === false) return null

  // 2. DB override path — try audience-specific template, then fall back to mapping.template_id
  if (mapping?.use_db_template && mapping.template_id) {
    const { data: tpl } = await supabase
      .from('email_templates')
      .select('subject_en, body_html_en, is_active')
      .eq('id', mapping.template_id)
      .maybeSingle()
    if (tpl?.is_active) {
      return {
        subject: renderTemplate(tpl.subject_en, data),
        html: renderTemplate(tpl.body_html_en, data),
        mapping,
      }
    }
  }

  // 3. Code template fallback
  const codeTpl = CODE_TEMPLATES[templateName]
  if (codeTpl) {
    return { subject: codeTpl.subject(data), html: codeTpl.render(data), mapping }
  }

  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY_DIRECT') ?? Deno.env.get('RESEND_API_KEY')
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Validation failed', details: parsed.error.flatten() }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { to, templateName, templateData, idempotencyKey, customSubject, customBody } = parsed.data

  // Honor per-user channel preferences (email_enabled). Look up user by email.
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', to)
      .maybeSingle()
    if (prof?.user_id) {
      const { data: prefs } = await supabase.rpc('get_user_notification_channels', {
        p_user_id: prof.user_id,
        p_event_key: templateName,
      })
      const emailEnabled = Array.isArray(prefs) ? prefs[0]?.email_enabled : (prefs as any)?.email_enabled
      if (emailEnabled === false) {
        return new Response(
          JSON.stringify({ success: true, skipped: 'email_disabled_by_user' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      // Fan-out: also send to Telegram if user has it linked + enabled (fire-and-forget)
      supabase.functions.invoke('send-telegram', {
        body: {
          userId: prof.user_id,
          templateName,
          templateData: templateData ?? {},
          customMessage: customBody,
          idempotencyKey: `${idempotencyKey}-tg`,
        },
      }).catch((e) => console.warn('[send-email] telegram fan-out failed:', e?.message))
    }
  } catch (e) {
    console.warn('[send-email] preference lookup failed:', e)
  }

  // Idempotency: skip if already successfully sent
  const { data: existing } = await supabase
    .from('email_send_log')
    .select('id, status')
    .eq('message_id', idempotencyKey)
    .eq('status', 'sent')
    .maybeSingle()

  if (existing) {
    console.log('Email already sent (idempotent skip)', { idempotencyKey })
    return new Response(
      JSON.stringify({ success: true, skipped: 'already_sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const data = templateData ?? {}
  let resolved: { subject: string; html: string } | null = null

  // If both custom subject and body are provided, use them directly (still interpolated).
  if (customSubject && customBody) {
    resolved = {
      subject: renderTemplate(customSubject, data),
      html: renderTemplate(customBody, data),
    }
  } else {
    const baseTpl = await resolveTemplate(supabase, templateName, data)
    if (baseTpl) {
      resolved = {
        subject: customSubject ? renderTemplate(customSubject, data) : baseTpl.subject,
        html: customBody ? renderTemplate(customBody, data) : baseTpl.html,
      }
    }
  }

  if (!resolved) {
    // Either event is disabled by admin, or template not found in DB nor code.
    await supabase.from('email_send_log').insert({
      message_id: idempotencyKey,
      template_name: templateName,
      recipient_email: to,
      status: 'skipped',
      error_message: 'No template available (disabled or unknown template)',
      metadata: { reason: 'template_not_resolved' },
    })
    return new Response(
      JSON.stringify({ success: true, skipped: 'template_not_resolved' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { subject, html } = resolved

  // Retry configuration
  const MAX_ATTEMPTS = 3
  const BASE_DELAY_MS = 500 // exponential backoff base
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const isRetryableStatus = (s: number) => s === 408 || s === 429 || s >= 500

  // Log pending attempt
  await supabase.from('email_send_log').insert({
    message_id: idempotencyKey,
    template_name: templateName,
    recipient_email: to,
    status: 'pending',
    metadata: { max_attempts: MAX_ATTEMPTS },
  })

  let lastError = ''
  let lastStatus = 0

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: [to],
          subject,
          html,
        }),
      })

      let result: any = null
      try {
        result = await response.json()
      } catch {
        result = null
      }

      if (response.ok) {
        await supabase.from('email_send_log').insert({
          message_id: idempotencyKey,
          template_name: templateName,
          recipient_email: to,
          status: 'sent',
          metadata: { resend_id: result?.id, attempt, max_attempts: MAX_ATTEMPTS },
        })
        return new Response(
          JSON.stringify({ success: true, id: result?.id, attempt }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      lastStatus = response.status
      lastError = `Resend API error [${response.status}]: ${JSON.stringify(result)}`
      console.error(`Attempt ${attempt}/${MAX_ATTEMPTS} failed:`, lastError)

      // Log this attempt
      await supabase.from('email_send_log').insert({
        message_id: idempotencyKey,
        template_name: templateName,
        recipient_email: to,
        status: isRetryableStatus(response.status) && attempt < MAX_ATTEMPTS ? 'retrying' : 'failed',
        error_message: lastError.slice(0, 1000),
        metadata: { attempt, max_attempts: MAX_ATTEMPTS, http_status: response.status },
      })

      // Don't retry on non-retryable errors (4xx except 408/429)
      if (!isRetryableStatus(response.status)) {
        return new Response(
          JSON.stringify({ success: false, error: lastError, attempt }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Wait before next attempt (respect Retry-After if present)
      if (attempt < MAX_ATTEMPTS) {
        const retryAfter = response.headers.get('retry-after')
        const delayMs = retryAfter
          ? Math.min(parseInt(retryAfter) * 1000, 10000)
          : BASE_DELAY_MS * Math.pow(2, attempt - 1)
        await sleep(delayMs)
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      console.error(`Attempt ${attempt}/${MAX_ATTEMPTS} exception:`, lastError)

      await supabase.from('email_send_log').insert({
        message_id: idempotencyKey,
        template_name: templateName,
        recipient_email: to,
        status: attempt < MAX_ATTEMPTS ? 'retrying' : 'failed',
        error_message: lastError.slice(0, 1000),
        metadata: { attempt, max_attempts: MAX_ATTEMPTS, exception: true },
      })

      if (attempt < MAX_ATTEMPTS) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1))
      }
    }
  }

  // All attempts exhausted
  return new Response(
    JSON.stringify({ success: false, error: lastError, attempts: MAX_ATTEMPTS, last_status: lastStatus }),
    { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
