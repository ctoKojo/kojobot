import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Find pending/in_progress tests where window has passed
    // Window = scheduled_at + duration_minutes + 5 min grace
    const { data: expiredTests, error } = await adminSupabase
      .from('placement_tests')
      .select('id, scheduled_at, duration_minutes')
      .in('status', ['pending', 'in_progress'])

    if (error) {
      console.error('Error fetching placement tests:', error)
      return new Response(JSON.stringify({ error: 'Failed to fetch tests' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const now = Date.now()
    const gracePeriodMs = 5 * 60 * 1000
    const idsToExpire: string[] = []

    for (const test of expiredTests || []) {
      const scheduledAt = new Date(test.scheduled_at).getTime()
      const windowEnd = scheduledAt + (test.duration_minutes * 60 * 1000) + gracePeriodMs
      if (now > windowEnd) {
        idsToExpire.push(test.id)
      }
    }

    let expiredCount = 0
    if (idsToExpire.length > 0) {
      const { error: updateError } = await adminSupabase
        .from('placement_tests')
        .update({ status: 'expired' })
        .in('id', idsToExpire)

      if (updateError) {
        console.error('Error expiring tests:', updateError)
      } else {
        expiredCount = idsToExpire.length
      }
    }

    console.log(`Expired ${expiredCount} placement tests`)

    return new Response(
      JSON.stringify({ expired_count: expiredCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
