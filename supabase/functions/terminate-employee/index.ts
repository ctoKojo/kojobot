import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { checkRateLimit, getClientIP, rateLimitResponse } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RATE_LIMIT_CONFIG = { maxRequests: 5, windowMs: 60000 }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const clientIP = getClientIP(req)
    const rateLimitResult = checkRateLimit(clientIP, RATE_LIMIT_CONFIG)
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult, corsHeaders)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', error_ar: 'غير مصرح' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user: callingUser }, error: userError } = await userSupabase.auth.getUser()
    if (userError || !callingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', error_ar: 'غير مصرح' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Admin check
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: roleData, error: roleError } = await adminSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', callingUser.id)
      .single()

    if (roleError || roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can terminate employees', error_ar: 'الأدمن فقط يمكنه إنهاء التعاقد' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { employee_id, reason, reason_ar } = await req.json()

    // Validate
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!employee_id || !uuidRegex.test(employee_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid employee ID', error_ar: 'معرف الموظف غير صالح' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (employee_id === callingUser.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot terminate your own account', error_ar: 'لا يمكنك إنهاء تعاقدك الشخصي' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check target is an employee (instructor/reception)
    const { data: targetRole } = await adminSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', employee_id)
      .single()

    if (!targetRole || !['instructor', 'reception'].includes(targetRole.role)) {
      return new Response(
        JSON.stringify({ error: 'Can only terminate employee accounts', error_ar: 'يمكن إنهاء تعاقد الموظفين فقط' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check not already terminated
    const { data: profileData } = await adminSupabase
      .from('profiles')
      .select('employment_status, full_name')
      .eq('user_id', employee_id)
      .single()

    if (profileData?.employment_status === 'terminated') {
      return new Response(
        JSON.stringify({ error: 'Employee is already terminated', error_ar: 'تم إنهاء تعاقد الموظف بالفعل' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Admin ${callingUser.id} terminating employee ${employee_id}`)

    // 1. Remove from groups (as instructor)
    if (targetRole.role === 'instructor') {
      await adminSupabase
        .from('groups')
        .update({ instructor_id: null })
        .eq('instructor_id', employee_id)
        .eq('is_active', true)
    }

    // 2. Lock current month salary snapshot
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01'
    await adminSupabase
      .from('salary_month_snapshots')
      .update({ status: 'locked' })
      .eq('employee_id', employee_id)
      .eq('month', currentMonth)
      .eq('status', 'open')

    // 3. Deactivate salary
    await adminSupabase
      .from('employee_salaries')
      .update({ is_active: false })
      .eq('employee_id', employee_id)
      .eq('is_active', true)

    // 4. Update profile to terminated
    await adminSupabase
      .from('profiles')
      .update({
        employment_status: 'terminated',
        terminated_at: new Date().toISOString(),
        termination_reason: reason || null,
        terminated_by: callingUser.id,
      })
      .eq('user_id', employee_id)

    // 5. Send notification to employee
    await adminSupabase.from('notifications').insert({
      user_id: employee_id,
      type: 'warning',
      category: 'general',
      title: 'Contract Terminated',
      title_ar: 'تم إنهاء التعاقد',
      message: reason || 'Your contract has been terminated. Please contact administration for details.',
      message_ar: reason_ar || 'تم إنهاء تعاقدك. يرجى التواصل مع الإدارة للتفاصيل.',
      action_url: '/profile',
    })

    // 6. Ban user from auth (disable login)
    const { error: banError } = await adminSupabase.auth.admin.updateUserById(employee_id, {
      ban_duration: '876600h', // ~100 years
    })

    if (banError) {
      console.error('Error banning user:', banError)
      // Continue even if ban fails - profile is already marked terminated
    }

    console.log(`Successfully terminated employee ${employee_id}`)

    return new Response(
      JSON.stringify({ success: true }),
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
