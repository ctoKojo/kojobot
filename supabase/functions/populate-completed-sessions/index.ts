import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CompletedSession {
  id: string
  session_number: number
  session_date: string
  session_time: string
  group_id: string
}

interface GroupStudent {
  student_id: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { group_id } = await req.json()

    if (!group_id) {
      return new Response(
        JSON.stringify({ error: 'group_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[Populate] Starting for group: ${group_id}`)

    // Get group info
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, name, name_ar, instructor_id')
      .eq('id', group_id)
      .single()

    if (groupError || !group) {
      console.error('Error fetching group:', groupError)
      return new Response(
        JSON.stringify({ error: 'Group not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all completed sessions for this group
    const { data: completedSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, session_number, session_date, session_time, group_id')
      .eq('group_id', group_id)
      .eq('status', 'completed')
      .order('session_number')

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
      throw sessionsError
    }

    if (!completedSessions || completedSessions.length === 0) {
      console.log('No completed sessions found')
      return new Response(
        JSON.stringify({ success: true, message: 'No completed sessions to populate', created: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get students in this group
    const { data: groupStudents, error: studentsError } = await supabase
      .from('group_students')
      .select('student_id')
      .eq('group_id', group_id)
      .eq('is_active', true)

    if (studentsError) {
      console.error('Error fetching students:', studentsError)
      throw studentsError
    }

    if (!groupStudents || groupStudents.length === 0) {
      console.log('No students in group')
      return new Response(
        JSON.stringify({ success: true, message: 'No students in group', created: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = {
      attendance: 0,
      quizzes: 0,
      quizSubmissions: 0,
      assignments: 0,
      assignmentSubmissions: 0,
      errors: [] as string[],
    }

    for (const session of completedSessions as CompletedSession[]) {
      console.log(`[Populate] Processing session #${session.session_number}`)

      // Calculate dates based on session date
      const sessionDate = new Date(session.session_date)
      const dueDate = new Date(sessionDate)
      dueDate.setDate(dueDate.getDate() + 3) // Due 3 days after session

      // ========================================
      // 1. Create Attendance Records
      // ========================================
      for (const student of groupStudents as GroupStudent[]) {
        // Check if attendance exists
        const { data: existingAttendance } = await supabase
          .from('attendance')
          .select('id')
          .eq('session_id', session.id)
          .eq('student_id', student.student_id)
          .maybeSingle()

        if (!existingAttendance) {
          const { error: attendanceError } = await supabase
            .from('attendance')
            .insert({
              session_id: session.id,
              student_id: student.student_id,
              status: 'present',
              recorded_by: group.instructor_id,
              notes: 'Auto-generated for existing group',
            })

          if (attendanceError) {
            console.error('Attendance insert error:', attendanceError)
            results.errors.push(`Attendance error for session ${session.session_number}`)
          } else {
            results.attendance++
          }
        }
      }

      // ========================================
      // 2. Create Quiz for Session
      // ========================================
      // Check if quiz assignment already exists for this session
      const { data: existingQuizAssignment } = await supabase
        .from('quiz_assignments')
        .select('id, quiz_id')
        .eq('session_id', session.id)
        .maybeSingle()

      let quizId: string
      let quizAssignmentId: string

      if (!existingQuizAssignment) {
        // Create quiz
        const { data: newQuiz, error: quizError } = await supabase
          .from('quizzes')
          .insert({
            title: `Session ${session.session_number} Quiz - ${group.name}`,
            title_ar: `كويز السيشن ${session.session_number} - ${group.name_ar}`,
            description: `Auto-generated quiz for session ${session.session_number}`,
            description_ar: `كويز تم إنشاؤه تلقائياً للسيشن ${session.session_number}`,
            duration_minutes: 15,
            passing_score: 60,
            created_by: group.instructor_id,
            is_active: true,
          })
          .select('id')
          .single()

        if (quizError || !newQuiz) {
          console.error('Quiz creation error:', quizError)
          results.errors.push(`Quiz creation error for session ${session.session_number}`)
          continue
        }

        quizId = newQuiz.id
        results.quizzes++

        // Create quiz question
        await supabase.from('quiz_questions').insert({
          quiz_id: quizId,
          question_text: 'What is 2 + 2?',
          question_text_ar: 'ما هو 2 + 2؟',
          question_type: 'multiple_choice',
          options: ['2', '3', '4', '5'],
          correct_answer: '4',
          points: 10,
          order_index: 1,
        })

        // Create quiz assignment
        const { data: newAssignment, error: assignmentError } = await supabase
          .from('quiz_assignments')
          .insert({
            quiz_id: quizId,
            group_id: group_id,
            session_id: session.id,
            assigned_by: group.instructor_id,
            is_active: true,
            start_time: sessionDate.toISOString(),
            due_date: dueDate.toISOString(),
          })
          .select('id')
          .single()

        if (assignmentError || !newAssignment) {
          console.error('Quiz assignment error:', assignmentError)
          continue
        }

        quizAssignmentId = newAssignment.id
      } else {
        quizId = existingQuizAssignment.quiz_id
        quizAssignmentId = existingQuizAssignment.id
      }

      // Create quiz submissions for each student
      for (const student of groupStudents as GroupStudent[]) {
        const { data: existingSubmission } = await supabase
          .from('quiz_submissions')
          .select('id')
          .eq('quiz_assignment_id', quizAssignmentId)
          .eq('student_id', student.student_id)
          .maybeSingle()

        if (!existingSubmission) {
          const { error: submissionError } = await supabase
            .from('quiz_submissions')
            .insert({
              quiz_assignment_id: quizAssignmentId,
              student_id: student.student_id,
              answers: { answers: [{ questionId: 'q1', answer: '4' }] },
              status: 'graded',
              score: 10,
              max_score: 10,
              percentage: 100,
              started_at: sessionDate.toISOString(),
              submitted_at: sessionDate.toISOString(),
              graded_at: sessionDate.toISOString(),
              graded_by: group.instructor_id,
            })

          if (submissionError) {
            console.error('Quiz submission error:', submissionError)
          } else {
            results.quizSubmissions++
          }
        }
      }

      // ========================================
      // 3. Create Assignment for Session
      // ========================================
      const { data: existingAssignment } = await supabase
        .from('assignments')
        .select('id')
        .eq('session_id', session.id)
        .maybeSingle()

      let assignmentId: string

      if (!existingAssignment) {
        const { data: newAssignment, error: assignmentError } = await supabase
          .from('assignments')
          .insert({
            title: `Session ${session.session_number} Homework - ${group.name}`,
            title_ar: `واجب السيشن ${session.session_number} - ${group.name_ar}`,
            description: 'Complete all exercises',
            description_ar: 'أكمل جميع التمارين',
            session_id: session.id,
            group_id: group_id,
            assigned_by: group.instructor_id,
            due_date: dueDate.toISOString(),
            max_score: 100,
            is_active: true,
          })
          .select('id')
          .single()

        if (assignmentError || !newAssignment) {
          console.error('Assignment creation error:', assignmentError)
          results.errors.push(`Assignment creation error for session ${session.session_number}`)
          continue
        }

        assignmentId = newAssignment.id
        results.assignments++
      } else {
        assignmentId = existingAssignment.id
      }

      // Create assignment submissions for each student
      for (const student of groupStudents as GroupStudent[]) {
        const { data: existingSubmission } = await supabase
          .from('assignment_submissions')
          .select('id')
          .eq('assignment_id', assignmentId)
          .eq('student_id', student.student_id)
          .maybeSingle()

        if (!existingSubmission) {
          const { error: submissionError } = await supabase
            .from('assignment_submissions')
            .insert({
              assignment_id: assignmentId,
              student_id: student.student_id,
              content: 'Completed all exercises',
              status: 'graded',
              score: 100,
              submitted_at: sessionDate.toISOString(),
              graded_at: dueDate.toISOString(),
              graded_by: group.instructor_id,
              feedback: 'Excellent work!',
              feedback_ar: 'عمل ممتاز!',
            })

          if (submissionError) {
            console.error('Assignment submission error:', submissionError)
          } else {
            results.assignmentSubmissions++
          }
        }
      }
    }

    console.log('[Populate] Complete:', results)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Populated data for ${completedSessions.length} completed sessions`,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Populate error:', error)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
