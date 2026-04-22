// E2E Notifications Tester (in-process, zero edge function invokes)
// Iterates over email_event_catalog and runs in-process resolution + render
// for each event. Reports per-event status: ok / missing_template / render_error / disabled
// Admin-only — verifies user role server-side.
//
// Refactored: previously invoked send-email per event (~54 invokes, hit rate
// limits). Now uses _shared/templateResolver directly — pure DB queries.

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  resolveTemplate,
  renderTemplate,
  extractMissingVariables,
  pickSubjectEnFirst,
  pickHtmlEnFirst,
} from '../_shared/templateResolver.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EventReport {
  event_key: string
  audience: string
  status: 'ok' | 'missing_template' | 'render_error' | 'disabled' | 'missing_vars' | 'error'
  message?: string
  has_mapping: boolean
  has_template: boolean
  resolved_via?: 'mapping' | 'convention' | 'direct' | 'none'
  missing_vars?: string[]
  rendered_subject?: string
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
    const startedAt = Date.now()

    for (const ev of (events ?? [])) {
      const audiences: string[] = Array.isArray(ev.supported_audiences) && ev.supported_audiences.length > 0
        ? ev.supported_audiences
        : ['student']
      const audience = audiences[0]
      const previewData = (ev.preview_data ?? {}) as Record<string, unknown>

      try {
        // In-process resolution — no edge function invokes
        const resolved = await resolveTemplate(supabase, ev.event_key, audience)
        const hasMapping = !!resolved.mapping
        const hasTemplate = !!resolved.template

        if (resolved.disabled) {
          reports.push({
            event_key: ev.event_key,
            audience,
            status: 'disabled',
            has_mapping: true,
            has_template: hasTemplate,
            resolved_via: resolved.source,
          })
          continue
        }

        if (!resolved.template) {
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

        // Render subject + body and detect leftover {{vars}}
        const subjectRendered = renderTemplate(pickSubjectEnFirst(resolved.template), previewData)
        const htmlRendered = renderTemplate(pickHtmlEnFirst(resolved.template), previewData)
        const missing = Array.from(new Set([
          ...extractMissingVariables(subjectRendered),
          ...extractMissingVariables(htmlRendered),
        ]))

        if (missing.length > 0) {
          reports.push({
            event_key: ev.event_key,
            audience,
            status: 'missing_vars',
            has_mapping: hasMapping,
            has_template: true,
            resolved_via: resolved.source,
            missing_vars: missing,
            rendered_subject: subjectRendered.slice(0, 100),
            message: `Missing variables in preview_data: ${missing.join(', ')}`,
          })
          continue
        }

        reports.push({
          event_key: ev.event_key,
          audience,
          status: 'ok',
          has_mapping: hasMapping,
          has_template: true,
          resolved_via: resolved.source,
          rendered_subject: subjectRendered.slice(0, 100),
        })
      } catch (e) {
        reports.push({
          event_key: ev.event_key,
          audience,
          status: 'render_error',
          has_mapping: false,
          has_template: false,
          message: e instanceof Error ? e.message : String(e),
        })
      }
    }

    const elapsedMs = Date.now() - startedAt
    const summary = {
      total: reports.length,
      ok: reports.filter(r => r.status === 'ok').length,
      missing_template: reports.filter(r => r.status === 'missing_template').length,
      missing_vars: reports.filter(r => r.status === 'missing_vars').length,
      disabled: reports.filter(r => r.status === 'disabled').length,
      errors: reports.filter(r => r.status === 'error' || r.status === 'render_error').length,
      run_id: runId,
      ran_at: new Date().toISOString(),
      elapsed_ms: elapsedMs,
      mode: 'in_process',
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
