import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { checkRateLimit, getClientIP, rateLimitResponse } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limit config: 5 user creations per minute per IP
const RATE_LIMIT_CONFIG = { maxRequests: 5, windowMs: 60000 }

interface CreateUserRequest {
  email: string
  password: string
  full_name: string
  full_name_ar?: string
  phone?: string
  role: 'admin' | 'student' | 'instructor' | 'reception'
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
  work_type?: 'full_time' | 'part_time'
  is_paid_trainee?: boolean
  hourly_rate?: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Apply rate limiting
    const clientIP = getClientIP(req)
    const rateLimitResult = checkRateLimit(clientIP, RATE_LIMIT_CONFIG)
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for create-user from IP: ${clientIP}`)
      return rateLimitResponse(rateLimitResult, corsHeaders)
    }

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

    // Parse request body FIRST (needed for role check below)
    const body: CreateUserRequest = await req.json()
    console.log('Creating user with role:', body.role)

    // If not bootstrap mode, verify authentication
    if (!isBootstrapMode) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        console.error('Missing or invalid authorization header')
        return new Response(
          JSON.stringify({ error: 'Unauthorized', error_ar: 'غير مصرح' }),
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
          JSON.stringify({ error: 'Unauthorized', error_ar: 'غير مصرح' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const userId = claimsData.claims.sub as string

      // Check if user is admin or reception
      const { data: roleData, error: roleError } = await userSupabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single()

      const requesterRole = roleData?.role
      if (roleError || !requesterRole || !['admin', 'reception'].includes(requesterRole)) {
        console.error('User is not authorized:', roleError)
        return new Response(
          JSON.stringify({ error: 'Only admins and reception can create users', error_ar: 'فقط المديرون وموظفو الاستقبال يمكنهم إنشاء مستخدمين' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Reception can only create students
      if (requesterRole === 'reception' && body.role !== 'student') {
        console.error('Reception attempted to create non-student role:', body.role)
        return new Response(
          JSON.stringify({ error: 'Reception can only create student accounts', error_ar: 'الاستقبال يمكنه فقط إنشاء حسابات الطلاب' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // In bootstrap mode, only allow creating admin
    if (isBootstrapMode && body.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'First user must be an admin', error_ar: 'أول مستخدم يجب أن يكون مدير' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate required fields
    if (!body.email || !body.password || !body.full_name || !body.role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, full_name, role', error_ar: 'حقول مطلوبة ناقصة: البريد الإلكتروني، كلمة المرور، الاسم، الدور' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email) || body.email.length > 255) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format', error_ar: 'صيغة البريد الإلكتروني غير صحيحة' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate password strength
    if (body.password.length < 8 || body.password.length > 128) {
      return new Response(
        JSON.stringify({ error: 'Password must be between 8 and 128 characters', error_ar: 'كلمة المرور يجب أن تكون بين 8 و 128 حرف' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate name length
    if (body.full_name.trim().length < 2 || body.full_name.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Full name must be between 2 and 200 characters', error_ar: 'الاسم يجب أن يكون بين 2 و 200 حرف' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate role
    const validRoles = ['admin', 'student', 'instructor', 'reception']
    if (!validRoles.includes(body.role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role', error_ar: 'دور غير صحيح' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate phone format if provided (Egyptian format)
    if (body.phone && !/^01[0-9]{9}$/.test(body.phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format. Must be 11 digits starting with 01', error_ar: 'صيغة رقم الهاتف غير صحيحة. يجب أن يكون 11 رقم يبدأ بـ 01' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate optional fields
    if (body.full_name_ar && body.full_name_ar.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Arabic name must not exceed 200 characters', error_ar: 'الاسم العربي يجب ألا يتجاوز 200 حرف' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (body.hourly_rate !== undefined && (typeof body.hourly_rate !== 'number' || body.hourly_rate < 0 || body.hourly_rate > 100000)) {
      return new Response(
        JSON.stringify({ error: 'Invalid hourly rate', error_ar: 'معدل الساعة غير صحيح' }),
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
      // Map common auth errors to bilingual messages
      let errorMsg = authError.message
      let errorMsgAr = 'فشل في إنشاء الحساب'
      if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
        errorMsg = 'This email is already registered'
        errorMsgAr = 'هذا البريد الإلكتروني مسجل بالفعل'
      }
      return new Response(
        JSON.stringify({ error: errorMsg, error_ar: errorMsgAr }),
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
      profileData.work_type = body.work_type || 'full_time'
      profileData.is_paid_trainee = body.employment_status === 'training' ? (body.is_paid_trainee || false) : false
      profileData.hourly_rate = body.employment_status === 'training' && body.is_paid_trainee ? (body.hourly_rate || null) : null
    }

    const { error: profileError } = await adminSupabase
      .from('profiles')
      .insert(profileData)

    if (profileError) {
      console.error('Error creating profile:', profileError)
      await adminSupabase.auth.admin.deleteUser(newUserId)
      return new Response(
        JSON.stringify({ error: 'Failed to create profile', error_ar: 'فشل في إنشاء الملف الشخصي' }),
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
      await adminSupabase.from('profiles').delete().eq('user_id', newUserId)
      await adminSupabase.auth.admin.deleteUser(newUserId)
      return new Response(
        JSON.stringify({ error: 'Failed to assign role', error_ar: 'فشل في تعيين الدور' }),
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
      JSON.stringify({ error: 'Internal server error', error_ar: 'خطأ داخلي في الخادم' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
