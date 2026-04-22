// E2E Notifications Tester
// Iterates over email_event_catalog and runs a dry_run send for each event.
// Reports per-event status: ok / missing_template / render_error / skipped
// Admin-only — verifies user role server-side.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EventReport {
  event_key: string
  audience: string
  status: 'ok' | 'missing_template' | 'render_error' | 'disabled' | 'no_recipient' | 'error'
  message?: string
  has_mapping: boolean
  has_template: boolean
  resolved_via?: 'mapping' | 'convention' | 'direct' | 'code' | 'none'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller is admin
    const authHeader = req.headers.get('authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes } = await userClient.auth.getUser()
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userRes.user.id)
      .eq('role', 'admin')
      .maybeSingle()
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse body — support an optional recipient override for the dry-run logs
    let body: any = {}
    try { body = await req.json() } catch { /* empty body OK */ }
    const recipientEmail: string = body.recipientEmail || userRes.user.email || 'e2e-test@kojobot.com'

    // Load all active events from catalog
    const { data: events, error: catErr } = await supabase
      .from('email_event_catalog')
      .select('event_key, supported_audiences, preview_data, is_active')
      .eq('is_active', true)
      .order('event_key', { ascending: true })

    if (catErr) {
      return new Response(JSON.stringify({ error: 'Failed to load catalog', details: catErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const reports: EventReport[] = []
    const runId = `e2e-${Date.now()}`

    for (const ev of events ?? []) {
      const audiences: string[] = Array.isArray(ev.supported_audiences) && ev.supported_audiences.length > 0
        ? ev.supported_audiences
        : ['student']
      const audience = audiences[0]
      const previewData = (ev.preview_data ?? {}) as Record<string, unknown>

      // Pre-check: mapping + template existence
      const { data: mapping } = await supabase
        .from('email_event_mappings')
        .select('template_id, is_enabled')
        .eq('event_key', ev.event_key)
        .eq('audience', audience)
        .maybeSingle()

      const { data: conventionTpl } = await supabase
        .from('email_templates')
        .select('id')
        .eq('name', `default-${ev.event_key}`)
        .eq('is_active', true)
        .maybeSingle()

      const hasMapping = !!mapping
      const hasTemplate = !!mapping?.template_id || !!conventionTpl?.id

      if (mapping && mapping.is_enabled === false) {
        reports.push({
          event_key: ev.event_key,
          audience,
          status: 'disabled',
          has_mapping: true,
          has_template: hasTemplate,
          resolved_via: 'mapping',
        })
        continue
      }

      if (!hasTemplate) {
        reports.push({
          event_key: ev.event_key,
          audience,
          status: 'missing_template',
          has_mapping: hasMapping,
          has_template: false,
          resolved_via: 'none',
          message: 'No mapped template and no default-{event_key} fallback',
        })
        continue
      }

      // Invoke send-email in dry-run mode
      try {
        const idempotencyKey = `${runId}-${ev.event_key}-${audience}`
        const { data: invokeRes, error: invokeErr } = await supabase.functions.invoke('send-email', {
          body: {
            to: recipientEmail,
            templateName: ev.event_key,
            templateData: previewData,
            audience,
            idempotencyKey,
            dryRun: true,
            smokeTest: true,
            skipTelegramFanout: true,
          },
        })

        if (invokeErr) {
          reports.push({
            event_key: ev.event_key,
            audience,
            status: 'error',
            has_mapping: hasMapping,
            has_template: hasTemplate,
            message: invokeErr.message ?? 'invoke error',
          })
        } else {
          reports.push({
            event_key: ev.event_key,
            audience,
            status: 'ok',
            has_mapping: hasMapping,
            has_template: hasTemplate,
            resolved_via: mapping?.template_id ? 'mapping' : 'convention',
            message: (invokeRes as any)?.subject?.slice(0, 100),
          })
        }
      } catch (e) {
        reports.push({
          event_key: ev.event_key,
          audience,
          status: 'render_error',
          has_mapping: hasMapping,
          has_template: hasTemplate,
          message: e instanceof Error ? e.message : String(e),
        })
      }
    }

    const summary = {
      total: reports.length,
      ok: reports.filter(r => r.status === 'ok').length,
      missing_template: reports.filter(r => r.status === 'missing_template').length,
      disabled: reports.filter(r => r.status === 'disabled').length,
      errors: reports.filter(r => r.status === 'error' || r.status === 'render_error').length,
      run_id: runId,
      ran_at: new Date().toISOString(),
    }

    return new Response(JSON.stringify({ summary, reports }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[notifications-e2e-test] error:', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
