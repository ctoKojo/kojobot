import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: userError } = await userSupabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey)

    // Check admin
    const { data: roleData } = await adminSupabase
      .from('user_roles').select('role').eq('user_id', user.id).single()
    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get all cancellation logs with their original and replacement sessions
    const { data: logs, error: logsErr } = await adminSupabase
      .from('session_cancellation_logs')
      .select('session_id, replacement_session_id, closure_id')

    if (logsErr) throw logsErr
    if (!logs || logs.length === 0) {
      return new Response(JSON.stringify({ message: 'No cancellation logs found', fixed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let fixed = 0
    const errors: string[] = []

    for (const log of logs) {
      if (!log.replacement_session_id) continue

      // Get original session number
      const { data: origSession } = await adminSupabase
        .from('sessions').select('session_number, group_id').eq('id', log.session_id).single()

      // Get replacement session
      const { data: replSession } = await adminSupabase
        .from('sessions').select('session_number').eq('id', log.replacement_session_id).single()

      if (!origSession || !replSession) continue

      // If replacement has wrong number (orig + 1 instead of orig)
      if (replSession.session_number === origSession.session_number! + 1) {
        const { error: updateErr } = await adminSupabase
          .from('sessions')
          .update({ session_number: origSession.session_number })
          .eq('id', log.replacement_session_id)

        if (updateErr) {
          errors.push(`Failed to fix ${log.replacement_session_id}: ${updateErr.message}`)
        } else {
          fixed++
        }
      }
    }

    // Fix owed_sessions_count: decrement by 1 for each group that had closure cancellation
    const groupIds = [...new Set(
      (await Promise.all(logs.map(async (log) => {
        const { data } = await adminSupabase
          .from('sessions').select('group_id').eq('id', log.session_id).single()
        return data?.group_id
      }))).filter(Boolean)
    )]

    let owedFixed = 0
    for (const groupId of groupIds) {
      const { data: group } = await adminSupabase
        .from('groups').select('owed_sessions_count').eq('id', groupId).single()
      if (group && (group.owed_sessions_count || 0) > 0) {
        await adminSupabase
          .from('groups')
          .update({ owed_sessions_count: Math.max((group.owed_sessions_count || 0) - 1, 0) })
          .eq('id', groupId)
        owedFixed++
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sessionsFixed: fixed,
      owedFixed,
      errors: errors.length > 0 ? errors : undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: unknown) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
