import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { checkRateLimit, getClientIP, rateLimitResponse } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limit: 5 attempts per minute per IP
const RATE_LIMIT_CONFIG = { maxRequests: 5, windowMs: 60000 }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Rate limiting
  const clientIP = getClientIP(req)
  const rateLimitResult = checkRateLimit(`register-parent:${clientIP}`, RATE_LIMIT_CONFIG)
  if (!rateLimitResult.allowed) {
    console.log(`Rate limit exceeded for register-parent from IP: ${clientIP}`)
    return rateLimitResponse(rateLimitResult, corsHeaders)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify the user's JWT
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { codes } = await req.json()
    if (!Array.isArray(codes) || codes.length === 0 || codes.length > 10) {
      return new Response(JSON.stringify({ error: 'Provide 1-10 valid codes' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Sanitize codes
    const sanitizedCodes = codes.map((c: string) => String(c).trim().toUpperCase()).filter(Boolean)
    if (sanitizedCodes.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid codes provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Check if user already has a non-parent role
    const { data: existingRoles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    const hasNonParentRole = existingRoles?.some(r => r.role !== 'parent')
    if (hasNonParentRole) {
      return new Response(JSON.stringify({ error: 'This account already has another role and cannot be used as a parent account' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate all codes
    const { data: validCodes, error: codesError } = await adminClient
      .from('parent_link_codes')
      .select('*')
      .in('code', sanitizedCodes)

    if (codesError) {
      console.error('Error fetching codes:', codesError)
      return new Response(JSON.stringify({ error: 'Failed to validate codes' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check each code's status
    const results: { code: string; status: string; studentId?: string }[] = []
    const validEntries: { code: any; studentId: string }[] = []

    for (const inputCode of sanitizedCodes) {
      const found = validCodes?.find(c => c.code === inputCode)
      if (!found) {
        results.push({ code: inputCode, status: 'invalid' })
      } else if (found.used_at) {
        results.push({ code: inputCode, status: 'already_used' })
      } else if (new Date(found.expires_at) < new Date()) {
        results.push({ code: inputCode, status: 'expired' })
      } else {
        validEntries.push({ code: found, studentId: found.student_id })
        results.push({ code: inputCode, status: 'success', studentId: found.student_id })
      }
    }

    if (validEntries.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid codes found', details: results }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Assign parent role if not already assigned
    const isAlreadyParent = existingRoles?.some(r => r.role === 'parent')
    if (!isAlreadyParent) {
      await adminClient.from('user_roles').insert({ user_id: user.id, role: 'parent' })
    }

    // Create profile if not exists
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existingProfile) {
      await adminClient.from('profiles').insert({
        user_id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Parent',
        full_name_ar: user.user_metadata?.full_name || 'ولي أمر',
        email: user.email,
        role: 'parent',
      })
    }

    // Link each valid code
    for (const entry of validEntries) {
      // Check if already linked
      const { data: existingLink } = await adminClient
        .from('parent_students')
        .select('id')
        .eq('parent_id', user.id)
        .eq('student_id', entry.studentId)
        .maybeSingle()

      if (!existingLink) {
        await adminClient.from('parent_students').insert({
          parent_id: user.id,
          student_id: entry.studentId,
          relationship: 'parent',
        })
      }

      // Mark code as used
      await adminClient.from('parent_link_codes').update({
        used_by: user.id,
        used_at: new Date().toISOString(),
      }).eq('id', entry.code.id)

      // Audit log
      await adminClient.from('parent_link_audit').insert({
        parent_id: user.id,
        student_id: entry.studentId,
        code_id: entry.code.id,
        action: 'linked',
        ip_address: clientIP,
      })
    }

    return new Response(JSON.stringify({
      success: true,
      linked: validEntries.length,
      details: results,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('register-parent error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
