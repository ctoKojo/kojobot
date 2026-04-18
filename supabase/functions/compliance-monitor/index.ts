import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCairoNow, getCairoCurrentMonth, getCairoDatePlusDays } from "../_shared/cairoTime.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompletedSession {
  id: string;
  session_date: string;
  session_time: string;
  session_number: number;
  content_number: number | null;
  level_id: string | null;
  duration_minutes?: number;
  group_id: string;
  groups: {
    instructor_id: string;
    name: string;
    name_ar: string;
    starting_session_number: number | null;
  };
}

// Cache curriculum lookups within a single run to avoid repeated queries
const curriculumCache = new Map<string, { expectsQuiz: boolean; expectsAssignment: boolean }>();

async function getCurriculumExpectations(
  supabase: any,
  levelId: string | null,
  contentNumber: number | null
): Promise<{ expectsQuiz: boolean; expectsAssignment: boolean } | null> {
  if (!levelId || !contentNumber) return null;
  const key = `${levelId}::${contentNumber}`;
  if (curriculumCache.has(key)) return curriculumCache.get(key)!;

  const { data } = await supabase
    .from('curriculum_sessions')
    .select('quiz_id, assignment_title')
    .eq('level_id', levelId)
    .eq('session_number', contentNumber)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!data) {
    curriculumCache.set(key, { expectsQuiz: false, expectsAssignment: false });
    return curriculumCache.get(key)!;
  }
  const result = {
    expectsQuiz: !!data.quiz_id,
    expectsAssignment: !!(data.assignment_title && data.assignment_title.trim().length > 0),
  };
  curriculumCache.set(key, result);
  return result;
}

// Check if session's grace period (end + 60 min) has passed in Cairo time
function isPastGracePeriod(sessionDate: string, sessionTime: string, durationMinutes: number): boolean {
  // Cairo offset is +03:00 (no DST since 2014)
  const sessionEnd = new Date(`${sessionDate}T${sessionTime}+03:00`);
  sessionEnd.setMinutes(sessionEnd.getMinutes() + durationMinutes + 60);
  return Date.now() >= sessionEnd.getTime();
}

