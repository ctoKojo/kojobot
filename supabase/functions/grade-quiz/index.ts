import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { checkRateLimit, getClientIP, rateLimitResponse } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limit config: 20 quiz submissions per minute per IP
const RATE_LIMIT_CONFIG = { maxRequests: 20, windowMs: 60000 }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Apply rate limiting
    const clientIP = getClientIP(req)
    const rateLimitResult = checkRateLimit(clientIP, RATE_LIMIT_CONFIG)
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for grade-quiz from IP: ${clientIP}`)
      return rateLimitResponse(rateLimitResult, corsHeaders)
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Authentication check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token)

    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.claims.sub as string
    const body = await req.json()
    const { quiz_assignment_id, answers } = body

    if (!quiz_assignment_id || !answers) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: quiz_assignment_id and answers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate quiz_assignment_id is UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (typeof quiz_assignment_id !== 'string' || !uuidRegex.test(quiz_assignment_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid quiz_assignment_id format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate answers is an object with reasonable size
    if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
      return new Response(
        JSON.stringify({ error: 'Answers must be a JSON object' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const answerKeys = Object.keys(answers)
    if (answerKeys.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Invalid number of answers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use service role to access correct answers
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Verify assignment belongs to this student
    const { data: assignment, error: assignmentError } = await adminSupabase
      .from('quiz_assignments')
      .select('*, quizzes(*)')
      .eq('id', quiz_assignment_id)
      .single()

    if (assignmentError || !assignment) {
      return new Response(
        JSON.stringify({ error: 'Quiz assignment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Time-based validation
    const now = new Date().getTime()
    const duration = assignment.quizzes?.duration_minutes || 30
    const durationMs = duration * 60 * 1000
    const gracePeriodMs = 60 * 1000 // 1 minute grace period for submission

    if (assignment.start_time) {
      const startTime = new Date(assignment.start_time).getTime()
      
      // Check if quiz hasn't started yet
      if (now < startTime) {
        return new Response(
          JSON.stringify({ error: 'Quiz has not started yet' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Check if quiz time window has passed (with grace period for submission)
      const quizEndTime = startTime + durationMs + gracePeriodMs
      if (now > quizEndTime) {
        return new Response(
          JSON.stringify({ error: 'Quiz time has expired' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Verify the student is allowed to take this quiz
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
      return new Response(
        JSON.stringify({ error: 'You are not authorized to submit this quiz' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get questions with correct answers (only accessible server-side)
    const { data: questions, error: questionsError } = await adminSupabase
      .from('quiz_questions')
      .select('id, options, correct_answer, points')
      .eq('quiz_id', assignment.quiz_id)

    if (questionsError || !questions) {
      return new Response(
        JSON.stringify({ error: 'Failed to load quiz questions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate score
    let score = 0
    let maxScore = 0
    const results: Record<string, { correct: boolean; correctAnswer: string; correctIndex: number }> = {}

    for (const question of questions) {
      maxScore += question.points
      const optionsData = question.options as any
      let optionsList: string[] = []
      
      // Support both new format { en: [...], ar: [...] } and old format { options: [...] }
      if (optionsData?.en && Array.isArray(optionsData.en)) {
        optionsList = optionsData.en
      } else if (optionsData?.options && Array.isArray(optionsData.options)) {
        optionsList = optionsData.options.map((opt: any) => opt.text)
      }
      
      const selectedIdx = parseInt(answers[question.id] ?? '-1')
      
      // correct_answer can be either:
      // 1. An index as string (e.g., "0", "1", "2") - new simplified format
      // 2. The actual option text - old format
      let correctIdx = -1
      const parsedCorrectIdx = parseInt(question.correct_answer)
      
      if (!isNaN(parsedCorrectIdx) && parsedCorrectIdx >= 0 && parsedCorrectIdx < optionsList.length) {
        // correct_answer is an index
        correctIdx = parsedCorrectIdx
      } else {
        // correct_answer is the option text, find its index
        correctIdx = optionsList.findIndex(opt => opt === question.correct_answer)
      }
      
      const isCorrect = selectedIdx >= 0 && selectedIdx === correctIdx
      if (isCorrect) {
        score += question.points
      }
      
      // Store result for each question
      const correctAnswerText = correctIdx >= 0 && correctIdx < optionsList.length 
        ? optionsList[correctIdx] 
        : question.correct_answer
        
      results[question.id] = {
        correct: isCorrect,
        correctAnswer: correctAnswerText,
        correctIndex: correctIdx
      }
    }

    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
    const passed = percentage >= (assignment.quizzes?.passing_score || 60)

    // Save submission
    const { data: submission, error: submissionError } = await adminSupabase
      .from('quiz_submissions')
      .insert({
        quiz_assignment_id,
        student_id: userId,
        answers,
        score,
        max_score: maxScore,
        percentage,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (submissionError) {
      console.error('Submission error:', submissionError)
      return new Response(
        JSON.stringify({ error: 'Failed to save submission' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Quiz graded for user ${userId}: ${score}/${maxScore} (${percentage}%)`)

    // Check if this quiz is a level final exam
    try {
      const { data: finalExamLevel } = await adminSupabase
        .from('levels')
        .select('id')
        .eq('final_exam_quiz_id', assignment.quiz_id)
        .maybeSingle()

      if (finalExamLevel) {
        // Update exam_submitted_at in group_student_progress
        const groupId = assignment.group_id
        if (groupId) {
          await adminSupabase
            .from('group_student_progress')
            .update({ exam_submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('group_id', groupId)
            .eq('student_id', userId)
            .eq('status', 'exam_scheduled')

          console.log(`Updated exam_submitted_at for student ${userId} in group ${groupId}`)

          // Check if all scheduled students have submitted
          const { data: pendingStudents } = await adminSupabase
            .from('group_student_progress')
            .select('id')
            .eq('group_id', groupId)
            .eq('status', 'exam_scheduled')
            .is('exam_submitted_at', null)

          if (!pendingStudents || pendingStudents.length === 0) {
            await adminSupabase
              .from('groups')
              .update({ level_status: 'exam_done' })
              .eq('id', groupId)
            console.log(`All students submitted - group ${groupId} level_status set to exam_done`)
          }
        }
      }
    } catch (finalExamError) {
      console.error('Error checking final exam status:', finalExamError)
    }

    // Notify admins if student failed
    if (!passed) {
      try {
        // Get student name
        const { data: studentProfile } = await adminSupabase
          .from('profiles')
          .select('full_name, full_name_ar')
          .eq('user_id', userId)
          .single()

        // Get quiz info
        const quizTitle = assignment.quizzes?.title || 'Quiz'
        const quizTitleAr = assignment.quizzes?.title_ar || 'كويز'
        const studentName = studentProfile?.full_name || 'Student'
        const studentNameAr = studentProfile?.full_name_ar || 'طالب'

        // Get all admin user IDs
        const { data: admins } = await adminSupabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin')

        if (admins && admins.length > 0) {
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
          console.log(`Notified ${admins.length} admins about failed quiz`)
        }
      } catch (notifyError) {
        console.error('Error notifying admins:', notifyError)
        // Don't fail the grading if notification fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        score,
        maxScore,
        percentage,
        passed,
        results // Contains correct answers for review after submission
      }),
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
