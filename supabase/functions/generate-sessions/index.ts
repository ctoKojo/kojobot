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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token)

    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.claims.sub as string
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey)

    // Check admin role
    const { data: roleData } = await adminSupabase
      .from('user_roles').select('role').eq('user_id', userId).single()

    if (roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Starting fallback session generation (next session only)...')

    // Get all active groups that have started
    const { data: groups, error: groupsError } = await adminSupabase
      .from('groups')
      .select('id, name, schedule_day, schedule_time, duration_minutes, is_active')
      .eq('is_active', true)
      .eq('has_started', true)

    if (groupsError) throw groupsError

    if (!groups || groups.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active started groups found', created: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let createdCount = 0
    let skippedCount = 0
    const errors: string[] = []

    for (const group of groups) {
      // Get the latest completed session with no next scheduled session
      const { data: lastCompleted } = await adminSupabase
        .from('sessions')
        .select('session_number, session_date')
        .eq('group_id', group.id)
        .eq('status', 'completed')
        .order('session_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!lastCompleted || !lastCompleted.session_number || lastCompleted.session_number >= 12) {
        skippedCount++
        continue
      }

      const nextNum = lastCompleted.session_number + 1

      // Check if next session already exists
      const { data: existing } = await adminSupabase
        .from('sessions')
        .select('id')
        .eq('group_id', group.id)
        .eq('session_number', nextNum)
        .maybeSingle()

      if (existing) {
        skippedCount++
        continue
      }

      // Calculate next date
      const lastDate = new Date(lastCompleted.session_date + 'T00:00:00')
      lastDate.setDate(lastDate.getDate() + 7)
      const nextDate = lastDate.toISOString().split('T')[0]

      // Get group's level_id for the session
      const { data: groupFull } = await adminSupabase
        .from('groups')
        .select('level_id')
        .eq('id', group.id)
        .single()

      const { error: insertError } = await adminSupabase
        .from('sessions')
        .insert({
          group_id: group.id,
          session_date: nextDate,
          session_time: group.schedule_time,
          duration_minutes: group.duration_minutes,
          status: 'scheduled',
          session_number: nextNum,
          level_id: groupFull?.level_id || null,
        })

      if (insertError) {
        errors.push(`Failed for ${group.name}: ${insertError.message}`)
      } else {
        console.log(`Created session #${nextNum} for ${group.name} on ${nextDate}`)
        createdCount++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Fallback generation complete`,
        created: createdCount,
        skipped: skippedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error in generate-sessions:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
