import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const PASS_THRESHOLD = 60

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // ===== AUTH: extract student_id from JWT =====
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const studentId = user.id

    // ===== VALIDATE INPUT =====
    const body = await req.json()
    const { attempt_id, answers } = body

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!attempt_id || !uuidRegex.test(attempt_id)) {
      return new Response(JSON.stringify({ error: 'Invalid attempt_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
      return new Response(JSON.stringify({ error: 'Answers must be a JSON object { question_id: "A"|"B"|"C"|"D" }' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // ===== VERIFY ATTEMPT OWNERSHIP + STATUS =====
    const { data: attempt, error: aError } = await adminClient
      .from('placement_exam_attempts')
      .select('*')
      .eq('id', attempt_id)
      .single()

    if (aError || !attempt) {
      return new Response(JSON.stringify({ error: 'Attempt not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (attempt.student_id !== studentId) {
      return new Response(JSON.stringify({ error: 'Not your exam' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (attempt.status !== 'in_progress') {
      return new Response(JSON.stringify({ error: 'Exam is not in progress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ===== FETCH QUESTIONS =====
    const { data: attemptQuestions, error: qError } = await adminClient
      .from('placement_exam_attempt_questions')
      .select('id, question_id, order_index')
      .eq('attempt_id', attempt_id)
      .order('order_index')

    if (qError || !attemptQuestions || attemptQuestions.length === 0) {
      return new Response(JSON.stringify({ error: 'No questions found for this attempt' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const questionIds = attemptQuestions.map(q => q.question_id)
    const { data: bankQuestions } = await adminClient
      .from('placement_question_bank')
      .select('id, correct_answer, level, skill')
      .in('id', questionIds)

    if (!bankQuestions) {
      return new Response(JSON.stringify({ error: 'Failed to load question bank' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const bankMap = new Map(bankQuestions.map(q => [q.id, q]))

    // ===== GRADE =====
    const levelScores: Record<string, { score: number; max: number }> = {
      foundation: { score: 0, max: 0 },
      intermediate: { score: 0, max: 0 },
      advanced: { score: 0, max: 0 },
    }
    const skillResults: Record<string, { correct: number; total: number }> = {}
    let totalScore = 0
    let maxScore = 0

    const questionUpdates: { id: string; student_answer: string | null; is_correct: boolean }[] = []
    const statsUpdates: { question_id: number; is_correct: boolean }[] = []

    for (const aq of attemptQuestions) {
      const bank = bankMap.get(aq.question_id)
      if (!bank) continue

      const studentAnswer: string | null = answers[String(aq.question_id)] || null
      const isCorrect = studentAnswer !== null && studentAnswer === bank.correct_answer

      questionUpdates.push({ id: aq.id, student_answer: studentAnswer, is_correct: isCorrect })
      statsUpdates.push({ question_id: aq.question_id, is_correct: isCorrect })

      // Per-level scoring (1 point per question)
      if (levelScores[bank.level]) {
        levelScores[bank.level].max += 1
        if (isCorrect) levelScores[bank.level].score += 1
      }

      totalScore += isCorrect ? 1 : 0
      maxScore += 1

      // Skill tracking
      if (!skillResults[bank.skill]) skillResults[bank.skill] = { correct: 0, total: 0 }
      skillResults[bank.skill].total += 1
      if (isCorrect) skillResults[bank.skill].correct += 1
    }

    // ===== UPDATE ANSWERS =====
    for (const qu of questionUpdates) {
      await adminClient
        .from('placement_exam_attempt_questions')
        .update({ student_answer: qu.student_answer, is_correct: qu.is_correct })
        .eq('id', qu.id)
    }

    // ===== ATOMIC STATS UPDATE (usage_count + success_rate) =====
    for (const su of statsUpdates) {
      await adminClient.rpc('update_question_stats', {
        p_question_id: su.question_id,
        p_is_correct: su.is_correct,
      })
    }

    // ===== CALCULATE RESULTS =====
    const foundationPct = levelScores.foundation.max > 0
      ? (levelScores.foundation.score / levelScores.foundation.max) * 100 : 0
    const intermediatePct = levelScores.intermediate.max > 0
      ? (levelScores.intermediate.score / levelScores.intermediate.max) * 100 : 0
    const advancedPct = levelScores.advanced.max > 0
      ? (levelScores.advanced.score / levelScores.advanced.max) * 100 : 0
    const overallPct = maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0

    // Recommended level
    let recommendedLevel: string
    if (advancedPct >= PASS_THRESHOLD) recommendedLevel = 'advanced'
    else if (intermediatePct >= PASS_THRESHOLD) recommendedLevel = 'intermediate'
    else recommendedLevel = 'foundation'

    // Confidence level
    const inconsistent =
      (advancedPct >= PASS_THRESHOLD && foundationPct < PASS_THRESHOLD) ||
      (intermediatePct >= PASS_THRESHOLD && foundationPct < PASS_THRESHOLD)

    const marginF = Math.abs(foundationPct - PASS_THRESHOLD)
    const marginI = Math.abs(intermediatePct - PASS_THRESHOLD)
    const marginA = Math.abs(advancedPct - PASS_THRESHOLD)
    const minMargin = Math.min(marginF, marginI, marginA)

    let confidenceLevel: string
    if (inconsistent) confidenceLevel = 'low'
    else if (minMargin <= 10) confidenceLevel = 'medium'
    else confidenceLevel = 'high'

    const needsManualReview = confidenceLevel !== 'high' || foundationPct < PASS_THRESHOLD

    // Weak skills (< 50% correct)
    const weakSkills = Object.entries(skillResults)
      .filter(([_, v]) => v.total > 0 && (v.correct / v.total) < 0.5)
      .map(([skill, v]) => ({
        skill,
        correct: v.correct,
        total: v.total,
        rate: Math.round((v.correct / v.total) * 100),
      }))

    // ===== UPDATE ATTEMPT =====
    await adminClient
      .from('placement_exam_attempts')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        foundation_score: levelScores.foundation.score,
        foundation_max: levelScores.foundation.max,
        intermediate_score: levelScores.intermediate.score,
        intermediate_max: levelScores.intermediate.max,
        advanced_score: levelScores.advanced.score,
        advanced_max: levelScores.advanced.max,
        total_score: totalScore,
        max_score: maxScore,
        percentage: overallPct,
        recommended_level: recommendedLevel,
        confidence_level: confidenceLevel,
        needs_manual_review: needsManualReview,
        weak_skills: weakSkills,
      })
      .eq('id', attempt_id)

    // ===== MARK SCHEDULE AS COMPLETED =====
    await adminClient
      .from('placement_exam_schedules')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .in('status', ['scheduled', 'open'])

    // ===== NOTIFY ADMINS =====
    try {
      const { data: studentProfile } = await adminClient
        .from('profiles')
        .select('full_name, full_name_ar')
        .eq('user_id', studentId)
        .single()

      const studentName = studentProfile?.full_name || 'Student'
      const studentNameAr = studentProfile?.full_name_ar || 'طالب'

      const { data: admins } = await adminClient
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')

      if (admins && admins.length > 0) {
        const notifications = admins.map(admin => ({
          user_id: admin.user_id,
          title: 'Placement Exam Submitted',
          title_ar: 'امتحان تحديد مستوى جديد',
          message: `${studentName} completed placement exam (Attempt #${attempt.attempt_number})`,
          message_ar: `${studentNameAr} أتم امتحان تحديد المستوى (المحاولة #${attempt.attempt_number})`,
          type: 'info',
          category: 'placement_test',
          action_url: '/placement-test-review',
        }))

        await adminClient.from('notifications').insert(notifications)
      }
    } catch (e) {
      console.error('Notification error:', e)
    }

    console.log(`Placement exam graded: student=${studentId}, attempt=${attempt_id}, score=${totalScore}/${maxScore} (${overallPct}%), recommended=${recommendedLevel}, confidence=${confidenceLevel}`)

    // ===== RETURN ONLY CONFIRMATION — NO SCORES =====
    return new Response(JSON.stringify({ submitted: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('grade-placement-exam error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
