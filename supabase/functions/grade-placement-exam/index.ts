import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // ===== AUTH =====
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const studentId = user.id

    // ===== VALIDATE INPUT =====
    const body = await req.json()
    const { attempt_id, answers } = body

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!attempt_id || !uuidRegex.test(attempt_id)) return json({ error: 'Invalid attempt_id' }, 400)

    if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
      return json({ error: 'Answers must be a JSON object { question_id: "A"|"B"|"C"|"D" }' }, 400)
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // ===== VERIFY ATTEMPT =====
    const { data: attempt, error: aError } = await admin
      .from('placement_v2_attempts')
      .select('*')
      .eq('id', attempt_id)
      .single()

    if (aError || !attempt) return json({ error: 'Attempt not found' }, 404)
    if (attempt.student_id !== studentId) return json({ error: 'Not your exam' }, 403)
    if (attempt.status !== 'in_progress') return json({ error: 'Exam is not in progress' }, 400)

    // ===== LOAD SETTINGS =====
    const { data: settings } = await admin
      .from('placement_v2_settings')
      .select('pass_threshold_section_a, pass_threshold_section_b, track_margin')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (!settings) return json({ error: 'Settings not configured' }, 500)

    const passA = settings.pass_threshold_section_a
    const passB = settings.pass_threshold_section_b
    const trackMargin = settings.track_margin

    // ===== FETCH QUESTIONS =====
    const { data: attemptQuestions } = await admin
      .from('placement_v2_attempt_questions')
      .select('id, question_id, section, section_skill, order_index')
      .eq('attempt_id', attempt_id)
      .order('order_index')

    if (!attemptQuestions || attemptQuestions.length === 0) return json({ error: 'No questions found' }, 500)

    const questionIds = attemptQuestions.map(q => q.question_id)
    const { data: bankQuestions } = await admin
      .from('placement_v2_questions')
      .select('id, correct_answer, section, track_category')
      .in('id', questionIds)

    if (!bankQuestions) return json({ error: 'Failed to load question bank' }, 500)

    const bankMap = new Map(bankQuestions.map(q => [q.id, q]))

    // ===== GRADE =====
    const scores = {
      section_a: { score: 0, max: 0 },
      section_b: { score: 0, max: 0 },
      section_c_software: { score: 0, max: 0 },
      section_c_hardware: { score: 0, max: 0 },
    }

    const questionUpdates: { id: string; student_answer: string | null; is_correct: boolean }[] = []
    const statsUpdates: { question_id: number; is_correct: boolean }[] = []

    for (const aq of attemptQuestions) {
      const bank = bankMap.get(aq.question_id)
      if (!bank) continue

      const studentAnswer: string | null = answers[String(aq.question_id)] || null
      const isCorrect = studentAnswer !== null && studentAnswer === bank.correct_answer

      questionUpdates.push({ id: aq.id, student_answer: studentAnswer, is_correct: isCorrect })
      statsUpdates.push({ question_id: aq.question_id, is_correct: isCorrect })

      if (aq.section === 'section_a') {
        scores.section_a.max += 1
        if (isCorrect) scores.section_a.score += 1
      } else if (aq.section === 'section_b') {
        scores.section_b.max += 1
        if (isCorrect) scores.section_b.score += 1
      } else if (aq.section === 'section_c') {
        if (bank.track_category === 'software') {
          scores.section_c_software.max += 1
          if (isCorrect) scores.section_c_software.score += 1
        } else if (bank.track_category === 'hardware') {
          scores.section_c_hardware.max += 1
          if (isCorrect) scores.section_c_hardware.score += 1
        }
      }
    }

    // ===== UPDATE ANSWERS =====
    for (const qu of questionUpdates) {
      await admin
        .from('placement_v2_attempt_questions')
        .update({ student_answer: qu.student_answer, is_correct: qu.is_correct })
        .eq('id', qu.id)
    }

    // ===== UPDATE QUESTION STATS =====
    for (const su of statsUpdates) {
      await admin.rpc('update_v2_question_stats', {
        p_question_id: su.question_id,
        p_is_correct: su.is_correct,
      })
    }

    // ===== CALCULATE PERCENTAGES =====
    const aPct = scores.section_a.max > 0 ? (scores.section_a.score / scores.section_a.max) * 100 : 0
    const bPct = scores.section_b.max > 0 ? (scores.section_b.score / scores.section_b.max) * 100 : 0
    const swPct = scores.section_c_software.max > 0 ? (scores.section_c_software.score / scores.section_c_software.max) * 100 : 0
    const hwPct = scores.section_c_hardware.max > 0 ? (scores.section_c_hardware.score / scores.section_c_hardware.max) * 100 : 0

    const sectionAPassed = aPct >= passA
    const sectionBPassed = bPct >= passB

    // ===== DETERMINE LEVEL USING level_order + track =====
    let recommendedLevelId: string | null = null
    let recommendedTrack: string | null = null
    let needsManualReview = false

    if (!sectionAPassed) {
      // Level 0
      const { data: level0 } = await admin
        .from('levels').select('id').eq('level_order', 0).eq('is_active', true).limit(1).maybeSingle()
      recommendedLevelId = level0?.id || null
    } else if (!sectionBPassed) {
      // Level 1
      const { data: level1 } = await admin
        .from('levels').select('id').eq('level_order', 1).eq('is_active', true).limit(1).maybeSingle()
      recommendedLevelId = level1?.id || null
    } else {
      // Level 2 — determine track
      const trackDiff = Math.abs(swPct - hwPct)

      if (trackDiff <= trackMargin) {
        // Balanced
        recommendedTrack = 'balanced'
        recommendedLevelId = null
        needsManualReview = true
      } else if (swPct > hwPct) {
        recommendedTrack = 'software'
        const { data: lvl } = await admin
          .from('levels').select('id').eq('level_order', 2).eq('track', 'software').eq('is_active', true).limit(1).maybeSingle()
        recommendedLevelId = lvl?.id || null
      } else {
        recommendedTrack = 'hardware'
        const { data: lvl } = await admin
          .from('levels').select('id').eq('level_order', 2).eq('track', 'hardware').eq('is_active', true).limit(1).maybeSingle()
        recommendedLevelId = lvl?.id || null
      }
    }

    // ===== CONFIDENCE — use DB function =====
    const { data: confidenceResult } = await admin.rpc('compute_placement_v2_confidence', {
      p_section_a_pct: aPct,
      p_section_b_pct: bPct,
      p_sw_pct: swPct,
      p_hw_pct: hwPct,
      p_pass_a: passA,
      p_pass_b: passB,
      p_track_margin: trackMargin,
    })

    const confidenceLevel: string = confidenceResult || 'medium'

    // If confidence is low, flag for review
    if (confidenceLevel === 'low') needsManualReview = true

    // ===== UPDATE ATTEMPT =====
    await admin
      .from('placement_v2_attempts')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        section_a_score: scores.section_a.score,
        section_a_max: scores.section_a.max,
        section_a_passed: sectionAPassed,
        section_b_score: scores.section_b.score,
        section_b_max: scores.section_b.max,
        section_b_passed: sectionBPassed,
        section_c_software_score: scores.section_c_software.score,
        section_c_software_max: scores.section_c_software.max,
        section_c_hardware_score: scores.section_c_hardware.score,
        section_c_hardware_max: scores.section_c_hardware.max,
        recommended_level_id: recommendedLevelId,
        recommended_track: recommendedTrack,
        confidence_level: confidenceLevel,
        needs_manual_review: needsManualReview,
      })
      .eq('id', attempt_id)

    // ===== MARK SCHEDULE AS COMPLETED =====
    await admin
      .from('placement_v2_schedules')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .in('status', ['scheduled', 'open'])

    // ===== NOTIFY ADMINS =====
    try {
      const { data: studentProfile } = await admin
        .from('profiles')
        .select('full_name, full_name_ar')
        .eq('user_id', studentId)
        .single()

      const studentName = studentProfile?.full_name || 'Student'
      const studentNameAr = studentProfile?.full_name_ar || 'طالب'

      const { data: admins } = await admin
        .from('user_roles').select('user_id').eq('role', 'admin')

      if (admins && admins.length > 0) {
        const notifications = admins.map(a => ({
          user_id: a.user_id,
          title: 'Placement Exam Submitted',
          title_ar: 'امتحان تحديد مستوى جديد',
          message: `${studentName} completed placement exam (Attempt #${attempt.attempt_number})`,
          message_ar: `${studentNameAr} أتم امتحان تحديد المستوى (المحاولة #${attempt.attempt_number})`,
          type: 'info',
          category: 'placement_test',
          action_url: '/placement-test-review',
        }))
        await admin.from('notifications').insert(notifications)
      }
    } catch (e) {
      console.error('Notification error:', e)
    }

    console.log(`Placement v2 graded: student=${studentId}, attempt=${attempt_id}, A=${scores.section_a.score}/${scores.section_a.max}, B=${scores.section_b.score}/${scores.section_b.max}, SW=${swPct}%, HW=${hwPct}%, track=${recommendedTrack}, confidence=${confidenceLevel}`)

    return json({ submitted: true })

  } catch (error) {
    console.error('grade-placement-exam error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
})