const BATCH_SIZE = 100;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Auth: service role, CRON_SECRET env, OR vault cron_secret (via RPC)
  const authHeader = req.headers.get('Authorization');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cronSecret = Deno.env.get('CRON_SECRET');
  const token = authHeader?.replace('Bearer ', '') ?? '';
  const isServiceRole = token === supabaseKey;
  const isCronEnvAuth = !!cronSecret && token === cronSecret;

  let isVaultCronAuth = false;
  if (!isServiceRole && !isCronEnvAuth && token) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const tmpClient = createClient(supabaseUrl, supabaseKey);
      const { data } = await tmpClient.rpc('verify_cron_token', { p_token: token });
      isVaultCronAuth = data === true;
    } catch (_) {
      isVaultCronAuth = false;
    }
  }

  if (!isServiceRole && !isCronEnvAuth && !isVaultCronAuth) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const startTime = Date.now();
  const TIMEOUT_MS = 30000;
  const CIRCUIT_BREAKER_THRESHOLD = 0.8; // 80%

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      instructorWarnings: 0,
      studentWarnings: 0,
      skippedLegacySessions: 0,
      slaReminders: 0,
      slaWarnings: 0,
      metricsUpdated: 0,
      bonusRecommendations: 0,
      errors: [] as string[],
      circuitBreakerTriggered: false,
    };

    const now = new Date();
    // Use Cairo SSOT instead of brittle toLocaleString→new Date parsing
    const cairo = getCairoNow();
    const todayStr = cairo.today;
    const currentTime = cairo.timeHHMMSS;
    const currentMonth = getCairoCurrentMonth();

    console.log(`[Compliance Monitor] Running at ${todayStr} ${currentTime} Egypt time`);

    const checkCircuitBreaker = (): boolean => {
      const elapsed = Date.now() - startTime;
      if (elapsed > TIMEOUT_MS * CIRCUIT_BREAKER_THRESHOLD) {
        console.warn(`[Circuit Breaker] Triggered at ${elapsed}ms (${Math.round(elapsed/TIMEOUT_MS*100)}% of timeout)`);
        results.circuitBreakerTriggered = true;
        return true;
      }
      return false;
    };

    const isLegacySession = (session: CompletedSession): boolean => {
      const startingNum = session.groups.starting_session_number || 1;
      if (startingNum > 1 && session.session_number < startingNum) return true;
      return false;
    };

    // ========================================
    // Section 1: Check sessions without quiz (curriculum-aware, time-based)
    // ========================================
    try {
      const sixtyDaysAgo = getCairoDatePlusDays(-60);
      const { data: sessionsForQuiz, error: quizError } = await supabase
        .from('sessions')
        .select(`id, session_date, session_time, session_number, content_number, level_id, duration_minutes, group_id, groups!inner(instructor_id, name, name_ar, starting_session_number, status)`)
        .in('status', ['completed', 'scheduled'])
        .neq('groups.status', 'frozen')
        .gte('session_date', sixtyDaysAgo)
        .lte('session_date', todayStr)
        .order('session_date', { ascending: true })
        .limit(BATCH_SIZE);

      if (quizError) {
        results.errors.push(`Quiz check error: ${quizError.message}`);
      } else if (sessionsForQuiz) {
        for (const session of sessionsForQuiz as unknown as CompletedSession[]) {
          if (checkCircuitBreaker()) break;
          if (isLegacySession(session)) { results.skippedLegacySessions++; continue; }
          // Time-based: only act if grace period passed
          if (!isPastGracePeriod(session.session_date, session.session_time, session.duration_minutes ?? 60)) continue;

          // Curriculum-aware: skip if this session does not expect a quiz
          const expect = await getCurriculumExpectations(supabase, session.level_id, session.content_number);
          if (expect && !expect.expectsQuiz) continue;

          const { data: quizAssignment } = await supabase
            .from('quiz_assignments').select('id').eq('session_id', session.id).limit(1).maybeSingle();

          if (!quizAssignment) {
            // Idempotency: check existing active warning (partial unique indexes don't play well with PostgREST upsert)
            const { data: existing } = await supabase
              .from('instructor_warnings').select('id')
              .eq('session_id', session.id).eq('warning_type', 'no_quiz').eq('is_active', true)
              .limit(1).maybeSingle();

            if (!existing) {
              const { error: insertError } = await supabase
                .from('instructor_warnings')
                .insert({
                  instructor_id: session.groups.instructor_id,
                  session_id: session.id,
                  warning_type: 'no_quiz',
                  reason: `No quiz assigned for Session ${session.session_number} (${session.groups.name})`,
                  reason_ar: `لم يتم تعيين كويز للسيشن ${session.session_number} (${session.groups.name_ar})`,
                });

              if (!insertError) {
                results.instructorWarnings++;
                await supabase.from('notifications').insert({
                  user_id: session.groups.instructor_id,
                  title: 'Warning: Missing Quiz', title_ar: 'تحذير: كويز مفقود',
                  message: `You didn't add a quiz for Session ${session.session_number} (${session.groups.name})`,
                  message_ar: `لم تقم بإضافة كويز للسيشن ${session.session_number} (${session.groups.name_ar})`,
                  type: 'warning', category: 'compliance',
                });
              } else {
                console.error('[no_quiz insert error]', insertError);
              }
            }
          }
        }
      }
    } catch (e) {
      results.errors.push(`Section 1 error: ${e.message}`);
    }

    // ========================================
    // Section 2: Sessions without attendance (time-based)
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        const sixtyDaysAgoAtt = getCairoDatePlusDays(-60);
        const { data: completedSessions, error: attendanceCheckError } = await supabase
          .from('sessions')
          .select(`id, session_date, session_time, session_number, content_number, level_id, group_id, duration_minutes, groups!inner(instructor_id, name, name_ar, starting_session_number, status)`)
          .in('status', ['completed', 'scheduled'])
          .neq('groups.status', 'frozen')
          .gte('session_date', sixtyDaysAgoAtt)
          .lte('session_date', todayStr)
          .order('session_date', { ascending: true })
          .limit(BATCH_SIZE);

        if (attendanceCheckError) {
          results.errors.push(`Attendance check error: ${attendanceCheckError.message}`);
        } else if (completedSessions) {
          for (const session of completedSessions as unknown as CompletedSession[]) {
            if (checkCircuitBreaker()) break;
            if (isLegacySession(session)) continue;
            if (!isPastGracePeriod(session.session_date, session.session_time, session.duration_minutes ?? 60)) continue;

            const { count: attendanceCount } = await supabase
              .from('attendance').select('*', { count: 'exact', head: true }).eq('session_id', session.id);

            if (attendanceCount === 0) {
              const { data: existing } = await supabase
                .from('instructor_warnings').select('id')
                .eq('session_id', session.id).eq('warning_type', 'no_attendance').eq('is_active', true)
                .limit(1).maybeSingle();

              if (!existing) {
                const { error: insertError } = await supabase
                  .from('instructor_warnings')
                  .insert({
                    instructor_id: session.groups.instructor_id,
                    session_id: session.id,
                    warning_type: 'no_attendance',
                    reason: `Attendance not recorded for Session ${session.session_number} (${session.groups.name})`,
                    reason_ar: `لم يتم تسجيل الحضور للسيشن ${session.session_number} (${session.groups.name_ar})`,
                  });

                if (!insertError) {
                  results.instructorWarnings++;
                  await supabase.from('notifications').insert({
                    user_id: session.groups.instructor_id,
                    title: 'Warning: Missing Attendance', title_ar: 'تحذير: حضور مفقود',
                    message: `You didn't record attendance for Session ${session.session_number} (${session.groups.name})`,
                    message_ar: `لم تقم بتسجيل الحضور للسيشن ${session.session_number} (${session.groups.name_ar})`,
                    type: 'warning', category: 'compliance',
                  });
                } else {
                  console.error('[no_attendance insert error]', insertError);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      results.errors.push(`Section 2 error: ${e.message}`);
    }

    // ========================================
    // Section 3: Sessions without assignment (curriculum-aware, 24h+)
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        const yesterdayStr = getCairoDatePlusDays(-1);
        const sixtyDaysAgo = getCairoDatePlusDays(-60);

        const { data: oldSessions, error: assignmentCheckError } = await supabase
          .from('sessions')
          .select(`id, session_date, session_time, session_number, content_number, level_id, duration_minutes, group_id, groups!inner(instructor_id, name, name_ar, starting_session_number, status)`)
          .in('status', ['completed', 'scheduled'])
          .neq('groups.status', 'frozen')
          .gte('session_date', sixtyDaysAgo)
          .lte('session_date', yesterdayStr)
          .order('session_date', { ascending: true })
          .limit(BATCH_SIZE);

        if (assignmentCheckError) {
          results.errors.push(`Assignment check error: ${assignmentCheckError.message}`);
        } else if (oldSessions) {
          for (const session of oldSessions as unknown as CompletedSession[]) {
            if (checkCircuitBreaker()) break;
            if (isLegacySession(session)) continue;

            // Curriculum-aware: skip if this session does not expect an assignment
            const expect = await getCurriculumExpectations(supabase, session.level_id, session.content_number);
            if (expect && !expect.expectsAssignment) continue;

            const { data: assignment } = await supabase
              .from('assignments').select('id').eq('session_id', session.id).limit(1).maybeSingle();

            if (!assignment) {
              const { data: existing } = await supabase
                .from('instructor_warnings').select('id')
                .eq('session_id', session.id).eq('warning_type', 'no_assignment').eq('is_active', true)
                .limit(1).maybeSingle();

              if (!existing) {
                const { error: insertError } = await supabase
                  .from('instructor_warnings')
                  .insert({
                    instructor_id: session.groups.instructor_id,
                    session_id: session.id,
                    warning_type: 'no_assignment',
                    reason: `No assignment uploaded for Session ${session.session_number} within 24 hours (${session.groups.name})`,
                    reason_ar: `لم يتم رفع واجب للسيشن ${session.session_number} خلال 24 ساعة (${session.groups.name_ar})`,
                  });

                if (!insertError) {
                  results.instructorWarnings++;
                  await supabase.from('notifications').insert({
                    user_id: session.groups.instructor_id,
                    title: 'Warning: Missing Assignment', title_ar: 'تحذير: واجب مفقود',
                    message: `You didn't upload an assignment for Session ${session.session_number} within 24 hours (${session.groups.name})`,
                    message_ar: `لم تقم برفع واجب للسيشن ${session.session_number} خلال 24 ساعة (${session.groups.name_ar})`,
                    type: 'warning', category: 'compliance',
                  });
                } else {
                  console.error('[no_assignment insert error]', insertError);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      results.errors.push(`Section 3 error: ${e.message}`);
    }

    // ========================================
    // Section 3b: Sessions missing student evaluations (student-set comparison)
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        const sixtyDaysAgo = getCairoDatePlusDays(-60);
        const { data: evalSessions, error: evalSessErr } = await supabase
          .from('sessions')
          .select(`id, session_date, session_time, session_number, content_number, level_id, duration_minutes, group_id, groups!inner(instructor_id, name, name_ar, starting_session_number, status)`)
          .in('status', ['completed', 'scheduled'])
          .neq('groups.status', 'frozen')
          .gte('session_date', sixtyDaysAgo)
          .lte('session_date', todayStr)
          .order('session_date', { ascending: true })
          .limit(BATCH_SIZE);

        if (evalSessErr) {
          results.errors.push(`Evaluation check error: ${evalSessErr.message}`);
        } else if (evalSessions) {
          for (const session of evalSessions as unknown as CompletedSession[]) {
            if (checkCircuitBreaker()) break;
            if (isLegacySession(session)) continue;
            if (!isPastGracePeriod(session.session_date, session.session_time, session.duration_minutes ?? 60)) continue;

            const { data: presentStudents } = await supabase
              .from('attendance').select('student_id').eq('session_id', session.id).eq('status', 'present');

            const presentSet = new Set((presentStudents || []).map((s: any) => s.student_id));
            if (presentSet.size === 0) continue;

            const { data: evaluatedStudents } = await supabase
              .from('session_evaluations').select('student_id').eq('session_id', session.id);

            const evalSet = new Set((evaluatedStudents || []).map((s: any) => s.student_id));
            const missing = [...presentSet].filter((id) => !evalSet.has(id));

            if (missing.length > 0) {
              const { error: insertError, data: inserted } = await supabase
                .from('instructor_warnings')
                .upsert({
                  instructor_id: session.groups.instructor_id,
                  session_id: session.id,
                  warning_type: 'no_evaluation',
                  reason: `Missing evaluations for ${missing.length} student(s) in Session ${session.session_number} (${session.groups.name})`,
                  reason_ar: `تقييمات ناقصة لـ ${missing.length} طالب في السيشن ${session.session_number} (${session.groups.name_ar})`,
                }, { onConflict: 'session_id,warning_type', ignoreDuplicates: true })
                .select('id');

              if (!insertError && inserted && inserted.length > 0) {
                results.instructorWarnings++;
                await supabase.from('notifications').insert({
                  user_id: session.groups.instructor_id,
                  title: 'Warning: Missing Evaluations', title_ar: 'تحذير: تقييمات ناقصة',
                  message: `You didn't evaluate ${missing.length} student(s) for Session ${session.session_number} (${session.groups.name})`,
                  message_ar: `لم تقم بتقييم ${missing.length} طالب للسيشن ${session.session_number} (${session.groups.name_ar})`,
                  type: 'warning', category: 'compliance',
                });
              }
            }
          }
        }
      }
    } catch (e) {
      results.errors.push(`Section 3b (Evaluations) error: ${e.message}`);
    }

    // ========================================
    // Section 4: Student deadline warnings
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        const { data: expiredAssignments, error: deadlineError } = await supabase
          .from('assignments').select(`id, title, title_ar, due_date, group_id, student_id, session_id, attachment_url`)
          .lt('due_date', now.toISOString()).eq('is_active', true)
          .not('attachment_url', 'is', null);

        if (deadlineError) {
          results.errors.push(`Deadline check error: ${deadlineError.message}`);
        } else if (expiredAssignments) {
          for (const assignment of expiredAssignments) {
            if (checkCircuitBreaker()) break;

            if (assignment.session_id) {
              const { data: sessionData } = await supabase
                .from('sessions').select(`session_number, groups!inner(starting_session_number)`)
                .eq('id', assignment.session_id).maybeSingle();
              if (sessionData) {
                const startingNum = (sessionData.groups as any)?.starting_session_number || 1;
                if (startingNum > 1 && sessionData.session_number < startingNum) continue;
              }
            }

            let studentIds: string[] = [];
            if (assignment.student_id) {
              studentIds = [assignment.student_id];
            } else if (assignment.group_id) {
              const { data: groupStudents } = await supabase
                .from('group_students').select('student_id').eq('group_id', assignment.group_id).eq('is_active', true);
              studentIds = (groupStudents || []).map(gs => gs.student_id);
            }

            for (const studentId of studentIds) {
              if (checkCircuitBreaker()) break;
              const { data: submission } = await supabase
                .from('assignment_submissions').select('id').eq('assignment_id', assignment.id).eq('student_id', studentId).maybeSingle();

              if (!submission) {
                const { data: existingWarning } = await supabase
                  .from('warnings').select('id').eq('student_id', studentId).eq('assignment_id', assignment.id)
                  .eq('warning_type', 'deadline').eq('is_active', true).maybeSingle();

                if (!existingWarning) {
                  let issuedBy = null;
                  if (assignment.group_id) {
                    const { data: group } = await supabase.from('groups').select('instructor_id').eq('id', assignment.group_id).maybeSingle();
                    issuedBy = group?.instructor_id;
                  }
                  const { error: insertError } = await supabase.from('warnings').insert({
                    student_id: studentId, assignment_id: assignment.id,
                    issued_by: issuedBy || studentId, warning_type: 'deadline',
                    reason: `Assignment deadline missed: ${assignment.title}`,
                    reason_ar: `فات موعد تسليم الواجب: ${assignment.title_ar}`,
                  });
                  if (!insertError) {
                    results.studentWarnings++;
                    await supabase.from('notifications').insert({
                      user_id: studentId,
                      title: 'Warning: Missed Deadline', title_ar: 'تحذير: فات موعد التسليم',
                      message: `You missed the deadline for assignment: ${assignment.title}`,
                      message_ar: `فاتك موعد تسليم الواجب: ${assignment.title_ar}`,
                      type: 'warning', category: 'compliance', action_url: `/assignments`,
                    });
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      results.errors.push(`Section 4 error: ${e.message}`);
    }

    // ========================================
    // MODULE A: SLA Monitoring Engine
    // ========================================

    // Pre-compute instructor workload map (once for all SLA checks)
    const instructorWorkloadMap = new Map<string, number>();
    const instructorSLAMap = new Map<string, number>();

    try {
      if (!checkCircuitBreaker()) {
        // Get all active instructors and their student counts
        const { data: instructorGroups } = await supabase
          .from('groups').select('instructor_id').eq('is_active', true).not('instructor_id', 'is', null);

        const instructorIds = [...new Set((instructorGroups || []).map(g => g.instructor_id).filter(Boolean))];

        for (const instructorId of instructorIds) {
          const { count } = await supabase
            .from('group_students')
            .select('*', { count: 'exact', head: true })
            .in('group_id', (instructorGroups || []).filter(g => g.instructor_id === instructorId).map(g => g.instructor_id))
            .eq('is_active', true);

          // Actually count students properly via groups
          const { data: instrGroups } = await supabase
            .from('groups').select('id').eq('instructor_id', instructorId).eq('is_active', true);
          const groupIds = (instrGroups || []).map(g => g.id);

          let studentCount = 0;
          if (groupIds.length > 0) {
            const { count: sc } = await supabase
              .from('group_students').select('*', { count: 'exact', head: true })
              .in('group_id', groupIds).eq('is_active', true);
            studentCount = sc || 0;
          }

          instructorWorkloadMap.set(instructorId, studentCount);

          // Dynamic SLA based on workload
          let slaHours = 48;
          if (studentCount > 30) slaHours = 96;
          else if (studentCount >= 20) slaHours = 72;
          instructorSLAMap.set(instructorId, slaHours);
        }
      }
    } catch (e) {
      results.errors.push(`Workload precompute error: ${e.message}`);
    }

    // ========================================
    // Section 5: Message SLA Monitoring
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        // Get all instructor user_ids
        const { data: instructorRoles } = await supabase
          .from('user_roles').select('user_id').eq('role', 'instructor');
        const instructorUserIds = (instructorRoles || []).map(r => r.user_id);

        // Get all student user_ids
        const { data: studentRoles } = await supabase
          .from('user_roles').select('user_id').eq('role', 'student');
        const studentUserIds = new Set((studentRoles || []).map(r => r.user_id));

        if (instructorUserIds.length > 0) {
          // Get all conversations where instructors participate
          const { data: instructorParticipations } = await supabase
            .from('conversation_participants').select('conversation_id, user_id')
            .in('user_id', instructorUserIds);

          // Group by conversation to find instructor-student conversations
          const convInstructorMap = new Map<string, string>();
          for (const p of (instructorParticipations || [])) {
            convInstructorMap.set(p.conversation_id, p.user_id);
          }

          for (const [convId, instructorId] of convInstructorMap) {
            if (checkCircuitBreaker()) break;

            const slaHours = instructorSLAMap.get(instructorId) || 48;

            // Get the latest message in conversation
            const { data: latestMessages } = await supabase
              .from('messages').select('sender_id, created_at')
              .eq('conversation_id', convId).is('deleted_at', null)
              .order('created_at', { ascending: false }).limit(1);

            if (!latestMessages || latestMessages.length === 0) continue;

            const lastMsg = latestMessages[0];

            // Freeze SLA: if last message is from the instructor, skip
            if (lastMsg.sender_id === instructorId) continue;

            // Only care if last message is from a student
            if (!studentUserIds.has(lastMsg.sender_id)) continue;

            const msgTime = new Date(lastMsg.created_at).getTime();
            const hoursSince = (now.getTime() - msgTime) / (1000 * 60 * 60);

            if (hoursSince < slaHours / 2) continue; // Not yet at reminder threshold

            // Prevent Reminder Spam: check if reminder sent in last 12h
            const { data: recentReminder } = await supabase
              .from('performance_events').select('id')
              .eq('instructor_id', instructorId).eq('event_type', 'reminder_sent')
              .eq('reference_id', convId).gte('created_at', new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString())
              .limit(1).maybeSingle();

            if (hoursSince >= slaHours) {
              // Determine severity
              const overHours = hoursSince - slaHours;
              let severity = 'minor';
              if (overHours > 72) severity = 'critical';
              else if (overHours > 24) severity = 'major';

              // Cap critical escalation: check if active critical warning exists in 30 days
              if (severity === 'critical') {
                const { data: existingCritical } = await supabase
                  .from('instructor_warnings').select('id')
                  .eq('instructor_id', instructorId).eq('warning_type', 'no_reply')
                  .eq('severity', 'critical').eq('is_active', true)
                  .gte('created_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
                  .limit(1).maybeSingle();

                if (existingCritical) {
                  // Log escalation event instead
                  await supabase.from('performance_events').insert({
                    instructor_id: instructorId, event_type: 'escalation_event',
                    reference_id: convId, reference_type: 'conversation',
                    details: { warning_type: 'no_reply', severity: 'critical', hours_overdue: Math.round(hoursSince) },
                  });
                  continue;
                }
              }

              // Deduplication
              const { data: existingWarning } = await supabase
                .from('instructor_warnings').select('id')
                .eq('instructor_id', instructorId).eq('warning_type', 'no_reply')
                .eq('reference_id', convId).eq('is_active', true).limit(1).maybeSingle();

              if (!existingWarning) {
                await supabase.from('instructor_warnings').insert({
                  instructor_id: instructorId, warning_type: 'no_reply', severity,
                  reference_id: convId, reference_type: 'conversation',
                  reason: `No reply to student message for ${Math.round(hoursSince)} hours`,
                  reason_ar: `لم يتم الرد على رسالة الطالب منذ ${Math.round(hoursSince)} ساعة`,
                });
                results.slaWarnings++;
              }
            } else if (!recentReminder) {
              // Send reminder (half SLA reached)
              await supabase.from('notifications').insert({
                user_id: instructorId, type: 'info', category: 'compliance',
                title: 'Reminder: Pending Student Message', title_ar: 'تذكير: رسالة طالب بانتظار الرد',
                message: `You have an unanswered student message for ${Math.round(hoursSince)} hours. SLA: ${slaHours}h`,
                message_ar: `لديك رسالة طالب بدون رد منذ ${Math.round(hoursSince)} ساعة. المهلة: ${slaHours} ساعة`,
                action_url: '/messages',
              });
              await supabase.from('performance_events').insert({
                instructor_id: instructorId, event_type: 'reminder_sent',
                reference_id: convId, reference_type: 'conversation',
                details: { hours_since: Math.round(hoursSince), sla_hours: slaHours },
              });
              results.slaReminders++;
            }
          }
        }
      }
    } catch (e) {
      results.errors.push(`Section 5 (Message SLA) error: ${e.message}`);
    }

    // ========================================
    // Section 6: Grading SLA Monitoring
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        const { data: pendingSubmissions } = await supabase
          .from('assignment_submissions').select(`id, assignment_id, submitted_at, assignments!inner(assigned_by, group_id, groups(instructor_id))`)
          .eq('status', 'submitted');

        if (pendingSubmissions) {
          for (const sub of pendingSubmissions as any[]) {
            if (checkCircuitBreaker()) break;

            const instructorId = sub.assignments?.groups?.instructor_id || sub.assignments?.assigned_by;
            if (!instructorId) continue;

            const slaHours = instructorSLAMap.get(instructorId) || 48;
            const submittedTime = new Date(sub.submitted_at).getTime();
            const hoursSince = (now.getTime() - submittedTime) / (1000 * 60 * 60);

            if (hoursSince < slaHours / 2) continue;

            // Prevent Reminder Spam
            const { data: recentReminder } = await supabase
              .from('performance_events').select('id')
              .eq('instructor_id', instructorId).eq('event_type', 'reminder_sent')
              .eq('reference_id', sub.id).gte('created_at', new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString())
              .limit(1).maybeSingle();

            if (hoursSince >= slaHours) {
              const overHours = hoursSince - slaHours;
              let severity = 'minor';
              if (overHours > 72) severity = 'critical';
              else if (overHours > 24) severity = 'major';

              // Cap critical
              if (severity === 'critical') {
                const { data: existingCritical } = await supabase
                  .from('instructor_warnings').select('id')
                  .eq('instructor_id', instructorId).eq('warning_type', 'late_grading')
                  .eq('severity', 'critical').eq('is_active', true)
                  .gte('created_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
                  .limit(1).maybeSingle();

                if (existingCritical) {
                  await supabase.from('performance_events').insert({
                    instructor_id: instructorId, event_type: 'escalation_event',
                    reference_id: sub.id, reference_type: 'submission',
                    details: { warning_type: 'late_grading', severity: 'critical', hours_overdue: Math.round(hoursSince) },
                  });
                  continue;
                }
              }

              // Deduplication
              const { data: existingWarning } = await supabase
                .from('instructor_warnings').select('id')
                .eq('instructor_id', instructorId).eq('warning_type', 'late_grading')
                .eq('reference_id', sub.id).eq('is_active', true).limit(1).maybeSingle();

              if (!existingWarning) {
                await supabase.from('instructor_warnings').insert({
                  instructor_id: instructorId, warning_type: 'late_grading', severity,
                  reference_id: sub.id, reference_type: 'submission',
                  reason: `Assignment submission not graded for ${Math.round(hoursSince)} hours`,
                  reason_ar: `لم يتم تقييم تسليم الواجب منذ ${Math.round(hoursSince)} ساعة`,
                });
                results.slaWarnings++;
              }
            } else if (!recentReminder) {
              await supabase.from('notifications').insert({
                user_id: instructorId, type: 'info', category: 'compliance',
                title: 'Reminder: Pending Grading', title_ar: 'تذكير: تقييم بانتظار المراجعة',
                message: `You have an ungraded submission for ${Math.round(hoursSince)} hours. SLA: ${slaHours}h`,
                message_ar: `لديك تسليم بدون تقييم منذ ${Math.round(hoursSince)} ساعة. المهلة: ${slaHours} ساعة`,
                action_url: '/assignments',
              });
              await supabase.from('performance_events').insert({
                instructor_id: instructorId, event_type: 'reminder_sent',
                reference_id: sub.id, reference_type: 'submission',
                details: { hours_since: Math.round(hoursSince), sla_hours: slaHours },
              });
              results.slaReminders++;
            }
          }
        }
      }
    } catch (e) {
      results.errors.push(`Section 6 (Grading SLA) error: ${e.message}`);
    }

    // ========================================
    // MODULE B: Metrics Engine (Section 7)
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        const { data: instructorRoles } = await supabase
          .from('user_roles').select('user_id').eq('role', 'instructor');

        for (const role of (instructorRoles || [])) {
          if (checkCircuitBreaker()) break;
          const instructorId = role.user_id;

          // Count warnings this month (rolling 30 days)
          const { count: warningCount } = await supabase
            .from('instructor_warnings').select('*', { count: 'exact', head: true })
            .eq('instructor_id', instructorId).eq('is_active', true)
            .gte('created_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());

          // Count reminders this month
          const { count: reminderCount } = await supabase
            .from('performance_events').select('*', { count: 'exact', head: true })
            .eq('instructor_id', instructorId).eq('event_type', 'reminder_sent')
            .gte('created_at', currentMonth);

          const totalStudents = instructorWorkloadMap.get(instructorId) || 0;

          // Count groups
          const { count: groupCount } = await supabase
            .from('groups').select('*', { count: 'exact', head: true })
            .eq('instructor_id', instructorId).eq('is_active', true);

          // Avg reply time (simplified: count messages replied within the month)
          // For now, use 0 as placeholder - will be refined with actual message analysis
          const avgReply = 0;
          const avgGrading = 0;

          // Compute quality score
          const { data: scoreResult } = await supabase.rpc('compute_quality_score', {
            p_warnings: warningCount || 0,
            p_reminders: reminderCount || 0,
            p_avg_reply: avgReply,
            p_avg_grading: avgGrading,
            p_total_students: totalStudents,
          });

          let qualityScore = scoreResult || 100;

          // Consistency Bonus: +5 if 0 warnings for 3 consecutive months
          const threeMonthsAgo = new Date(now);
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          const { count: recentWarnings } = await supabase
            .from('instructor_warnings').select('*', { count: 'exact', head: true })
            .eq('instructor_id', instructorId).eq('is_active', true)
            .gte('created_at', threeMonthsAgo.toISOString());

          if ((recentWarnings || 0) === 0) {
            qualityScore = Math.min(100, qualityScore + 5);
          }

          // UPSERT metrics
          await supabase.from('instructor_performance_metrics').upsert({
            instructor_id: instructorId,
            month: currentMonth,
            avg_reply_time_hours: avgReply,
            avg_grading_time_hours: avgGrading,
            total_warnings: warningCount || 0,
            total_reminders: reminderCount || 0,
            total_students: totalStudents,
            total_groups: groupCount || 0,
            quality_score: qualityScore,
            updated_at: now.toISOString(),
          }, { onConflict: 'instructor_id,month' });

          results.metricsUpdated++;
        }
      }
    } catch (e) {
      results.errors.push(`Section 7 (Metrics) error: ${e.message}`);
    }

    // ========================================
    // MODULE C: Incentive Engine (Section 8)
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        // Only run on last day of month
        // Use Cairo day to determine last day of month
        const tomorrowCairo = getCairoDatePlusDays(1);
        const isLastDayOfMonth = tomorrowCairo.endsWith('-01');

        if (isLastDayOfMonth) {
          const { data: instructorRoles } = await supabase
            .from('user_roles').select('user_id').eq('role', 'instructor');

          for (const role of (instructorRoles || [])) {
            if (checkCircuitBreaker()) break;
            const instructorId = role.user_id;

            // Check if 0 no_reply and 0 late_grading this month
            const { count: noReplyCount } = await supabase
              .from('instructor_warnings').select('*', { count: 'exact', head: true })
              .eq('instructor_id', instructorId).eq('is_active', true)
              .in('warning_type', ['no_reply', 'late_grading'])
              .gte('created_at', currentMonth);

            if ((noReplyCount || 0) === 0) {
              // Check no existing recommendation this month
              const { data: existingRec } = await supabase
                .from('performance_events').select('id')
                .eq('instructor_id', instructorId).eq('event_type', 'bonus_recommended')
                .gte('created_at', currentMonth).limit(1).maybeSingle();

              if (!existingRec) {
                // Get current metrics
                const { data: metrics } = await supabase
                  .from('instructor_performance_metrics').select('quality_score, total_students, total_groups')
                  .eq('instructor_id', instructorId).eq('month', currentMonth).maybeSingle();

                // Get instructor name
                const { data: profile } = await supabase
                  .from('profiles').select('full_name, full_name_ar').eq('user_id', instructorId).maybeSingle();

                await supabase.from('performance_events').insert({
                  instructor_id: instructorId, event_type: 'bonus_recommended',
                  details: {
                    month: currentMonth,
                    quality_score: metrics?.quality_score || 100,
                    total_students: metrics?.total_students || 0,
                    instructor_name: profile?.full_name,
                    instructor_name_ar: profile?.full_name_ar,
                  },
                });

                // Notify admins
                const { data: admins } = await supabase
                  .from('user_roles').select('user_id').eq('role', 'admin');

                for (const admin of (admins || [])) {
                  await supabase.from('notifications').insert({
                    user_id: admin.user_id, type: 'info', category: 'admin',
                    title: 'Bonus Recommendation', title_ar: 'توصية مكافأة',
                    message: `${profile?.full_name || 'Instructor'} achieved 0 SLA violations this month. Consider a bonus.`,
                    message_ar: `${profile?.full_name_ar || 'المدرب'} حقق 0 مخالفات SLA هذا الشهر. يُنصح بمكافأة.`,
                    action_url: '/instructor-performance',
                  });
                }

                results.bonusRecommendations++;
              }
            }
          }
        }
      }
    } catch (e) {
      results.errors.push(`Section 8 (Incentive) error: ${e.message}`);
    }

    // ========================================
    // MODULE D-2: Exam SLA Timeout Check (Section 9a)
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        const { data: slaResult, error: slaError } = await supabase.rpc('check_exam_sla_timeouts');
        if (slaError) {
          results.errors.push(`Section 9a (Exam SLA) error: ${slaError.message}`);
        } else {
          console.log(`[Compliance Monitor] Exam SLA check: ${JSON.stringify(slaResult)}`);
        }
      }
    } catch (e) {
      results.errors.push(`Section 9a (Exam SLA) error: ${e.message}`);
    }

    // ========================================
    // MODULE D: System Health (Section 9)
    // ========================================
    try {
      const executionTimeMs = Date.now() - startTime;

      await supabase.from('system_health_metrics').upsert({
        date: todayStr,
        total_reminders: results.slaReminders,
        total_warnings: results.instructorWarnings + results.slaWarnings,
        total_deductions: 0, // Tracked by process-deductions
        avg_execution_time_ms: executionTimeMs,
        errors_count: results.errors.length,
      }, { onConflict: 'date' });
    } catch (e) {
      results.errors.push(`Section 9 (Health) error: ${e.message}`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Compliance Monitor] Complete in ${totalTime}ms. Warnings: ${results.instructorWarnings + results.slaWarnings}, Reminders: ${results.slaReminders}, Metrics: ${results.metricsUpdated}, Errors: ${results.errors.length}`);

    return new Response(
      JSON.stringify({ success: true, timestamp: now.toISOString(), execution_ms: totalTime, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error('Compliance monitor error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
