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
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const body = await req.json()
    const keepEmail = body.keepEmail // Email to keep (optional)

    console.log('Fetching all users...')

    // List all users
    const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers()

    if (listError) {
      console.error('Error listing users:', listError)
      return new Response(
        JSON.stringify({ error: listError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${users.length} users`)

    let deletedCount = 0
    const errors: string[] = []

    for (const user of users) {
      // Skip the user we want to keep
      if (keepEmail && user.email === keepEmail) {
        console.log(`Keeping user: ${user.email}`)
        continue
      }

      console.log(`Deleting user: ${user.email}`)

      // Delete from profiles first
      await adminSupabase.from('profiles').delete().eq('user_id', user.id)
      
      // Delete from user_roles
      await adminSupabase.from('user_roles').delete().eq('user_id', user.id)

      // Delete from auth
      const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id)

      if (deleteError) {
        console.error(`Error deleting user ${user.email}:`, deleteError)
        errors.push(`Failed to delete ${user.email}: ${deleteError.message}`)
      } else {
        deletedCount++
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        deletedCount,
        totalUsers: users.length,
        errors: errors.length > 0 ? errors : undefined
      }),
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
