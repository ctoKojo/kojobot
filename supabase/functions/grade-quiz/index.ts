import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { checkRateLimit, getClientIP, rateLimitResponse } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RATE_LIMIT_CONFIG = { maxRequests: 20, windowMs: 60000 }

// ── helpers ──────────────────────────────────────────────────────────
function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function errorResponse(error: string, status: number) {
  return jsonResponse({ error }, status)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── main ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Rate limiting
    const clientIP = getClientIP(req)
    const rl = checkRateLimit(clientIP, RATE_LIMIT_CONFIG)
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // ── Auth ─────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return errorResponse('Unauthorized', 401)

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) return errorResponse('Unauthorized', 401)

    const userId = claimsData.claims.sub as string
    const body = await req.json()
    const { quiz_assignment_id, answers: rawAnswers, force } = body

    // ── Input validation ─────────────────────────────────────────────
    if (!quiz_assignment_id || !UUID_RE.test(quiz_assignment_id)) {
      return errorResponse('Invalid quiz_assignment_id format', 400)
    }

    let answers: Record<string, string> = {}
    if (rawAnswers && typeof rawAnswers === 'object' && !Array.isArray(rawAnswers)) {
      answers = rawAnswers
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── Advisory lock to prevent concurrent grading ──────────────────
    const lockKey = `${quiz_assignment_id}${userId}`
    const { error: lockError } = await adminSupabase.rpc('pg_advisory_xact_lock_wrapper', { lock_key: lockKey })
    if (lockError) {
      console.warn('Advisory lock unavailable, continuing without it:', lockError.message)
    }

    // ── Idempotency: check for existing submission ───────────────────
    const { data: existingSub } = await adminSupabase
      .from('quiz_submissions')
      .select('id, score, max_score, percentage, grading_status')
      .eq('quiz_assignment_id', quiz_assignment_id)
      .eq('student_id', userId)
      .maybeSingle()

    if (existingSub) {
      // Audit log: duplicate attempt
      logAudit(adminSupabase, userId, quiz_assignment_id, 'duplicate_submit', { existing_submission_id: existingSub.id })
      console.log(`Idempotent return for user ${userId}, existing submission ${existingSub.id}`)
      return jsonResponse({
        success: true,
        score: existingSub.score,
        maxScore: existingSub.max_score,
        percentage: existingSub.percentage,
        passed: existingSub.percentage !== null ? existingSub.percentage >= 60 : false,
        hasOpenEnded: existingSub.grading_status === 'needs_manual_grading',
        gradingStatus: existingSub.grading_status,
        results: {},
        idempotent: true,
      })
    }

    // ── Load assignment ──────────────────────────────────────────────
    const { data: assignment, error: assignmentError } = await adminSupabase
      .from('quiz_assignments')
      .select('*, quizzes(*)')
      .eq('id', quiz_assignment_id)
      .single()

    if (assignmentError || !assignment) return errorResponse('Quiz assignment not found', 404)

    // ── Time validation (server is the judge) ────────────────────────
    const now = Date.now()
    const baseDuration = assignment.quizzes?.duration_minutes || 30
    const extraMinutes = (assignment as any).extra_minutes || 0
    const totalDurationMs = (baseDuration + extraMinutes) * 60 * 1000
    const gracePeriodMs = 60 * 1000 // 1 minute grace

    if (assignment.start_time) {
      const startTime = new Date(assignment.start_time).getTime()
      if (now < startTime && !force) return errorResponse('Quiz has not started yet', 400)

      const quizEndTime = startTime + totalDurationMs + gracePeriodMs
      if (now > quizEndTime && !force) {
        // Even if expired, try to grade with draft_answers (auto-recovery)
        logAudit(adminSupabase, userId, quiz_assignment_id, 'expired_attempt', { now, quizEndTime })
        // Don't reject — fall through to draft fallback below
      }
    }

    // ── Authorization check ──────────────────────────────────────────
    const isDirectAssignment = assignment.student_id === userId
    let isGroupAssignment = false
    if (assignment.group_id) {
      const { data: membership } = await adminSupabase
        .from('group_students')
        .select('id')
        .eq('group_id', assignment.group_id)
        .eq('student_id', userId)
        .single()
      isGroupAssignment = !!membership
    }
    if (!isDirectAssignment && !isGroupAssignment) {
      // For force submit by admin, check admin role
      if (force) {
        const { data: adminRole } = await adminSupabase
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle()
        if (!adminRole) return errorResponse('Not authorized for force submit', 403)
      } else {
        return errorResponse('You are not authorized to submit this quiz', 403)
      }
    }

    // ── Draft fallback: if answers empty, use server-saved draft ─────
    let usedFallback = false
    if (Object.keys(answers).length === 0) {
      const { data: draftRow } = await adminSupabase
        .from('exam_live_progress')
        .select('draft_answers, draft_version')
        .eq('quiz_assignment_id', quiz_assignment_id)
        .eq('student_id', force ? assignment.student_id : userId)
        .maybeSingle()

      const draftAnswers = (draftRow?.draft_answers || {}) as Record<string, { answer: string; t: number }>

      if (Object.keys(draftAnswers).length === 0) {
        // Tweak 6: reject if both draft and client answers are empty
        logAudit(adminSupabase, userId, quiz_assignment_id, 'empty_submission_rejected', {})
        return errorResponse('No answers provided and no draft answers found on server', 400)
      }

      // Convert draft format to simple answers format
      for (const [qid, entry] of Object.entries(draftAnswers)) {
        if (entry && typeof entry === 'object' && 'answer' in entry) {
          answers[qid] = String(entry.answer)
        }
      }
      usedFallback = true
      console.log(`Using draft_answers fallback for user ${force ? assignment.student_id : userId}, version ${draftRow?.draft_version}`)
    }

    // ── Load questions (admin client; correct_answer never leaves server) ──
    const { data: questions, error: questionsError } = await adminSupabase
      .from('quiz_questions')
      .select('id, question_text, question_text_ar, options, correct_answer, points, order_index, image_url, code_snippet, question_type, model_answer, rubric')
      .eq('quiz_id', assignment.quiz_id)
      .order('order_index')

    if (questionsError || !questions) return errorResponse('Failed to load quiz questions', 500)

    // ── Tweak 3: Strict validation of answer keys ────────────────────
    const validQuestionIds = new Set(questions.map(q => q.id))
    const validatedAnswers: Record<string, string> = {}
    for (const [qid, ans] of Object.entries(answers)) {
      if (validQuestionIds.has(qid)) {
        validatedAnswers[qid] = ans
      }
    }

    // ── Grade MCQ questions ──────────────────────────────────────────
    let score = 0
    let maxScore = 0
    let mcqMaxScore = 0
    let openEndedMaxScore = 0
    let hasOpenEnded = false
    const results: Record<string, { correct: boolean; correctAnswer: string; correctIndex: number; questionType: string }> = {}

    for (const question of questions) {
      maxScore += question.points

      if (question.question_type === 'open_ended') {
        hasOpenEnded = true
        openEndedMaxScore += question.points
        results[question.id] = { correct: false, correctAnswer: '', correctIndex: -1, questionType: 'open_ended' }
        continue
      }

      mcqMaxScore += question.points
      const optionsData = question.options as any
      let optionsList: string[] = []

      if (optionsData?.en && Array.isArray(optionsData.en)) {
        optionsList = optionsData.en
      } else if (optionsData?.options && Array.isArray(optionsData.options)) {
        optionsList = optionsData.options.map((opt: any) => opt.text)
      }

      const selectedIdx = parseInt(validatedAnswers[question.id] ?? '-1')

      let correctIdx = -1
      const parsedCorrectIdx = parseInt(question.correct_answer ?? '-1')
      if (!isNaN(parsedCorrectIdx) && parsedCorrectIdx >= 0 && parsedCorrectIdx < optionsList.length) {
        correctIdx = parsedCorrectIdx
      } else {
        correctIdx = optionsList.findIndex(opt => opt === question.correct_answer)
      }

      const isCorrect = selectedIdx >= 0 && selectedIdx === correctIdx
      if (isCorrect) score += question.points

      const correctAnswerText = correctIdx >= 0 && correctIdx < optionsList.length
        ? optionsList[correctIdx]
        : (question.correct_answer ?? '')

      results[question.id] = { correct: isCorrect, correctAnswer: correctAnswerText, correctIndex: correctIdx, questionType: 'multiple_choice' }
    }

    const gradableMaxScore = hasOpenEnded ? mcqMaxScore : maxScore
    const percentage = gradableMaxScore > 0 ? Math.round((score / gradableMaxScore) * 100) : 0
    const gradingStatus = hasOpenEnded ? 'needs_manual_grading' : 'auto_graded'
    const passed = hasOpenEnded ? false : percentage >= (assignment.quizzes?.passing_score || 60)

    // ── Freeze (or reuse) a quiz_version for this submission ─────────
    // Versioning ensures the exam definition the student saw is preserved
    // independently of future edits to quiz_questions.
    let quizVersionId: string | null = null
    try {
      const { data: vid, error: vErr } = await adminSupabase.rpc('freeze_quiz_version', { p_quiz_id: assignment.quiz_id })
      if (vErr) {
        console.error('freeze_quiz_version error (continuing without versioning):', vErr.message)
      } else {
        quizVersionId = vid as unknown as string
      }
    } catch (e) {
      console.error('freeze_quiz_version threw (continuing):', e)
    }

    // ── SAFE snapshot for client review (never includes correct_answer) ──
    const questionsSnapshot = questions.map(q => ({
      id: q.id,
      question_text: q.question_text,
      question_text_ar: q.question_text_ar,
      options: q.options,
      points: q.points,
      order_index: q.order_index,
      image_url: q.image_url,
      code_snippet: q.code_snippet,
      question_type: q.question_type,
    }))

    // ── FULL snapshot stays SERVER-ONLY in quiz_submission_audit table ──
    const questionsFullSnapshot = questions.map(q => ({
      id: q.id,
      question_text: q.question_text,
      question_text_ar: q.question_text_ar,
      options: q.options,
      correct_answer: q.correct_answer,
      points: q.points,
      order_index: q.order_index,
      image_url: q.image_url,
      code_snippet: q.code_snippet,
      question_type: q.question_type,
      model_answer: q.model_answer,
      rubric: q.rubric,
    }))

    // ── Save submission (UNIQUE constraint prevents duplicates) ──────
    const studentId = force ? assignment.student_id : userId
    const submissionPayload = {
      quiz_assignment_id,
      student_id: studentId,
      answers: validatedAnswers,
      score,
      max_score: maxScore,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      grading_status: gradingStatus,
      manual_score: 0,
      questions_snapshot: questionsSnapshot,
      quiz_version_id: quizVersionId,
    }

    console.log('quiz_submissions insert payload keys:', Object.keys(submissionPayload))

    const { data: submission, error: submissionError } = await adminSupabase
      .from('quiz_submissions')
      .insert(submissionPayload)
      .select('id, score, max_score, percentage, grading_status')
      .single()

    if (submissionError) {
      // If duplicate constraint hit, return existing
      if (submissionError.code === '23505') {
        logAudit(adminSupabase, userId, quiz_assignment_id, 'duplicate_constraint_hit', {})
        const { data: existing } = await adminSupabase
          .from('quiz_submissions')
          .select('*')
          .eq('quiz_assignment_id', quiz_assignment_id)
          .eq('student_id', studentId)
          .single()
        if (existing) {
          return jsonResponse({
            success: true, score: existing.score, maxScore: existing.max_score,
            percentage: existing.percentage, passed: false, idempotent: true,
            hasOpenEnded: existing.grading_status === 'needs_manual_grading',
            gradingStatus: existing.grading_status, results: {},
          })
        }
      }
      console.error('Submission error:', submissionError)
      return errorResponse('Failed to save submission', 500)
    }

    // ── Write isolated audit record (server-only sensitive layer) ────
    const { error: auditError } = await adminSupabase
      .from('quiz_submission_audit')
      .insert({
        submission_id: submission.id,
        quiz_version_id: quizVersionId,
        questions_full_snapshot: questionsFullSnapshot,
      })
    if (auditError) console.error('Audit insert error (non-fatal):', auditError)

    // ── Save per-question attempts ───────────────────────────────────
    //     is_correct_auto  = immutable server auto-grade decision (set once).
    //     is_correct_final = current correctness (mutable via manual override; trigger tracks).
    //     is_correct       = legacy mirror of is_correct_final (kept for backward compatibility).
    const attempts = questions.map(q => {
      const isOpenEnded = q.question_type === 'open_ended'
      const explicitIsCorrect = isOpenEnded ? null : !!results[q.id]?.correct
      return {
        submission_id: submission.id,
        question_id: q.id,
        student_id: studentId,
        answer: validatedAnswers[q.id] || null,
        score: isOpenEnded ? null : (results[q.id]?.correct ? q.points : 0),
        max_score: q.points,
        grading_status: isOpenEnded ? 'ungraded' : 'auto_graded',
        is_correct: explicitIsCorrect,
        is_correct_auto: explicitIsCorrect,
        is_correct_final: explicitIsCorrect,
      }
    })

    const { error: attemptsError } = await adminSupabase
      .from('quiz_question_attempts')
      .insert(attempts)
    if (attemptsError) console.error('Attempts insert error:', attemptsError)

    // ── Append assessment events (event-sourced audit) ──────────────
    try {
      await adminSupabase.from('assessment_events').insert([
        {
          event_type: 'submitted',
          entity_type: 'quiz_submission',
          entity_id: submission.id,
          submission_id: submission.id,
          quiz_version_id: quizVersionId,
          actor_id: userId,
          payload: {
            student_id: studentId,
            answered_count: Object.keys(validatedAnswers).length,
            total_questions: questions.length,
            used_fallback: usedFallback,
            force: !!force,
          },
        },
        {
          event_type: 'auto_graded',
          entity_type: 'quiz_submission',
          entity_id: submission.id,
          submission_id: submission.id,
          quiz_version_id: quizVersionId,
          actor_id: null,
          payload: {
            score,
            max_score: maxScore,
            percentage,
            grading_status: gradingStatus,
            has_open_ended: hasOpenEnded,
          },
        },
      ])
    } catch (e) {
      console.error('assessment_events insert error (non-fatal):', e)
    }


    // ── Tweak 5: Cleanup draft_answers after successful submit ──────
    await adminSupabase
      .from('exam_live_progress')
      .update({
        status: 'submitted',
        draft_answers: {},
        last_activity_at: new Date().toISOString(),
      })
      .eq('quiz_assignment_id', quiz_assignment_id)
      .eq('student_id', studentId)

    // ── Audit log ────────────────────────────────────────────────────
    logAudit(adminSupabase, userId, quiz_assignment_id, usedFallback ? 'submit_with_fallback' : (force ? 'force_submit' : 'submit_success'), {
      score, maxScore, percentage, usedFallback, force: !!force,
      answeredCount: Object.keys(validatedAnswers).length,
      totalQuestions: questions.length,
    })

    console.log(`Quiz graded for user ${studentId}: ${score}/${maxScore} (${percentage}%)${usedFallback ? ' [FALLBACK]' : ''}${force ? ' [FORCE]' : ''}`)

    // ── Final exam status update ─────────────────────────────────────
    try {
      const { data: finalExamLevel } = await adminSupabase
        .from('levels')
        .select('id')
        .eq('final_exam_quiz_id', assignment.quiz_id)
        .maybeSingle()

      if (finalExamLevel && assignment.group_id) {
        // Update exam_submitted_at regardless of current status (trigger may have changed it)
        await adminSupabase
          .from('group_student_progress')
          .update({ exam_submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('group_id', assignment.group_id)
          .eq('student_id', studentId)
          .is('exam_submitted_at', null)

        const { data: pendingStudents } = await adminSupabase
          .from('group_student_progress')
          .select('id')
          .eq('group_id', assignment.group_id)
          .eq('status', 'exam_scheduled')
          .is('exam_submitted_at', null)

        if (!pendingStudents || pendingStudents.length === 0) {
          await adminSupabase
            .from('groups')
            .update({ level_status: 'exam_done' })
            .eq('id', assignment.group_id)
          console.log(`All students submitted - group ${assignment.group_id} level_status set to exam_done`)
        }
      }
    } catch (e) {
      console.error('Error checking final exam status:', e)
    }

    // ── Notify admins if failed ──────────────────────────────────────
    if (!passed) {
      try {
        const { data: studentProfile } = await adminSupabase
          .from('profiles')
          .select('full_name, full_name_ar')
          .eq('user_id', studentId)
          .single()

        const quizTitle = assignment.quizzes?.title || 'Quiz'
        const quizTitleAr = assignment.quizzes?.title_ar || 'كويز'
        const studentName = studentProfile?.full_name || 'Student'
        const studentNameAr = studentProfile?.full_name_ar || 'طالب'

        const { data: admins } = await adminSupabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin')

        if (admins?.length) {
          const notifications = admins.map(admin => ({
            user_id: admin.user_id,
            title: 'Student Failed Quiz',
            title_ar: 'طالب رسب في الكويز',
            message: `${studentName} failed "${quizTitle}" with ${percentage}%`,
            message_ar: `${studentNameAr} رسب في "${quizTitleAr}" بنسبة ${percentage}%`,
            type: 'warning',
            category: 'quiz',
            action_url: '/quiz-reports',
          }))
          await adminSupabase.from('notifications').insert(notifications)
        }
      } catch (e) {
        console.error('Error notifying admins:', e)
      }
    }

    return jsonResponse({
      success: true,
      score,
      maxScore,
      percentage: hasOpenEnded ? null : percentage,
      passed,
      hasOpenEnded,
      gradingStatus,
      results,
      usedFallback,
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return errorResponse('Internal server error', 500)
  }
})

// ── Audit logger (non-blocking) ──────────────────────────────────────
function logAudit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  entityId: string,
  action: string,
  details: Record<string, unknown>
) {
  supabase.from('activity_logs').insert({
    user_id: userId,
    action: 'submit',
    entity_type: 'quiz_submission',
    entity_id: entityId,
    details: { sub_action: action, ...details },
  }).then(({ error }) => {
    if (error) console.error('Audit log error:', error)
  })
}
