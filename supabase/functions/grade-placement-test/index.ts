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
    const { placement_test_id, answers } = body

    // Validate inputs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!placement_test_id || !uuidRegex.test(placement_test_id)) {
      return new Response(JSON.stringify({ error: 'Invalid placement_test_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
      return new Response(JSON.stringify({ error: 'Answers must be a JSON object' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Fetch placement test
    const { data: placementTest, error: ptError } = await adminSupabase
      .from('placement_tests')
      .select('*')
      .eq('id', placement_test_id)
      .single()

    if (ptError || !placementTest) {
      return new Response(JSON.stringify({ error: 'Placement test not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verify ownership
    if (placementTest.student_id !== userId) {
      return new Response(JSON.stringify({ error: 'Not your placement test' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verify status
    if (placementTest.status === 'completed') {
      return new Response(JSON.stringify({ error: 'Test already submitted' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (placementTest.status === 'expired') {
      return new Response(JSON.stringify({ error: 'Test has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Server-side time window validation
    const now = Date.now()
    const scheduledAt = new Date(placementTest.scheduled_at).getTime()
    const durationMs = placementTest.duration_minutes * 60 * 1000
    const gracePeriodMs = 5 * 60 * 1000 // 5 minutes
    const windowStart = scheduledAt - gracePeriodMs
    const windowEnd = scheduledAt + durationMs + gracePeriodMs

    if (now < windowStart) {
      return new Response(JSON.stringify({ error: 'Test has not started yet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (now > windowEnd) {
      // Mark as expired
      await adminSupabase.from('placement_tests')
        .update({ status: 'expired' }).eq('id', placement_test_id)
      return new Response(JSON.stringify({ error: 'Test time window has passed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Fetch quiz questions
    const { data: questions, error: qError } = await adminSupabase
      .from('quiz_questions')
      .select('id, options, correct_answer, points')
      .eq('quiz_id', placementTest.quiz_id)

    if (qError || !questions || questions.length === 0) {
      return new Response(JSON.stringify({ error: 'Failed to load quiz questions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Fetch question-level mappings
    const { data: questionLevels } = await adminSupabase
      .from('placement_question_levels')
      .select('question_id, level_id')
      .in('question_id', questions.map(q => q.id))

    // Fetch pass threshold from config
    let passThreshold = 60
    if (placementTest.age_group_id) {
      const { data: config } = await adminSupabase
        .from('placement_quiz_config')
        .select('pass_threshold')
        .eq('age_group_id', placementTest.age_group_id)
        .maybeSingle()
      if (config) passThreshold = Number(config.pass_threshold)
    }

    // Grade each question
    let totalScore = 0
    let maxScore = 0
    const compactAnswers: Record<string, number> = {}

    for (const question of questions) {
      maxScore += question.points
      const optionsData = question.options as any
      let optionsList: string[] = []

      if (optionsData?.en && Array.isArray(optionsData.en)) {
        optionsList = optionsData.en
      } else if (optionsData?.options && Array.isArray(optionsData.options)) {
        optionsList = optionsData.options.map((opt: any) => opt.text)
      }

      const selectedIdx = parseInt(answers[question.id] ?? '-1')
      compactAnswers[question.id] = selectedIdx

      let correctIdx = -1
      const parsedCorrectIdx = parseInt(question.correct_answer)
      if (!isNaN(parsedCorrectIdx) && parsedCorrectIdx >= 0 && parsedCorrectIdx < optionsList.length) {
        correctIdx = parsedCorrectIdx
      } else {
        correctIdx = optionsList.findIndex(opt => opt === question.correct_answer)
      }

      if (selectedIdx >= 0 && selectedIdx === correctIdx) {
        totalScore += question.points
      }
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0

    // Calculate suggested level using per-level success rates
    let suggestedLevelId: string | null = null

    if (questionLevels && questionLevels.length > 0) {
      // Group questions by level
      const levelScores: Record<string, { score: number; max: number }> = {}

      for (const question of questions) {
        const mapping = questionLevels.find(ql => ql.question_id === question.id)
        if (!mapping) continue

        if (!levelScores[mapping.level_id]) {
          levelScores[mapping.level_id] = { score: 0, max: 0 }
        }
        levelScores[mapping.level_id].max += question.points

        const optionsData = question.options as any
        let optionsList: string[] = []
        if (optionsData?.en && Array.isArray(optionsData.en)) {
          optionsList = optionsData.en
        } else if (optionsData?.options && Array.isArray(optionsData.options)) {
          optionsList = optionsData.options.map((opt: any) => opt.text)
        }

        const selectedIdx = parseInt(answers[question.id] ?? '-1')
        let correctIdx = -1
        const parsedCorrectIdx = parseInt(question.correct_answer)
        if (!isNaN(parsedCorrectIdx) && parsedCorrectIdx >= 0 && parsedCorrectIdx < optionsList.length) {
          correctIdx = parsedCorrectIdx
        } else {
          correctIdx = optionsList.findIndex(opt => opt === question.correct_answer)
        }

        if (selectedIdx >= 0 && selectedIdx === correctIdx) {
          levelScores[mapping.level_id].score += question.points
        }
      }

      // Get level ordering
      const levelIds = Object.keys(levelScores)
      const { data: levelsData } = await adminSupabase
        .from('levels')
        .select('id, level_order')
        .in('id', levelIds)
        .order('level_order', { ascending: true })

      if (levelsData) {
        // Highest level where student passed >= threshold
        for (const level of [...levelsData].reverse()) {
          const ls = levelScores[level.id]
          if (ls && ls.max > 0) {
            const levelPercentage = (ls.score / ls.max) * 100
            if (levelPercentage >= passThreshold) {
              suggestedLevelId = level.id
              break
            }
          }
        }

        // If no level passed, suggest the first/lowest level
        if (!suggestedLevelId && levelsData.length > 0) {
          suggestedLevelId = levelsData[0].id
        }
      }
    }

    // Collect client info
    const clientInfo = {
      ip: clientIP,
      user_agent: req.headers.get('user-agent') || null,
    }

    // Update placement_tests status
    await adminSupabase.from('placement_tests')
      .update({
        status: 'completed',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', placement_test_id)

    // Insert placement_test_results
    await adminSupabase.from('placement_test_results').insert({
      placement_test_id,
      score: totalScore,
      max_score: maxScore,
      percentage,
      suggested_level_id: suggestedLevelId,
      submission_answers: compactAnswers,
      client_info: clientInfo,
    })

    // Notify admins
    try {
      const { data: studentProfile } = await adminSupabase
        .from('profiles')
        .select('full_name, full_name_ar')
        .eq('user_id', userId)
        .single()

      const studentName = studentProfile?.full_name || 'Student'
      const studentNameAr = studentProfile?.full_name_ar || 'طالب'

      const { data: admins } = await adminSupabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')

      if (admins && admins.length > 0) {
        const notifications = admins.map(admin => ({
          user_id: admin.user_id,
          title: 'Placement Test Completed',
          title_ar: 'امتحان تحديد مستوى مكتمل',
          message: `${studentName} completed the placement test with ${percentage}%`,
          message_ar: `${studentNameAr} أتم امتحان تحديد المستوى بنسبة ${percentage}%`,
          type: 'info',
          category: 'placement_test',
          action_url: '/placement-test-review',
        }))

        await adminSupabase.from('notifications').insert(notifications)
      }
    } catch (notifyError) {
      console.error('Error notifying admins:', notifyError)
    }

    console.log(`Placement test graded for ${userId}: ${totalScore}/${maxScore} (${percentage}%)`)

    // Return ONLY submitted confirmation — NO scores
    return new Response(
      JSON.stringify({ submitted: true }),
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
