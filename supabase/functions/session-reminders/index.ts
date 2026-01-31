import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Get current time and time 1 hour from now
    const now = new Date()
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)
    
    const today = now.toISOString().split('T')[0]
    const currentTime = now.toTimeString().slice(0, 5) // HH:MM format
    const targetTime = oneHourLater.toTimeString().slice(0, 5)

    console.log(`Checking sessions for ${today} between ${currentTime} and ${targetTime}`)

    // Find sessions that start within the next hour
    const { data: upcomingSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        group_id,
        session_date,
        session_time,
        groups (
          name,
          name_ar,
          instructor_id
        )
      `)
      .eq('session_date', today)
      .eq('status', 'scheduled')
      .gte('session_time', currentTime)
      .lte('session_time', targetTime)

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
      throw sessionsError
    }

    console.log(`Found ${upcomingSessions?.length || 0} sessions starting soon`)

    if (!upcomingSessions || upcomingSessions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No upcoming sessions in the next hour',
          notificationsSent: 0 
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

      // Check if notification already sent for this session
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', instructorId)
        .eq('action_url', `/sessions?highlight=${session.id}`)
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
          action_url: `/attendance?session=${session.id}&group=${session.group_id}`,
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
