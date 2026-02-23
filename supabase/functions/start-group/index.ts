import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const dayMap: Record<string, number> = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6,
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token)

    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = claimsData.claims.sub as string
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey)

    // Check admin role
    const { data: roleData } = await adminSupabase
      .from('user_roles').select('role').eq('user_id', userId).single()

    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { group_id, start_date, starting_session_number } = await req.json()

    // Validate group_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!group_id || typeof group_id !== 'string' || !uuidRegex.test(group_id)) {
      return new Response(JSON.stringify({ error: 'Valid group_id (UUID) is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate start_date format if provided
    if (start_date && (typeof start_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start_date))) {
      return new Response(JSON.stringify({ error: 'start_date must be in YYYY-MM-DD format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate starting_session_number if provided
    if (starting_session_number !== undefined && (typeof starting_session_number !== 'number' || starting_session_number < 1 || starting_session_number > 12)) {
      return new Response(JSON.stringify({ error: 'starting_session_number must be between 1 and 12' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch group
    const { data: group, error: groupError } = await adminSupabase
      .from('groups')
      .select('*')
      .eq('id', group_id)
      .single()

    if (groupError || !group) {
      return new Response(JSON.stringify({ error: 'Group not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (group.has_started) {
      return new Response(JSON.stringify({ error: 'Group has already started' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!group.instructor_id) {
      return new Response(JSON.stringify({ error: 'Group must have an instructor assigned before starting' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Calculate start date
    const targetDay = dayMap[group.schedule_day]
    let sessionStartDate: Date

    if (start_date) {
      sessionStartDate = new Date(start_date + 'T00:00:00')
    } else {
      // Find next occurrence of schedule_day
      sessionStartDate = new Date()
      sessionStartDate.setHours(0, 0, 0, 0)
      while (sessionStartDate.getDay() !== targetDay) {
        sessionStartDate.setDate(sessionStartDate.getDate() + 1)
      }
    }

    const startingNum = starting_session_number || 1

    // Generate sessions only up to starting_session_number (not all 12)
    const sessions = []
    for (let i = 1; i <= startingNum; i++) {
      let sessionDate: Date
      let status: string

      if (i < startingNum) {
        // Past sessions: calculate backwards
        const weeksBack = startingNum - i
        sessionDate = new Date(sessionStartDate)
        sessionDate.setDate(sessionDate.getDate() - weeksBack * 7)
        status = 'completed'
      } else {
        // The starting session itself
        sessionDate = new Date(sessionStartDate)
        status = 'scheduled'
      }

      const dateStr = sessionDate.toISOString().split('T')[0]

      sessions.push({
        group_id: group.id,
        session_date: dateStr,
        session_time: group.schedule_time,
        duration_minutes: group.duration_minutes,
        status,
        session_number: i,
        level_id: group.level_id,
      })
    }

    // Insert sessions
    const { error: insertError } = await adminSupabase
      .from('sessions')
      .insert(sessions)

    if (insertError) {
      console.error('Error inserting sessions:', insertError)
      return new Response(JSON.stringify({ error: 'Failed to create sessions' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update group: mark as started and set start_date + starting_session_number
    const { error: updateError } = await adminSupabase
      .from('groups')
      .update({
        has_started: true,
        start_date: sessionStartDate.toISOString().split('T')[0],
        starting_session_number: startingNum,
      })
      .eq('id', group_id)

    if (updateError) {
      console.error('Error updating group:', updateError)
    }

    // If existing group with completed sessions, populate them
    if (startingNum > 1) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/populate-completed-sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ group_id }),
        })
      } catch (e) {
        console.error('Failed to populate completed sessions:', e)
      }
    }

    // Auto-assign subscription dates for all students in the group
    try {
      const { data: bulkResult, error: bulkError } = await adminSupabase
        .rpc('assign_subscription_dates_bulk', { p_group_id: group_id })

      if (bulkError) {
        console.error('Error assigning subscription dates:', bulkError)
      } else {
        console.log('Subscription dates assigned:', bulkResult)
      }
    } catch (e) {
      console.error('Failed to assign subscription dates:', e)
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Created ${sessions.length} sessions for group`,
      sessions_created: sessions.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    console.error('Error in start-group:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
