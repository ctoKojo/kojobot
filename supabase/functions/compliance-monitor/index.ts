import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompletedSession {
  id: string;
  session_date: string;
  session_time: string;
  session_number: number;
  group_id: string;
  groups: {
    instructor_id: string;
    name: string;
    name_ar: string;
    starting_session_number: number | null;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      instructorWarnings: 0,
      studentWarnings: 0,
      skippedLegacySessions: 0,
      errors: [] as string[],
    };

    // Get current time in Egypt timezone
    const now = new Date();
    const egyptTime = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
    const todayStr = egyptTime.toISOString().split('T')[0];
    const currentTime = egyptTime.toTimeString().split(' ')[0];

    console.log(`[Compliance Monitor] Running at ${todayStr} ${currentTime} Egypt time`);

    // Helper function to check if session is a legacy session (before starting_session_number)
    // Legacy sessions are auto-generated as "completed" for existing groups and should be skipped
    const isLegacySession = (session: CompletedSession): boolean => {
      const startingNum = session.groups.starting_session_number || 1;
      // If starting_session_number > 1, sessions before it are legacy (auto-completed)
      if (startingNum > 1 && session.session_number < startingNum) {
        return true;
      }
      return false;
    };

    // ========================================
    // 1. Check for sessions without quiz
    // ========================================
    const { data: sessionsWithoutQuiz, error: quizError } = await supabase
      .from('sessions')
      .select(`
        id, session_date, session_time, session_number, group_id,
        groups!inner(instructor_id, name, name_ar, starting_session_number)
      `)
      .eq('status', 'completed');

    if (quizError) {
      console.error('Error fetching sessions for quiz check:', quizError);
      results.errors.push(`Quiz check error: ${quizError.message}`);
    } else if (sessionsWithoutQuiz) {
      for (const session of sessionsWithoutQuiz as unknown as CompletedSession[]) {
        // Skip legacy sessions (auto-completed for existing groups)
        if (isLegacySession(session)) {
          results.skippedLegacySessions++;
          continue;
        }

        // Check if quiz assignment exists for this session
        const { data: quizAssignment } = await supabase
          .from('quiz_assignments')
          .select('id')
          .eq('session_id', session.id)
          .limit(1)
          .maybeSingle();

        if (!quizAssignment) {
          // Check if warning already exists
          const { data: existingWarning } = await supabase
            .from('instructor_warnings')
            .select('id')
            .eq('session_id', session.id)
            .eq('warning_type', 'no_quiz')
            .eq('is_active', true)
            .maybeSingle();

          if (!existingWarning) {
            // Create warning
            const { error: insertError } = await supabase
              .from('instructor_warnings')
              .insert({
                instructor_id: session.groups.instructor_id,
                session_id: session.id,
                warning_type: 'no_quiz',
                reason: `No quiz assigned for Session ${session.session_number} (${session.groups.name})`,
                reason_ar: `لم يتم تعيين كويز للسيشن ${session.session_number} (${session.groups.name_ar})`,
              });

            if (insertError) {
              console.error('Error inserting quiz warning:', insertError);
            } else {
              results.instructorWarnings++;
              console.log(`[Warning] No quiz for session ${session.id}`);

              // Send notification to instructor
              await supabase.from('notifications').insert({
                user_id: session.groups.instructor_id,
                title: 'Warning: Missing Quiz',
                title_ar: 'تحذير: كويز مفقود',
                message: `You didn't add a quiz for Session ${session.session_number} (${session.groups.name})`,
                message_ar: `لم تقم بإضافة كويز للسيشن ${session.session_number} (${session.groups.name_ar})`,
                type: 'warning',
                category: 'compliance',
              });
            }
          }
        }
      }
    }

    // ========================================
    // 2. Check for sessions without attendance (within session time)
    // ========================================
    const { data: completedSessions, error: attendanceCheckError } = await supabase
      .from('sessions')
      .select(`
        id, session_date, session_time, session_number, group_id, duration_minutes,
        groups!inner(instructor_id, name, name_ar, starting_session_number)
      `)
      .eq('status', 'completed');

    if (attendanceCheckError) {
      console.error('Error fetching sessions for attendance check:', attendanceCheckError);
      results.errors.push(`Attendance check error: ${attendanceCheckError.message}`);
    } else if (completedSessions) {
      for (const session of completedSessions as unknown as (CompletedSession & { duration_minutes: number })[]) {
        // Skip legacy sessions (auto-completed for existing groups)
        if (isLegacySession(session)) {
          continue; // Already counted in quiz check
        }

        // Check if any attendance records exist
        const { count: attendanceCount } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id);

        if (attendanceCount === 0) {
          // Check if warning already exists
          const { data: existingWarning } = await supabase
            .from('instructor_warnings')
            .select('id')
            .eq('session_id', session.id)
            .eq('warning_type', 'no_attendance')
            .eq('is_active', true)
            .maybeSingle();

          if (!existingWarning) {
            const { error: insertError } = await supabase
              .from('instructor_warnings')
              .insert({
                instructor_id: session.groups.instructor_id,
                session_id: session.id,
                warning_type: 'no_attendance',
                reason: `Attendance not recorded for Session ${session.session_number} (${session.groups.name})`,
                reason_ar: `لم يتم تسجيل الحضور للسيشن ${session.session_number} (${session.groups.name_ar})`,
              });

            if (insertError) {
              console.error('Error inserting attendance warning:', insertError);
            } else {
              results.instructorWarnings++;
              console.log(`[Warning] No attendance for session ${session.id}`);

              // Send notification
              await supabase.from('notifications').insert({
                user_id: session.groups.instructor_id,
                title: 'Warning: Missing Attendance',
                title_ar: 'تحذير: حضور مفقود',
                message: `You didn't record attendance for Session ${session.session_number} (${session.groups.name})`,
                message_ar: `لم تقم بتسجيل الحضور للسيشن ${session.session_number} (${session.groups.name_ar})`,
                type: 'warning',
                category: 'compliance',
              });
            }
          }
        }
      }
    }

    // ========================================
    // 3. Check for sessions 24+ hours old without assignment
    // ========================================
    const yesterday = new Date(egyptTime);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: oldSessions, error: assignmentCheckError } = await supabase
      .from('sessions')
      .select(`
        id, session_date, session_time, session_number, group_id,
        groups!inner(instructor_id, name, name_ar, starting_session_number)
      `)
      .eq('status', 'completed')
      .lte('session_date', yesterdayStr);

    if (assignmentCheckError) {
      console.error('Error fetching sessions for assignment check:', assignmentCheckError);
      results.errors.push(`Assignment check error: ${assignmentCheckError.message}`);
    } else if (oldSessions) {
      for (const session of oldSessions as unknown as CompletedSession[]) {
        // Skip legacy sessions (auto-completed for existing groups)
        if (isLegacySession(session)) {
          continue; // Already counted in quiz check
        }

        // Check if assignment exists for this session
        const { data: assignment } = await supabase
          .from('assignments')
          .select('id')
          .eq('session_id', session.id)
          .limit(1)
          .maybeSingle();

        if (!assignment) {
          // Check if warning already exists
          const { data: existingWarning } = await supabase
            .from('instructor_warnings')
            .select('id')
            .eq('session_id', session.id)
            .eq('warning_type', 'no_assignment')
            .eq('is_active', true)
            .maybeSingle();

          if (!existingWarning) {
            const { error: insertError } = await supabase
              .from('instructor_warnings')
              .insert({
                instructor_id: session.groups.instructor_id,
                session_id: session.id,
                warning_type: 'no_assignment',
                reason: `No assignment uploaded for Session ${session.session_number} within 24 hours (${session.groups.name})`,
                reason_ar: `لم يتم رفع واجب للسيشن ${session.session_number} خلال 24 ساعة (${session.groups.name_ar})`,
              });

            if (insertError) {
              console.error('Error inserting assignment warning:', insertError);
            } else {
              results.instructorWarnings++;
              console.log(`[Warning] No assignment for session ${session.id}`);

              // Send notification
              await supabase.from('notifications').insert({
                user_id: session.groups.instructor_id,
                title: 'Warning: Missing Assignment',
                title_ar: 'تحذير: واجب مفقود',
                message: `You didn't upload an assignment for Session ${session.session_number} within 24 hours (${session.groups.name})`,
                message_ar: `لم تقم برفع واجب للسيشن ${session.session_number} خلال 24 ساعة (${session.groups.name_ar})`,
                type: 'warning',
                category: 'compliance',
              });
            }
          }
        }
      }
    }

    // ========================================
    // 4. Check for expired assignment deadlines (student warnings)
    // Only for assignments linked to non-legacy sessions
    // ========================================
    const { data: expiredAssignments, error: deadlineError } = await supabase
      .from('assignments')
      .select(`
        id, title, title_ar, due_date, group_id, student_id, session_id
      `)
      .lt('due_date', now.toISOString())
      .eq('is_active', true);

    if (deadlineError) {
      console.error('Error fetching expired assignments:', deadlineError);
      results.errors.push(`Deadline check error: ${deadlineError.message}`);
    } else if (expiredAssignments) {
      for (const assignment of expiredAssignments) {
        // If assignment is linked to a session, check if it's a legacy session
        if (assignment.session_id) {
          const { data: sessionData } = await supabase
            .from('sessions')
            .select(`
              session_number,
              groups!inner(starting_session_number)
            `)
            .eq('id', assignment.session_id)
            .maybeSingle();

          if (sessionData) {
            const startingNum = (sessionData.groups as any)?.starting_session_number || 1;
            if (startingNum > 1 && sessionData.session_number < startingNum) {
              // This is a legacy session assignment, skip it
              continue;
            }
          }
        }

        // Get students who should have submitted
        let studentIds: string[] = [];

        if (assignment.student_id) {
          // Individual assignment
          studentIds = [assignment.student_id];
        } else if (assignment.group_id) {
          // Group assignment - get all students in the group
          const { data: groupStudents } = await supabase
            .from('group_students')
            .select('student_id')
            .eq('group_id', assignment.group_id)
            .eq('is_active', true);

          studentIds = (groupStudents || []).map(gs => gs.student_id);
        }

        for (const studentId of studentIds) {
          // Check if student submitted
          const { data: submission } = await supabase
            .from('assignment_submissions')
            .select('id')
            .eq('assignment_id', assignment.id)
            .eq('student_id', studentId)
            .maybeSingle();

          if (!submission) {
            // Check if warning already exists
            const { data: existingWarning } = await supabase
              .from('warnings')
              .select('id')
              .eq('student_id', studentId)
              .eq('assignment_id', assignment.id)
              .eq('warning_type', 'deadline')
              .eq('is_active', true)
              .maybeSingle();

            if (!existingWarning) {
              // Get instructor of the group for issued_by
              let issuedBy = null;
              if (assignment.group_id) {
                const { data: group } = await supabase
                  .from('groups')
                  .select('instructor_id')
                  .eq('id', assignment.group_id)
                  .maybeSingle();
                issuedBy = group?.instructor_id;
              }

              const { error: insertError } = await supabase
                .from('warnings')
                .insert({
                  student_id: studentId,
                  assignment_id: assignment.id,
                  issued_by: issuedBy || studentId, // Fallback to system
                  warning_type: 'deadline',
                  reason: `Assignment deadline missed: ${assignment.title}`,
                  reason_ar: `فات موعد تسليم الواجب: ${assignment.title_ar}`,
                });

              if (insertError) {
                console.error('Error inserting student deadline warning:', insertError);
              } else {
                results.studentWarnings++;
                console.log(`[Warning] Student ${studentId} missed deadline for ${assignment.id}`);

                // Send notification to student
                await supabase.from('notifications').insert({
                  user_id: studentId,
                  title: 'Warning: Missed Deadline',
                  title_ar: 'تحذير: فات موعد التسليم',
                  message: `You missed the deadline for assignment: ${assignment.title}`,
                  message_ar: `فاتك موعد تسليم الواجب: ${assignment.title_ar}`,
                  type: 'warning',
                  category: 'compliance',
                  action_url: `/assignments`,
                });
              }
            }
          }
        }
      }
    }

    console.log(`[Compliance Monitor] Complete. Instructor warnings: ${results.instructorWarnings}, Student warnings: ${results.studentWarnings}, Skipped legacy sessions: ${results.skippedLegacySessions}`);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now.toISOString(),
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Compliance monitor error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
