import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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
    const results: Record<string, { correct: boolean; correctAnswer: string }> = {}

    for (const question of questions) {
      maxScore += question.points
      const optionsData = question.options as { options: { text: string; text_ar: string }[] } | null
      const optionsList = optionsData?.options || []
      const selectedIdx = parseInt(answers[question.id] || '-1')
      const selectedOption = optionsList[selectedIdx]
      
      const isCorrect = selectedOption && selectedOption.text === question.correct_answer
      if (isCorrect) {
        score += question.points
      }
      
      // Store result for each question
      results[question.id] = {
        correct: !!isCorrect,
        correctAnswer: question.correct_answer
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
