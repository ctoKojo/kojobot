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

  // Helper: pick EN body, fall back to AR if EN is empty.
  const pickSubject = (tpl: any) =>
    (tpl?.subject_en && tpl.subject_en.trim()) ? tpl.subject_en : (tpl?.subject_ar ?? '')
  const pickHtml = (tpl: any) =>
    (tpl?.body_html_en && tpl.body_html_en.trim()) ? tpl.body_html_en : (tpl?.body_html_ar ?? '')

  // 2. DB override path — use the mapping's template_id
  if (mapping?.use_db_template && mapping.template_id) {
    const { data: tpl } = await supabase
      .from('email_templates')
      .select('subject_en, subject_ar, body_html_en, body_html_ar, is_active')
      .eq('id', mapping.template_id)
      .maybeSingle()
    if (tpl?.is_active) {
      return {
        subject: renderTemplate(pickSubject(tpl), data),
        html: renderTemplate(pickHtml(tpl), data),
        mapping,
      }
    }
  }

  // 3. Direct template lookup by name (used for "Send Test" from the templates UI,
  //    where templateName is the template's `name` rather than an event_key).
  const { data: directTpl } = await supabase
    .from('email_templates')
    .select('subject_en, subject_ar, body_html_en, body_html_ar, is_active')
    .eq('name', templateName)
    .eq('is_active', true)
    .maybeSingle()
  if (directTpl) {
    return {
      subject: renderTemplate(pickSubject(directTpl), data),
      html: renderTemplate(pickHtml(directTpl), data),
      mapping,
    }
  }

  // 4. Convention-based fallback: try `default-{eventKey}` template
  // This prevents orphan events when an admin forgets to create a mapping.
  if (!templateName.startsWith('default-')) {
    const conventionName = `default-${templateName}`
    const { data: conventionTpl } = await supabase
      .from('email_templates')
      .select('subject_en, subject_ar, body_html_en, body_html_ar, is_active')
      .eq('name', conventionName)
      .eq('is_active', true)
      .maybeSingle()
    if (conventionTpl) {
      console.log(`[send-email] Using convention fallback: ${conventionName}`)
      return {
        subject: renderTemplate(pickSubject(conventionTpl), data),
        html: renderTemplate(pickHtml(conventionTpl), data),
        mapping,
      }
    }
  }

  // 5. Code template fallback
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

  const { to, templateName, templateData, idempotencyKey, customSubject, customBody, audience: audienceArg, skipTelegramFanout } = parsed.data
  const audience = audienceArg ?? 'student'

  // Resolve mapping early so we can honor admin_channel_override for fan-out
  const data = templateData ?? {}
  let resolved: { subject: string; html: string; mapping?: any } | null = null

  if (customSubject && customBody) {
    resolved = {
      subject: renderTemplate(customSubject, data),
      html: renderTemplate(customBody, data),
    }
  } else {
    const baseTpl = await resolveTemplate(supabase, templateName, audience, data)
    if (baseTpl) {
      resolved = {
        subject: customSubject ? renderTemplate(customSubject, data) : baseTpl.subject,
        html: customBody ? renderTemplate(customBody, data) : baseTpl.html,
        mapping: baseTpl.mapping,
      }
    }
  }

  // Channel routing rules (admin-controlled). Allowed values from DB constraint:
  //   'user_choice' | 'email_only' | 'telegram_only' | 'both' | 'none'
  const adminChannel: string = resolved?.mapping?.admin_channel_override ?? 'user_choice'

  if (adminChannel === 'none') {
    return new Response(
      JSON.stringify({ success: true, skipped: 'admin_channel_none' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Honor per-user channel preferences (email_enabled). Look up user by email.
  let resolvedUserId: string | null = null
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', to)
      .maybeSingle()
    if (prof?.user_id) {
      resolvedUserId = prof.user_id

      if (adminChannel === 'user_choice') {
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
      }
    }
  } catch (e) {
    console.warn('[send-email] preference lookup failed:', e)
  }

  // Admin set telegram-only -> skip email entirely.
  if (adminChannel === 'telegram_only') {
    return new Response(
      JSON.stringify({ success: true, skipped: 'admin_channel_telegram_only' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Telegram fan-out only when admin says so (or user_choice legacy behavior).
  if (!skipTelegramFanout && resolvedUserId && (adminChannel === 'both' || adminChannel === 'user_choice')) {
    supabase.functions.invoke('send-telegram', {
      body: {
        userId: resolvedUserId,
        templateName,
        templateData: data,
        customMessage: customBody,
        audience,
        idempotencyKey: `${idempotencyKey}-tg`,
      },
    }).catch((e) => console.warn('[send-email] telegram fan-out failed:', e?.message))
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
  const BASE_DELAY_MS = 500
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const isRetryableStatus = (s: number) => s === 408 || s === 429 || s >= 500

  // ---- LOG: insert single pending row (idempotent via unique partial index) ----
  // If 2 concurrent requests race, the unique index makes the 2nd INSERT fail.
  // We catch that and treat it as "already in progress" → skip.
  const { error: insertErr } = await supabase.from('email_send_log').insert({
    message_id: idempotencyKey,
    template_name: templateName,
    recipient_email: to,
    status: 'pending',
    metadata: { max_attempts: MAX_ATTEMPTS },
  })

  if (insertErr) {
    // Could be unique constraint violation (concurrent send) or another race
    console.warn('[send-email] pending insert failed:', insertErr.message)
    // Re-check if a sent row appeared meanwhile
    const { data: raceCheck } = await supabase
      .from('email_send_log')
      .select('id, status')
      .eq('message_id', idempotencyKey)
      .in('status', ['sent', 'pending'])
      .maybeSingle()
    if (raceCheck) {
      return new Response(
        JSON.stringify({ success: true, skipped: 'in_progress_or_sent' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  // Helper: finalize the existing pending row (UPDATE not INSERT)
  const finalizeLog = async (
    status: 'sent' | 'failed',
    extraMetadata: Record<string, any>,
    errorMessage?: string,
  ) => {
    const updatePayload: Record<string, any> = {
      status,
      metadata: { max_attempts: MAX_ATTEMPTS, ...extraMetadata },
    }
    if (errorMessage) updatePayload.error_message = errorMessage.slice(0, 1000)

    const { error: updErr } = await supabase
      .from('email_send_log')
      .update(updatePayload)
      .eq('message_id', idempotencyKey)
      .eq('status', 'pending') // conditional — never overwrite a 'sent' row
    if (updErr) console.warn('[send-email] finalize update failed:', updErr.message)
  }

  let lastError = ''
  let lastStatus = 0
  const attemptHistory: Array<Record<string, any>> = []

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
      try { result = await response.json() } catch { result = null }

      if (response.ok) {
        await finalizeLog('sent', {
          resend_id: result?.id,
          attempt,
          attempt_history: attemptHistory,
        })
        return new Response(
          JSON.stringify({ success: true, id: result?.id, attempt }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      lastStatus = response.status
      lastError = `Resend API error [${response.status}]: ${JSON.stringify(result)}`
      attemptHistory.push({ attempt, http_status: response.status, error: lastError.slice(0, 200) })
      console.error(`Attempt ${attempt}/${MAX_ATTEMPTS} failed:`, lastError)

      if (!isRetryableStatus(response.status)) {
        await finalizeLog('failed', { attempt, http_status: response.status, attempt_history: attemptHistory }, lastError)
        return new Response(
          JSON.stringify({ success: false, error: lastError, attempt }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (attempt < MAX_ATTEMPTS) {
        const retryAfter = response.headers.get('retry-after')
        const delayMs = retryAfter
          ? Math.min(parseInt(retryAfter) * 1000, 10000)
          : BASE_DELAY_MS * Math.pow(2, attempt - 1)
        await sleep(delayMs)
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      attemptHistory.push({ attempt, exception: true, error: lastError.slice(0, 200) })
      console.error(`Attempt ${attempt}/${MAX_ATTEMPTS} exception:`, lastError)

      if (attempt < MAX_ATTEMPTS) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1))
      }
    }
  }

  // All attempts exhausted
  await finalizeLog('failed', { attempts: MAX_ATTEMPTS, last_status: lastStatus, attempt_history: attemptHistory }, lastError)
  return new Response(
    JSON.stringify({ success: false, error: lastError, attempts: MAX_ATTEMPTS, last_status: lastStatus }),
    { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
