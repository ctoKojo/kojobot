// Cleanup Stale Notifications - runs every 15 minutes via pg_cron
// Marks any pending email/telegram logs older than 60 minutes as failed
// to prevent stuck "in_progress" entries from race conditions or crashes.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-token',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Auth: accept either a valid cron token (verify_cron_token RPC) or service-role JWT
    const cronToken = req.headers.get('x-cron-token')
    const authHeader = req.headers.get('authorization') ?? ''
    let authorized = false

    if (cronToken) {
      const { data: tokenValid, error: tokenErr } = await supabase.rpc('verify_cron_token', {
        p_token: cronToken,
      })
      if (!tokenErr && tokenValid === true) authorized = true
    }

    if (!authorized && authHeader.includes(serviceRoleKey)) {
      authorized = true
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    // 1) Mark stale email logs
    const { data: emailUpdated, error: emailErr } = await supabase
      .from('email_send_log')
      .update({
        status: 'failed',
        error_message: 'timeout: pending > 60 min (auto-cleanup)',
        delivery_status: 'failed',
        delivery_status_at: new Date().toISOString(),
      })
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .select('id')

    if (emailErr) {
      console.error('[cleanup-stale-notifications] email update error:', emailErr)
    }

    // 2) Mark stale telegram logs
    const { data: tgUpdated, error: tgErr } = await supabase
      .from('telegram_send_log')
      .update({
        status: 'failed',
        error_message: 'timeout: pending > 60 min (auto-cleanup)',
      })
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .select('id')

    if (tgErr) {
      console.error('[cleanup-stale-notifications] telegram update error:', tgErr)
    }

    const result = {
      success: true,
      cutoff,
      email_cleaned: emailUpdated?.length ?? 0,
      telegram_cleaned: tgUpdated?.length ?? 0,
      ran_at: new Date().toISOString(),
    }

    console.log('[cleanup-stale-notifications]', JSON.stringify(result))

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[cleanup-stale-notifications] Error:', error)
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
