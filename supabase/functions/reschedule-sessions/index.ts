import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Session {
  id: string
  session_number: number
  session_date: string
  session_time: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Authentication check - require admin role
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

    // Check if user is admin
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: roleData } = await adminSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { group_id } = await req.json()
    
    // Validate group_id format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!group_id || typeof group_id !== 'string' || !uuidRegex.test(group_id)) {
      return new Response(
        JSON.stringify({ error: 'Valid group_id (UUID) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Get group info
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, name, name_ar, schedule_day, schedule_time, duration_minutes')
      .eq('id', group_id)
      .single()

    if (groupError || !group) {
      return new Response(
        JSON.stringify({ error: 'Group not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Day name to number mapping
    const dayMap: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    }
    
    const targetDay = dayMap[group.schedule_day]
    
    // Find next occurrence of target day
    let startDate = new Date()
    startDate.setHours(0, 0, 0, 0)
    while (startDate.getDay() !== targetDay) {
      startDate.setDate(startDate.getDate() + 1)
    }

    // Get future scheduled sessions
    const today = new Date().toISOString().split('T')[0]
    const { data: futureSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, session_number, session_date, session_time')
      .eq('group_id', group_id)
      .eq('status', 'scheduled')
      .gte('session_date', today)
      .order('session_number', { ascending: true })

    if (sessionsError) {
      throw sessionsError
    }

    let updatedCount = 0
    const changedSessions: { session_number: number, old_date: string, new_date: string }[] = []

    // Update each session
    for (const session of (futureSessions as Session[] || [])) {
      const weekOffset = (session.session_number - 1) * 7
      const newDate = new Date(startDate)
      newDate.setDate(newDate.getDate() + weekOffset)
      const newDateStr = newDate.toISOString().split('T')[0]

      // Track if date changed
      if (session.session_date !== newDateStr || session.session_time !== group.schedule_time) {
        changedSessions.push({
          session_number: session.session_number,
          old_date: session.session_date,
          new_date: newDateStr
        })
      }

      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          session_date: newDateStr,
          session_time: group.schedule_time,
          duration_minutes: group.duration_minutes,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id)

      if (!updateError) {
        updatedCount++
      }
    }

    // If sessions were changed, notify students in the group
    if (changedSessions.length > 0) {
      // Get all active students in this group
      const { data: groupStudents } = await supabase
        .from('group_students')
        .select('student_id')
        .eq('group_id', group_id)
        .eq('is_active', true)

      if (groupStudents && groupStudents.length > 0) {
        const notifications = groupStudents.map(gs => ({
          user_id: gs.student_id,
          title: 'Session Schedule Updated',
          title_ar: 'تم تحديث مواعيد السيشنات',
          message: `The schedule for "${group.name}" has been updated. ${changedSessions.length} session(s) have new dates.`,
          message_ar: `تم تحديث جدول مجموعة "${group.name_ar}". تم تغيير مواعيد ${changedSessions.length} سيشن.`,
          type: 'info',
          category: 'session',
          action_url: `/groups/${group_id}`
        }))

        await supabase.from('notifications').insert(notifications)
        console.log(`Sent notifications to ${groupStudents.length} students about schedule change`)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: updatedCount,
        changes: changedSessions,
        message: `Rescheduled ${updatedCount} sessions` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
