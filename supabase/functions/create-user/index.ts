import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  email: string
  password: string
  full_name: string
  full_name_ar?: string
  phone?: string
  role: 'admin' | 'student' | 'instructor'
  // Student-specific fields
  date_of_birth?: string
  age_group_id?: string
  level_id?: string
  subscription_type?: 'kojo_squad' | 'kojo_core' | 'kojo_x'
  attendance_mode?: 'online' | 'offline'
  // Instructor-specific fields
  specialization?: string
  specialization_ar?: string
  employment_status?: 'permanent' | 'training'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Create admin client with service role key
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Check if this is the first user (bootstrap mode)
    const { count: userCount, error: countError } = await adminSupabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })

    const isBootstrapMode = !countError && userCount === 0
    console.log('Bootstrap mode:', isBootstrapMode, 'User count:', userCount)

    // If not bootstrap mode, verify authentication
    if (!isBootstrapMode) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        console.error('Missing or invalid authorization header')
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create Supabase client with user's token to verify they're an admin
      const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      })

      // Verify the user's token and get their role
      const token = authHeader.replace('Bearer ', '')
      const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token)
      
      if (claimsError || !claimsData?.claims) {
        console.error('Failed to verify token:', claimsError)
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const userId = claimsData.claims.sub as string

      // Check if user is admin
      const { data: roleData, error: roleError } = await userSupabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single()

      if (roleError || roleData?.role !== 'admin') {
        console.error('User is not an admin:', roleError)
        return new Response(
          JSON.stringify({ error: 'Only admins can create users' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Parse request body
    const body: CreateUserRequest = await req.json()
    console.log('Creating user with role:', body.role)

    // In bootstrap mode, only allow creating admin
    if (isBootstrapMode && body.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'First user must be an admin' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate required fields
    if (!body.email || !body.password || !body.full_name || !body.role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, full_name, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (body.password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create user in auth.users
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: body.full_name,
      }
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const newUserId = authData.user.id
    console.log('Created auth user:', newUserId)

    // Create profile
    const profileData: Record<string, unknown> = {
      user_id: newUserId,
      email: body.email,
      full_name: body.full_name,
      full_name_ar: body.full_name_ar || null,
      phone: body.phone || null,
    }

    // Add role-specific fields
    if (body.role === 'student') {
      profileData.date_of_birth = body.date_of_birth || null
      profileData.age_group_id = body.age_group_id || null
      profileData.level_id = body.level_id || null
      profileData.subscription_type = body.subscription_type || null
      profileData.attendance_mode = body.attendance_mode || 'offline'
    } else if (body.role === 'instructor') {
      profileData.specialization = body.specialization || null
      profileData.specialization_ar = body.specialization_ar || null
      profileData.employment_status = body.employment_status || 'training'
    }

    const { error: profileError } = await adminSupabase
      .from('profiles')
      .insert(profileData)

    if (profileError) {
      console.error('Error creating profile:', profileError)
      // Clean up: delete the auth user if profile creation fails
      await adminSupabase.auth.admin.deleteUser(newUserId)
      return new Response(
        JSON.stringify({ error: 'Failed to create profile: ' + profileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Created profile for user:', newUserId)

    // Assign role
    const { error: roleInsertError } = await adminSupabase
      .from('user_roles')
      .insert({
        user_id: newUserId,
        role: body.role
      })

    if (roleInsertError) {
      console.error('Error assigning role:', roleInsertError)
      // Clean up
      await adminSupabase.from('profiles').delete().eq('user_id', newUserId)
      await adminSupabase.auth.admin.deleteUser(newUserId)
      return new Response(
        JSON.stringify({ error: 'Failed to assign role: ' + roleInsertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Assigned role:', body.role, 'to user:', newUserId)

    // Log activity (skip in bootstrap mode as there's no requesting user)
    if (!isBootstrapMode) {
      const authHeader = req.headers.get('Authorization')!
      const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      })
      const token = authHeader.replace('Bearer ', '')
      const { data: claimsData } = await userSupabase.auth.getClaims(token)
      const requestingUserId = claimsData?.claims?.sub as string

      await adminSupabase.from('activity_logs').insert({
        user_id: requestingUserId,
        action: 'create',
        entity_type: body.role,
        entity_id: newUserId,
        details: { email: body.email, full_name: body.full_name }
      })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: newUserId,
        message: `${body.role} created successfully`
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
