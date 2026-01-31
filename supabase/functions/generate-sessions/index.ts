import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Group {
  id: string
  name: string
  schedule_day: string
  schedule_time: string
  duration_minutes: number
  is_active: boolean
  level_id: string | null
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

const SESSIONS_PER_LEVEL = 12

function getNextDateForDay(dayName: string, weeksAhead: number = 0): string {
  const targetDay = dayMap[dayName]
  if (targetDay === undefined) {
    console.error(`Invalid day name: ${dayName}`)
    return ''
  }

  const today = new Date()
  const currentDay = today.getDay()
  
  // Calculate days until target day
  let daysUntil = targetDay - currentDay
  if (daysUntil < 0) {
    daysUntil += 7 // Next week
  }
  
  // Add weeks ahead
  daysUntil += weeksAhead * 7
  
  const targetDate = new Date(today)
  targetDate.setDate(today.getDate() + daysUntil)
  
  // Format as YYYY-MM-DD
  return targetDate.toISOString().split('T')[0]
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting session generation...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Get all active groups
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name, schedule_day, schedule_time, duration_minutes, is_active, level_id')
      .eq('is_active', true)

    if (groupsError) {
      console.error('Error fetching groups:', groupsError)
      throw groupsError
    }

    console.log(`Found ${groups?.length || 0} active groups`)

    if (!groups || groups.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active groups found',
          created: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let createdCount = 0
    let skippedCount = 0
    let levelCompleteCount = 0
    const errors: string[] = []

    // Generate sessions for next 4 weeks
    const weeksToGenerate = 4

    for (const group of groups as Group[]) {
      console.log(`Processing group: ${group.name} (${group.schedule_day} at ${group.schedule_time})`)
      
      // Get the highest session number for this group
      const { data: lastSession, error: lastSessionError } = await supabase
        .from('sessions')
        .select('session_number')
        .eq('group_id', group.id)
        .not('session_number', 'is', null)
        .order('session_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastSessionError) {
        console.error(`Error fetching last session for ${group.name}:`, lastSessionError)
      }

      const currentMaxSessionNumber = lastSession?.session_number || 0
      console.log(`Group ${group.name} current max session number: ${currentMaxSessionNumber}`)

      // Check if level is complete (reached 12 sessions)
      if (currentMaxSessionNumber >= SESSIONS_PER_LEVEL) {
        console.log(`Level complete for ${group.name} (${currentMaxSessionNumber}/${SESSIONS_PER_LEVEL} sessions)`)
        levelCompleteCount++
        continue
      }

      // Calculate how many more sessions we can create
      const remainingSessions = SESSIONS_PER_LEVEL - currentMaxSessionNumber
      const sessionsToCreate = Math.min(weeksToGenerate, remainingSessions)

      let nextSessionNumber = currentMaxSessionNumber

      for (let week = 0; week < sessionsToCreate; week++) {
        const sessionDate = getNextDateForDay(group.schedule_day, week)
        
        if (!sessionDate) {
          console.error(`Could not calculate date for ${group.schedule_day}`)
          errors.push(`Invalid day for group ${group.name}: ${group.schedule_day}`)
          continue
        }

        // Check if session already exists for this group and date
        const { data: existingSession } = await supabase
          .from('sessions')
          .select('id')
          .eq('group_id', group.id)
          .eq('session_date', sessionDate)
          .maybeSingle()

        if (existingSession) {
          console.log(`Session already exists for ${group.name} on ${sessionDate}`)
          skippedCount++
          continue
        }

        // Increment session number for new session
        nextSessionNumber++

        // Double check we don't exceed the limit
        if (nextSessionNumber > SESSIONS_PER_LEVEL) {
          console.log(`Level limit reached for ${group.name}, stopping session generation`)
          break
        }

        // Create new session with session_number
        const { error: insertError } = await supabase
          .from('sessions')
          .insert({
            group_id: group.id,
            session_date: sessionDate,
            session_time: group.schedule_time,
            duration_minutes: group.duration_minutes,
            status: 'scheduled',
            session_number: nextSessionNumber,
          })

        if (insertError) {
          console.error(`Error creating session for ${group.name}:`, insertError)
          errors.push(`Failed to create session for ${group.name} on ${sessionDate}`)
        } else {
          console.log(`Created session #${nextSessionNumber} for ${group.name} on ${sessionDate}`)
          createdCount++
        }
      }
    }

    const result = {
      success: true,
      message: `Generated sessions for ${groups.length} groups`,
      created: createdCount,
      skipped: skippedCount,
      levelComplete: levelCompleteCount,
      sessionsPerLevel: SESSIONS_PER_LEVEL,
      errors: errors.length > 0 ? errors : undefined,
    }

    console.log('Session generation complete:', result)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in generate-sessions:', error)
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
