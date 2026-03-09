import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { DateTime } from "https://esm.sh/luxon@3.5.0";

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
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // ===== CHECK FOR EXISTING IN-PROGRESS ATTEMPT =====
    const { data: existingAttempt } = await admin
      .from('placement_v2_attempts')
      .select('id, attempt_number')
      .eq('student_id', studentId)
      .eq('status', 'in_progress')
      .maybeSingle()

    if (existingAttempt) {
      // Resume: return existing attempt with its questions
      const { data: qs } = await admin
        .from('placement_v2_attempt_questions')
        .select('question_id, section, order_index, section_skill')
        .eq('attempt_id', existingAttempt.id)
        .order('order_index')

      if (!qs || qs.length === 0) return json({ error: 'Attempt has no questions' }, 500)

      const qIds = qs.map(q => q.question_id)
      const { data: bankQs } = await admin
        .from('placement_v2_questions')
        .select('id, question_text_ar, options, skill, code_snippet, image_url, section, track_category')
        .in('id', qIds)

      const bankMap = new Map((bankQs || []).map(q => [q.id, q]))
      const questions = qs.map(eq => {
        const bq = bankMap.get(eq.question_id)
        return {
          order: eq.order_index,
          question_id: eq.question_id,
          section: eq.section,
          section_skill: eq.section_skill,
          question_text_ar: bq?.question_text_ar || '',
          options: bq?.options || {},
          code_snippet: bq?.code_snippet || null,
          image_url: bq?.image_url || null,
        }
      })

      console.log(`Placement v2 resumed: student=${studentId}, attempt=${existingAttempt.id}`)
      return json({ attempt_id: existingAttempt.id, total_questions: questions.length, questions, resumed: true })
    }

    // ===== CHECK SCHEDULE WINDOW =====
    const CAIRO_TZ = 'Africa/Cairo'
    const now = DateTime.now().setZone(CAIRO_TZ)

    const { data: schedule } = await admin
      .from('placement_v2_schedules')
      .select('id, opens_at, closes_at, status')
      .eq('student_id', studentId)
      .in('status', ['scheduled', 'open'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!schedule) return json({ error: 'No placement exam scheduled for you' }, 403)

    const opensAt = DateTime.fromISO(schedule.opens_at, { zone: CAIRO_TZ, setZone: true }).setZone(CAIRO_TZ)
    const closesAt = DateTime.fromISO(schedule.closes_at, { zone: CAIRO_TZ, setZone: true }).setZone(CAIRO_TZ)

    if (!opensAt.isValid || !closesAt.isValid) return json({ error: 'Invalid schedule timestamps' }, 500)
    if (now < opensAt) return json({ error: 'Exam is not open yet', opens_at: schedule.opens_at }, 403)
    if (now > closesAt) return json({ error: 'Exam window has expired' }, 403)

    if (schedule.status !== 'open') {
      await admin.from('placement_v2_schedules').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', schedule.id)
    }

    // ===== LOAD SETTINGS =====
    const { data: settings } = await admin
      .from('placement_v2_settings')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (!settings) return json({ error: 'Placement exam settings not configured' }, 500)

    const countA = settings.section_a_question_count
    const countB = settings.section_b_question_count
    const countC = settings.section_c_question_count

    // ===== CHECK MAX ATTEMPTS =====
    const { count: prevCount } = await admin
      .from('placement_v2_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)

    const attemptNumber = (prevCount || 0) + 1

    if (!settings.allow_retake && attemptNumber > 1) {
      return json({ error: 'Retakes are not allowed' }, 403)
    }
    if (attemptNumber > settings.max_attempts) {
      return json({ error: `Maximum attempts (${settings.max_attempts}) reached` }, 403)
    }

    // ===== EXCLUDE PREVIOUSLY USED QUESTIONS =====
    let usedQuestionIds: number[] = []
    const { data: prevAttempts } = await admin
      .from('placement_v2_attempts').select('id').eq('student_id', studentId)

    if (prevAttempts && prevAttempts.length > 0) {
      const { data: usedQs } = await admin
        .from('placement_v2_attempt_questions')
        .select('question_id')
        .in('attempt_id', prevAttempts.map(a => a.id))
      if (usedQs) usedQuestionIds = usedQs.map(q => q.question_id)
    }

    const usedInExam = new Set<number>()

    // ===== DRAW HELPER =====
    async function drawSection(section: string, count: number, trackCategory?: string) {
      let query = admin
        .from('placement_v2_questions')
        .select('id, question_text_ar, options, skill, code_snippet, image_url, section, track_category')
        .eq('section', section)
        .eq('is_active', true)
        .eq('is_archived', false)
        .eq('review_status', 'approved')

      if (trackCategory) query = query.eq('track_category', trackCategory)

      const { data: available, error } = await query.limit(500)
      if (error || !available) throw new Error(`Failed to load ${section} questions: ${error?.message}`)

      let filtered = available.filter(q => !usedQuestionIds.includes(q.id) && !usedInExam.has(q.id))
      if (filtered.length < count) {
        filtered = available.filter(q => !usedInExam.has(q.id))
      }
      if (filtered.length < count) {
        throw new Error(`Not enough ${section}${trackCategory ? ` (${trackCategory})` : ''} questions. Need ${count}, have ${filtered.length}`)
      }

      const shuffled = filtered.sort(() => Math.random() - 0.5)
      const picked = shuffled.slice(0, count)
      for (const q of picked) usedInExam.add(q.id)
      return picked
    }

    // ===== DRAW QUESTIONS =====
    const sectionA = await drawSection('section_a', countA)
    const sectionB = await drawSection('section_b', countB)

    // Section C: balanced software/hardware
    const halfC = Math.floor(countC / 2)
    const remainC = countC - halfC
    const sectionCSoftware = await drawSection('section_c', halfC, 'software')
    const sectionCHardware = await drawSection('section_c', remainC, 'hardware')
    const sectionC = [...sectionCSoftware, ...sectionCHardware].sort(() => Math.random() - 0.5)

    // Combine in section order (A → B → C), shuffled within each section
    const allQuestions = [
      ...sectionA.sort(() => Math.random() - 0.5).map(q => ({ ...q, _section: 'section_a' })),
      ...sectionB.sort(() => Math.random() - 0.5).map(q => ({ ...q, _section: 'section_b' })),
      ...sectionC.map(q => ({ ...q, _section: 'section_c' })),
    ]

    // ===== CREATE ATTEMPT =====
    const { data: attempt, error: attemptError } = await admin
      .from('placement_v2_attempts')
      .insert({
        student_id: studentId,
        schedule_id: schedule.id,
        attempt_number: attemptNumber,
        status: 'in_progress',
      })
      .select('id')
      .single()

    if (attemptError || !attempt) {
      // Check if it's the unique index violation (another in_progress exists)
      if (attemptError?.code === '23505') {
        return json({ error: 'You already have an exam in progress. Please complete it first.' }, 409)
      }
      console.error('Failed to create attempt:', attemptError)
      return json({ error: 'Failed to create exam attempt' }, 500)
    }

    // ===== INSERT ATTEMPT QUESTIONS =====
    const questionRows = allQuestions.map((q, idx) => ({
      attempt_id: attempt.id,
      question_id: q.id,
      section: q._section,
      section_skill: q.skill,
      order_index: idx + 1,
    }))

    const { error: insertError } = await admin
      .from('placement_v2_attempt_questions')
      .insert(questionRows)

    if (insertError) {
      await admin.from('placement_v2_attempts').delete().eq('id', attempt.id)
      console.error('Failed to insert questions:', insertError)
      return json({ error: 'Failed to save exam questions' }, 500)
    }

    // ===== RETURN =====
    const safeQuestions = allQuestions.map((q, idx) => ({
      order: idx + 1,
      question_id: q.id,
      section: q._section,
      section_skill: q.skill,
      question_text_ar: q.question_text_ar,
      options: q.options,
      code_snippet: q.code_snippet || null,
      image_url: q.image_url || null,
    }))

    console.log(`Placement v2 drawn: student=${studentId}, attempt=${attempt.id}, questions=${safeQuestions.length} (A:${countA}, B:${countB}, C:${countC})`)

    return json({
      attempt_id: attempt.id,
      total_questions: safeQuestions.length,
      sections: { section_a: countA, section_b: countB, section_c: countC },
      questions: safeQuestions,
    })

  } catch (error) {
    console.error('draw-placement-exam error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})
