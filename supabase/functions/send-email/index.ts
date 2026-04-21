// Generic email sender via Resend Gateway (Lovable Connector)
// Supports template-based and raw HTML emails with logging

import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.23.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend'
const FROM_ADDRESS = 'Kojobot Academy <academy@kojobot.com>'

// Template registry
const TEMPLATES = {
  'session-reminder': await import('../_shared/email-templates/session-reminder.ts').then(m => m.template),
  'payment-due': await import('../_shared/email-templates/payment-due.ts').then(m => m.template),
  'password-reset': await import('../_shared/email-templates/password-reset.ts').then(m => m.template),
} as const

type TemplateName = keyof typeof TEMPLATES

const RequestSchema = z.object({
  to: z.string().email(),
  templateName: z.enum(['session-reminder', 'payment-due', 'password-reset']),
  templateData: z.record(z.any()).optional(),
  idempotencyKey: z.string().min(1).max(255),
  // Optional override for direct HTML (admins only — not used by clients)
  subject: z.string().optional(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!LOVABLE_API_KEY || !RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
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

  const { to, templateName, templateData, idempotencyKey } = parsed.data

  // Idempotency check: skip if already sent
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

  // Render template
  const tpl = TEMPLATES[templateName as TemplateName]
  const data = templateData ?? {}
  const subject = typeof tpl.subject === 'function' ? tpl.subject(data) : tpl.subject
  const html = tpl.render(data)

  // Log pending
  await supabase.from('email_send_log').insert({
    message_id: idempotencyKey,
    template_name: templateName,
    recipient_email: to,
    status: 'pending',
  })

  try {
    const response = await fetch(`${GATEWAY_URL}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        html,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      const errorMsg = `Resend API error [${response.status}]: ${JSON.stringify(result)}`
      console.error(errorMsg)
      await supabase.from('email_send_log').insert({
        message_id: idempotencyKey,
        template_name: templateName,
        recipient_email: to,
        status: 'failed',
        error_message: errorMsg.slice(0, 1000),
      })
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await supabase.from('email_send_log').insert({
      message_id: idempotencyKey,
      template_name: templateName,
      recipient_email: to,
      status: 'sent',
      metadata: { resend_id: result?.id },
    })

    return new Response(
      JSON.stringify({ success: true, id: result?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('Email send exception:', errorMsg)
    await supabase.from('email_send_log').insert({
      message_id: idempotencyKey,
      template_name: templateName,
      recipient_email: to,
      status: 'failed',
      error_message: errorMsg.slice(0, 1000),
    })
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
