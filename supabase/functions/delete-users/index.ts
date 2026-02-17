import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { checkRateLimit, getClientIP, rateLimitResponse } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limit config: 5 delete operations per minute per IP
const RATE_LIMIT_CONFIG = { maxRequests: 5, windowMs: 60000 }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Apply rate limiting
    const clientIP = getClientIP(req)
    const rateLimitResult = checkRateLimit(clientIP, RATE_LIMIT_CONFIG)
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for delete-users from IP: ${clientIP}`)
      return rateLimitResponse(rateLimitResult, corsHeaders)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Authentication check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No valid authorization header', error_ar: 'غير مصرح - لا يوجد رمز تفويض صالح' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's token to verify identity
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user: callingUser }, error: userError } = await userSupabase.auth.getUser()

    if (userError || !callingUser) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token', error_ar: 'غير مصرح - رمز غير صالح' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = callingUser.id

    // Verify user is an admin
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: roleData, error: roleError } = await adminSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (roleError || roleData?.role !== 'admin') {
      console.error('Role check failed:', roleError, 'Role:', roleData?.role)
      return new Response(
        JSON.stringify({ error: 'Forbidden - Only admins can delete users', error_ar: 'غير مسموح - الأدمن فقط يمكنه حذف المستخدمين' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const targetUserId = body.user_id // Single user deletion
    const keepEmail = body.keepEmail // Bulk: Email to keep (optional)

    // ---- Mode 1: Delete a single user by ID ----
    if (targetUserId) {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(targetUserId)) {
        return new Response(
          JSON.stringify({ error: 'Invalid user ID format', error_ar: 'صيغة معرف المستخدم غير صالحة' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Prevent self-deletion
      if (targetUserId === userId) {
        return new Response(
          JSON.stringify({ error: 'Cannot delete your own account', error_ar: 'لا يمكنك حذف حسابك الخاص' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check target user's role - only allow deleting students
      const { data: targetRole } = await adminSupabase
        .from('user_roles')
        .select('role')
        .eq('user_id', targetUserId)
        .single()

      if (targetRole?.role !== 'student') {
        return new Response(
          JSON.stringify({ error: 'Can only delete student accounts', error_ar: 'يمكن حذف حسابات الطلاب فقط' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`Admin ${userId} deleting student ${targetUserId}`)

      // Clean up related data
      await adminSupabase.from('attendance').delete().eq('student_id', targetUserId)
      await adminSupabase.from('warnings').delete().eq('student_id', targetUserId)
      await adminSupabase.from('quiz_submissions').delete().eq('student_id', targetUserId)
      await adminSupabase.from('assignment_submissions').delete().eq('student_id', targetUserId)
      await adminSupabase.from('makeup_sessions').delete().eq('student_id', targetUserId)
      await adminSupabase.from('notifications').delete().eq('user_id', targetUserId)
      await adminSupabase.from('group_students').delete().eq('student_id', targetUserId)
      
      // Delete payments then subscriptions
      const { data: subs } = await adminSupabase
        .from('subscriptions')
        .select('id')
        .eq('student_id', targetUserId)
      if (subs && subs.length > 0) {
        const subIds = subs.map(s => s.id)
        await adminSupabase.from('payments').delete().in('subscription_id', subIds)
      }
      await adminSupabase.from('subscriptions').delete().eq('student_id', targetUserId)

      // Delete profile and role
      await adminSupabase.from('profiles').delete().eq('user_id', targetUserId)
      await adminSupabase.from('user_roles').delete().eq('user_id', targetUserId)
      await adminSupabase.from('activity_logs').delete().eq('user_id', targetUserId)

      // Delete from auth
      const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(targetUserId)

      if (deleteError) {
        console.error(`Error deleting user ${targetUserId}:`, deleteError)
        return new Response(
          JSON.stringify({ error: `Failed to delete user: ${deleteError.message}`, error_ar: `فشل في حذف المستخدم: ${deleteError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`Successfully deleted student ${targetUserId}`)
      return new Response(
        JSON.stringify({ success: true, deletedCount: 1 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ---- Mode 2: Bulk delete (legacy - keep email) ----
    console.log(`Admin ${userId} initiated bulk user deletion. Keep email: ${keepEmail}`)

    const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers()

    if (listError) {
      console.error('Error listing users:', listError)
      return new Response(
        JSON.stringify({ error: listError.message, error_ar: 'فشل في تحميل قائمة المستخدمين' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let deletedCount = 0
    const errors: string[] = []

    for (const user of users) {
      if (keepEmail && user.email === keepEmail) {
        console.log(`Keeping user: ${user.email}`)
        continue
      }

      console.log(`Deleting user: ${user.email}`)
      await adminSupabase.from('profiles').delete().eq('user_id', user.id)
      await adminSupabase.from('user_roles').delete().eq('user_id', user.id)

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
      JSON.stringify({ error: 'Internal server error', error_ar: 'خطأ داخلي في الخادم' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
