import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { checkRateLimit, getClientIP, rateLimitResponse } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RATE_LIMIT_CONFIG = { maxRequests: 10, windowMs: 60000 }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    const userId = callingUser.id
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Verify caller is admin or reception
    const { data: callerRoles } = await adminSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)

    const allowedRoles = new Set(['admin', 'reception'])
    const isAuthorized = (callerRoles ?? []).some((r: any) => allowedRoles.has(r.role))

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Only admins or reception can delete parents', error_ar: 'غير مسموح - الأدمن أو الاستقبال فقط' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const targetUserId: string | undefined = body.parent_id

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'parent_id is required', error_ar: 'معرف ولي الأمر مطلوب' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(targetUserId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid parent ID format', error_ar: 'صيغة المعرف غير صالحة' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (targetUserId === userId) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete your own account', error_ar: 'لا يمكنك حذف حسابك' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Confirm target is actually a parent
    const { data: targetRoles } = await adminSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', targetUserId)

    const isParent = (targetRoles ?? []).some((r: any) => r.role === 'parent')
    if (!isParent) {
      return new Response(
        JSON.stringify({ error: 'Target user is not a parent', error_ar: 'المستخدم المستهدف ليس ولي أمر' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`User ${userId} deleting parent ${targetUserId}`)

    // Cleanup related records (best-effort, ignore individual errors)
    const cleanups = [
      adminSupabase.from('parent_students').delete().eq('parent_id', targetUserId),
      adminSupabase.from('notifications').delete().eq('user_id', targetUserId),
      adminSupabase.from('user_roles').delete().eq('user_id', targetUserId),
      adminSupabase.from('activity_logs').delete().eq('user_id', targetUserId),
      adminSupabase.from('profiles').delete().eq('user_id', targetUserId),
    ]

    for (const op of cleanups) {
      const { error } = await op
      if (error) console.warn('Cleanup warning:', error.message)
    }

    // Finally remove from auth
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(targetUserId)
    if (deleteError) {
      console.error('Auth delete error:', deleteError)
      return new Response(
        JSON.stringify({ error: `Failed to delete user: ${deleteError.message}`, error_ar: `فشل الحذف: ${deleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Parent ${targetUserId} fully deleted`)
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', error_ar: 'خطأ داخلي في الخادم' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
