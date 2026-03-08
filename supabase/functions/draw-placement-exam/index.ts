import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const DEFAULT_DISTRIBUTION: Record<string, Record<string, number>> = {
  '6_9':   { foundation: 6, intermediate: 6, advanced: 6 },
  '10_13': { foundation: 8, intermediate: 8, advanced: 8 },
  '14_18': { foundation: 10, intermediate: 10, advanced: 10 },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // ===== AUTH =====
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
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // ===== CHECK SCHEDULE WINDOW =====
    const { data: activeSchedule } = await adminClient
      .from('placement_exam_schedules')
      .select('id, opens_at, closes_at, status')
      .eq('student_id', studentId)
      .in('status', ['scheduled', 'open'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const now = new Date()

    if (activeSchedule) {
      const opensAt = new Date(activeSchedule.opens_at)
      const closesAt = new Date(activeSchedule.closes_at)

      if (now < opensAt) {
        return new Response(JSON.stringify({ error: 'Exam is not open yet', opens_at: activeSchedule.opens_at }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (now > closesAt) {
        await adminClient.from('placement_exam_schedules').update({ status: 'expired' }).eq('id', activeSchedule.id)
        return new Response(JSON.stringify({ error: 'Exam window has expired' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (activeSchedule.status === 'scheduled') {
        await adminClient.from('placement_exam_schedules').update({ status: 'open' }).eq('id', activeSchedule.id)
      }
    } else {
      const { data: inProgressAttempt } = await adminClient
        .from('placement_exam_attempts')
        .select('id')
        .eq('student_id', studentId)
        .eq('status', 'in_progress')
        .maybeSingle()

      if (!inProgressAttempt) {
        return new Response(JSON.stringify({ error: 'No placement exam scheduled for you' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // ===== RESOLVE AGE GROUP =====
    const { data: profile } = await adminClient
      .from('profiles').select('age_group_id').eq('user_id', studentId).single()

    if (!profile?.age_group_id) {
      return new Response(JSON.stringify({ error: 'Student has no age group assigned' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: ageGroup } = await adminClient
      .from('age_groups').select('min_age').eq('id', profile.age_group_id).single()

    if (!ageGroup) {
      return new Response(JSON.stringify({ error: 'Age group not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let ageGroupCode: string
    if (ageGroup.min_age <= 9) ageGroupCode = '6_9'
    else if (ageGroup.min_age <= 13) ageGroupCode = '10_13'
    else ageGroupCode = '14_18'

    // ===== RESUME IN_PROGRESS ATTEMPT =====
    const { data: existingAttempt } = await adminClient
      .from('placement_exam_attempts')
      .select('id, age_group, attempt_number')
      .eq('student_id', studentId)
      .eq('status', 'in_progress')
      .maybeSingle()

    if (existingAttempt) {
      const { data: existingQuestions } = await adminClient
        .from('placement_exam_attempt_questions')
        .select('question_id, order_index')
        .eq('attempt_id', existingAttempt.id)
        .order('order_index')

      if (!existingQuestions || existingQuestions.length === 0) {
        return new Response(JSON.stringify({ error: 'Attempt has no questions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const qIds = existingQuestions.map(q => q.question_id)
      const { data: bankQs } = await adminClient
        .from('placement_question_bank')
        .select('id, question_text_ar, options, skill, code_snippet, image_url')
        .in('id', qIds)

      const bankMap = new Map((bankQs || []).map(q => [q.id, q]))
      const resumeQuestions = existingQuestions.map(eq => {
        const bq = bankMap.get(eq.question_id)
        return {
          order: eq.order_index,
          question_id: eq.question_id,
          question_text_ar: bq?.question_text_ar || '',
          options: bq?.options || {},
          skill: bq?.skill || '',
          code_snippet: bq?.code_snippet || null,
          image_url: bq?.image_url || null,
        }
      })

      console.log(`Placement exam resumed: student=${studentId}, attempt=${existingAttempt.id}, questions=${resumeQuestions.length}`)
      return new Response(JSON.stringify({
        attempt_id: existingAttempt.id,
        age_group: existingAttempt.age_group,
        total_questions: resumeQuestions.length,
        questions: resumeQuestions,
        resumed: true,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ===== ATTEMPT NUMBER =====
    const { count: prevCount } = await adminClient
      .from('placement_exam_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)

    const attemptNumber = (prevCount || 0) + 1

    // ===== EXCLUDE PREVIOUSLY USED QUESTIONS =====
    let usedQuestionIds: number[] = []
    const { data: prevAttempts } = await adminClient
      .from('placement_exam_attempts').select('id').eq('student_id', studentId)

    if (prevAttempts && prevAttempts.length > 0) {
      const { data: usedQs } = await adminClient
        .from('placement_exam_attempt_questions')
        .select('question_id')
        .in('attempt_id', prevAttempts.map(a => a.id))
      if (usedQs) usedQuestionIds = usedQs.map(q => q.question_id)
    }

    // ===== LOAD SETTINGS =====
    const { data: dbSettings } = await adminClient
      .from('placement_exam_settings')
      .select('foundation_questions, intermediate_questions, advanced_questions, is_active, max_attempts')
      .eq('age_group', ageGroupCode)
      .maybeSingle()

    let distribution: Record<string, number>
    if (dbSettings) {
      if (!dbSettings.is_active) {
        return new Response(JSON.stringify({ error: 'Placement exam is disabled for this age group' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      distribution = {
        foundation: dbSettings.foundation_questions,
        intermediate: dbSettings.intermediate_questions,
        advanced: dbSettings.advanced_questions,
      }
    } else {
      distribution = DEFAULT_DISTRIBUTION[ageGroupCode]
    }

    if (!distribution) {
      return new Response(JSON.stringify({ error: 'Invalid age group configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ===== LOAD BLUEPRINT =====
    const { data: blueprintRows } = await adminClient
      .from('placement_skill_blueprint')
      .select('*')
      .eq('age_group', ageGroupCode)
      .order('level')
      .order('skill')

    const hasBlueprint = blueprintRows && blueprintRows.length > 0
    const allQuestions: any[] = []
    const usedIdsInExam = new Set<number>() // Prevent duplicate question_id across skills

    if (hasBlueprint) {
      // ===== VALIDATE BLUEPRINT TOTALS MATCH SETTINGS =====
      const bpTotals: Record<string, number> = {}
      for (const bp of blueprintRows!) {
        bpTotals[bp.level] = (bpTotals[bp.level] || 0) + bp.question_count
      }

      for (const [level, expectedCount] of Object.entries(distribution)) {
        const bpTotal = bpTotals[level] || 0
        if (bpTotal !== expectedCount) {
          return new Response(JSON.stringify({
            error: `Blueprint mismatch for level "${level}": blueprint total is ${bpTotal} but General Settings requires ${expectedCount}. Fix in Placement Settings before running exams.`,
            level,
            blueprint_total: bpTotal,
            settings_total: expectedCount,
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      // ===== DRAW SKILL-BY-SKILL =====
      for (const bp of blueprintRows!) {
        const { data: available, error: qError } = await adminClient
          .from('placement_question_bank')
          .select('id, question_text_ar, options, skill, difficulty, code_snippet, image_url')
          .eq('age_group', ageGroupCode)
          .eq('level', bp.level)
          .eq('skill', bp.skill)
          .eq('is_active', true)
          .limit(200)

        if (qError || !available) {
          return new Response(JSON.stringify({
            error: `Failed to load questions for skill "${bp.skill}" at level "${bp.level}"`,
            age_group: ageGroupCode,
            level: bp.level,
            skill: bp.skill,
          }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Filter out used (previous attempts) and used in this exam
        let filtered = available.filter(q => !usedQuestionIds.includes(q.id) && !usedIdsInExam.has(q.id))
        if (filtered.length < bp.question_count) {
          // Fallback to all available minus current exam duplicates only
          filtered = available.filter(q => !usedIdsInExam.has(q.id))
        }

        if (filtered.length < bp.question_count) {
          return new Response(JSON.stringify({
            error: `Not enough questions for skill "${bp.skill}" at level "${bp.level}"`,
            age_group: ageGroupCode,
            level: bp.level,
            skill: bp.skill,
            required_count: bp.question_count,
            available_count: filtered.length,
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const shuffled = filtered.sort(() => Math.random() - 0.5)
        const picked = shuffled.slice(0, bp.question_count)

        for (const q of picked) {
          usedIdsInExam.add(q.id)
          allQuestions.push({ ...q, level: bp.level })
        }
      }
    } else {
      // ===== FALLBACK: RANDOM BY LEVEL (no blueprint) =====
      for (const [level, count] of Object.entries(distribution)) {
        const { data: available, error: qError } = await adminClient
          .from('placement_question_bank')
          .select('id, question_text_ar, options, skill, difficulty, code_snippet, image_url')
          .eq('age_group', ageGroupCode)
          .eq('level', level)
          .eq('is_active', true)
          .limit(200)

        if (qError || !available) {
          return new Response(JSON.stringify({ error: `Failed to load ${level} questions` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        let filtered = available.filter(q => !usedQuestionIds.includes(q.id) && !usedIdsInExam.has(q.id))
        if (filtered.length < count) filtered = available.filter(q => !usedIdsInExam.has(q.id))

        const shuffled = filtered.sort(() => Math.random() - 0.5)
        const picked = shuffled.slice(0, count)

        if (picked.length < count) {
          return new Response(JSON.stringify({
            error: `Not enough ${level} questions. Need ${count}, have ${picked.length}`,
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        for (const q of picked) {
          usedIdsInExam.add(q.id)
          allQuestions.push({ ...q, level })
        }
      }
    }

    // Shuffle all questions together
    const shuffledAll = allQuestions.sort(() => Math.random() - 0.5)

    // ===== CREATE ATTEMPT =====
    const { data: attempt, error: attemptError } = await adminClient
      .from('placement_exam_attempts')
      .insert({
        student_id: studentId,
        age_group: ageGroupCode,
        attempt_number: attemptNumber,
        status: 'in_progress',
      })
      .select('id')
      .single()

    if (attemptError || !attempt) {
      console.error('Failed to create attempt:', attemptError)
      return new Response(JSON.stringify({ error: 'Failed to create exam attempt' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ===== INSERT ATTEMPT QUESTIONS =====
    const questionRows = shuffledAll.map((q, idx) => ({
      attempt_id: attempt.id,
      question_id: q.id,
      order_index: idx + 1,
    }))

    const { error: insertError } = await adminClient
      .from('placement_exam_attempt_questions')
      .insert(questionRows)

    if (insertError) {
      await adminClient.from('placement_exam_attempts').delete().eq('id', attempt.id)
      return new Response(JSON.stringify({ error: 'Failed to save exam questions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ===== RETURN QUESTIONS =====
    const safeQuestions = shuffledAll.map((q, idx) => ({
      order: idx + 1,
      question_id: q.id,
      question_text_ar: q.question_text_ar,
      options: q.options,
      skill: q.skill,
      code_snippet: q.code_snippet || null,
      image_url: q.image_url || null,
    }))

    console.log(`Placement exam drawn: student=${studentId}, age=${ageGroupCode}, questions=${safeQuestions.length}, attempt=#${attemptNumber}, blueprint=${hasBlueprint}`)

    return new Response(JSON.stringify({
      attempt_id: attempt.id,
      age_group: ageGroupCode,
      total_questions: safeQuestions.length,
      questions: safeQuestions,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('draw-placement-exam error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
