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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Authentication check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No valid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's token to verify identity
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token)

    if (claimsError || !claimsData?.claims) {
      console.error('Auth error:', claimsError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.claims.sub as string

    // Verify user is an admin
    const { data: roleData, error: roleError } = await userSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (roleError || roleData?.role !== 'admin') {
      console.error('Role check failed:', roleError, 'Role:', roleData?.role)
      return new Response(
        JSON.stringify({ error: 'Forbidden - Only admins can delete users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const body = await req.json()
    const keepEmail = body.keepEmail // Email to keep (optional)

    console.log(`Admin ${userId} initiated user deletion. Keep email: ${keepEmail}`)

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

    console.log(`Deletion complete. Deleted: ${deletedCount}, Errors: ${errors.length}`)

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
