import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { checkRateLimit, getClientIP, rateLimitResponse } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limit: 60 saves per minute per IP (debounced 3s = ~20 max realistic)
const RATE_LIMIT_CONFIG = { maxRequests: 60, windowMs: 60000 }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const clientIP = getClientIP(req)
    const rl = checkRateLimit(clientIP, RATE_LIMIT_CONFIG)
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claimsData.claims.sub as string

    const body = await req.json()
    const { quiz_assignment_id, answers } = body

    // Validate inputs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!quiz_assignment_id || typeof quiz_assignment_id !== 'string' || !uuidRegex.test(quiz_assignment_id)) {
      return new Response(JSON.stringify({ error: 'Invalid quiz_assignment_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return new Response(JSON.stringify({ error: 'Invalid answers format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const serverReceivedAt = new Date().toISOString()

    // Read existing draft_answers from exam_live_progress
    const { data: existing } = await adminSupabase
      .from('exam_live_progress')
      .select('draft_answers, draft_version')
      .eq('quiz_assignment_id', quiz_assignment_id)
      .eq('student_id', userId)
      .maybeSingle()

    // Per-question merge: only update if incoming timestamp > existing timestamp
    const existingDraft: Record<string, { answer: string; t: number; server_t?: string }> =
      (existing?.draft_answers as any) || {}

    const incomingAnswers = answers as Record<string, { answer: string; t: number }>
    let mergedCount = 0

    for (const [qid, incoming] of Object.entries(incomingAnswers)) {
      if (!incoming || typeof incoming !== 'object') continue
      const existingEntry = existingDraft[qid]
      // Accept if no existing entry OR incoming timestamp is newer
      if (!existingEntry || (incoming.t && (!existingEntry.t || incoming.t > existingEntry.t))) {
        existingDraft[qid] = {
          answer: String(incoming.answer ?? ''),
          t: incoming.t || Date.now(),
          server_t: serverReceivedAt, // Tweak 1: server timestamp as tie-breaker
        }
        mergedCount++
      }
    }

    const newVersion = (existing?.draft_version || 0) + 1

    // Upsert into exam_live_progress (intentionally permissive — grading decides acceptance)
    const { error: upsertError } = await adminSupabase
      .from('exam_live_progress')
      .upsert({
        student_id: userId,
        quiz_assignment_id,
        draft_answers: existingDraft,
        draft_version: newVersion,
        draft_updated_at: serverReceivedAt,
        last_activity_at: serverReceivedAt,
      }, { onConflict: 'student_id,quiz_assignment_id' })

    if (upsertError) {
      console.error('save-quiz-answer upsert error:', upsertError)
      return new Response(JSON.stringify({ error: 'Failed to save answers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(
      JSON.stringify({ success: true, merged: mergedCount, version: newVersion }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('save-quiz-answer error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
