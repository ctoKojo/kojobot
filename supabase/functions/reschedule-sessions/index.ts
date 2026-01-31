import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Map day names to day numbers (0 = Sunday)
const dayMap: Record<string, number> = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6,
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { group_id } = await req.json()

    if (!group_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'group_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Rescheduling sessions for group: ${group_id}`)

    // Get group details
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, schedule_day, schedule_time, duration_minutes')
      .eq('id', group_id)
      .single()

    if (groupError || !group) {
      console.error('Error fetching group:', groupError)
      return new Response(
        JSON.stringify({ success: false, error: 'Group not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get target day number
    const targetDay = dayMap[group.schedule_day]
    if (targetDay === undefined) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid schedule_day: ${group.schedule_day}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate the next occurrence of the target day
    const today = new Date()
    let startDate = new Date(today)
    while (startDate.getDay() !== targetDay) {
      startDate.setDate(startDate.getDate() + 1)
    }

    // Get all future scheduled sessions ordered by session_number
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, session_number')
      .eq('group_id', group_id)
      .eq('status', 'scheduled')
      .gte('session_date', today.toISOString().split('T')[0])
      .order('session_number', { ascending: true })

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch sessions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No future scheduled sessions to reschedule',
          updated: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${sessions.length} sessions to reschedule`)

    // Update each session with new date based on its position
    let updatedCount = 0
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i]
      const newDate = new Date(startDate)
      newDate.setDate(startDate.getDate() + (i * 7))
      const newDateStr = newDate.toISOString().split('T')[0]

      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          session_date: newDateStr,
          session_time: group.schedule_time,
          duration_minutes: group.duration_minutes,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id)

      if (updateError) {
        console.error(`Error updating session ${session.id}:`, updateError)
      } else {
        console.log(`Updated session #${session.session_number} to ${newDateStr}`)
        updatedCount++
      }
    }

    const result = {
      success: true,
      message: `Rescheduled ${updatedCount} sessions starting from ${startDate.toISOString().split('T')[0]}`,
      updated: updatedCount,
      startDate: startDate.toISOString().split('T')[0],
      scheduleDay: group.schedule_day,
      scheduleTime: group.schedule_time
    }

    console.log('Reschedule complete:', result)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in reschedule-sessions:', error)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
