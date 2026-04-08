import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCairoTimeWindowDates, getCairoNow } from '../_shared/cairoTime.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Session {
  id: string
  group_id: string
  session_date: string
  session_time: string
  groups: {
    name: string
    name_ar: string
    instructor_id: string
    status: string
  }
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

    console.log('Starting session reminder check...')
    
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // AC-3: Use Cairo timezone for time window calculation
    const window = getCairoTimeWindowDates(1)
    const cairo = getCairoNow()

    console.log(`Cairo time: ${cairo.today} ${cairo.timeHHMMSS}`)
    console.log(`Window: ${window.startDate} ${window.startTime} → ${window.endDate} ${window.endTime} (midnight: ${window.crossesMidnight})`)

    // AC-3: Build query based on whether window crosses midnight
    let upcomingSessions: unknown[] = []

    if (window.crossesMidnight) {
      // Dual query for midnight crossing
      // Part 1: sessions today from startTime to 23:59:59
      const { data: todaySessions, error: e1 } = await supabase
        .from('sessions')
        .select(`id, group_id, session_date, session_time, groups!inner(name, name_ar, instructor_id, status)`)
        .eq('session_date', window.startDate)
        .eq('status', 'scheduled')
        .neq('groups.status', 'frozen')
        .gte('session_time', window.startTime)

      if (e1) throw e1

      // Part 2: sessions tomorrow from 00:00:00 to endTime (exclusive)
      const { data: tomorrowSessions, error: e2 } = await supabase
        .from('sessions')
        .select(`id, group_id, session_date, session_time, groups!inner(name, name_ar, instructor_id, status)`)
        .eq('session_date', window.endDate)
        .eq('status', 'scheduled')
        .neq('groups.status', 'frozen')
        .lt('session_time', window.endTime)

      if (e2) throw e2

      upcomingSessions = [...(todaySessions || []), ...(tomorrowSessions || [])]
    } else {
      // AC-3: Normal window — gte startTime, lt endTime (exclusive end)
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select(`id, group_id, session_date, session_time, groups!inner(name, name_ar, instructor_id, status)`)
        .eq('session_date', window.startDate)
        .eq('status', 'scheduled')
        .neq('groups.status', 'frozen')
        .gte('session_time', window.startTime)
        .lt('session_time', window.endTime)

      if (sessionsError) throw sessionsError
      upcomingSessions = sessions || []
    }

    console.log(`Found ${upcomingSessions.length} sessions starting soon`)

    if (upcomingSessions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No upcoming sessions in the next hour',
          notificationsSent: 0,
          cairoTime: `${cairo.today} ${cairo.timeHHMMSS}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let notificationsSent = 0
    const errors: string[] = []

    for (const session of upcomingSessions as unknown as Session[]) {
      const instructorId = session.groups?.instructor_id
      
      if (!instructorId) {
        console.log(`No instructor found for session ${session.id}`)
        continue
      }

      // AC-4: Duplicate check via action_url which contains session ID
      const actionUrl = `/attendance?session=${session.id}&group=${session.group_id}`
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', instructorId)
        .eq('action_url', actionUrl)
        .single()

      if (existingNotification) {
        console.log(`Notification already sent for session ${session.id}`)
        continue
      }

      // Create notification for instructor
      const groupName = session.groups?.name || 'Unknown Group'
      const groupNameAr = session.groups?.name_ar || 'مجموعة'

      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: instructorId,
          title: `Session Starting Soon`,
          title_ar: `السيشن على وشك البدء`,
          message: `Your session with ${groupName} starts at ${session.session_time}`,
          message_ar: `سيشن ${groupNameAr} سيبدأ الساعة ${session.session_time}`,
          type: 'reminder',
          category: 'session',
          action_url: actionUrl,
        })

      if (notifError) {
        console.error(`Error creating notification for session ${session.id}:`, notifError)
        errors.push(`Failed to notify for session ${session.id}`)
      } else {
        console.log(`Notification sent for session ${session.id} to instructor ${instructorId}`)
        notificationsSent++
      }
    }

    const result = {
      success: true,
      message: `Processed ${upcomingSessions.length} upcoming sessions`,
      notificationsSent,
      cairoTime: `${cairo.today} ${cairo.timeHHMMSS}`,
      errors: errors.length > 0 ? errors : undefined,
    }

    console.log('Session reminder check complete:', result)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in session-reminders:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
