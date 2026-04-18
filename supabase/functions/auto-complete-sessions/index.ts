import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isCairoTimePastSessionEnd, getCairoNow } from "../_shared/cairoTime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");

    const token = authHeader?.replace("Bearer ", "") ?? "";
    const isServiceRole = token === supabaseKey;
    const isCronEnvAuth = !!cronSecret && token === cronSecret;

    let isVaultCronAuth = false;
    if (!isServiceRole && !isCronEnvAuth && token) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const tmpClient = createClient(supabaseUrl, supabaseKey);
        const { data } = await tmpClient.rpc("verify_cron_token", { p_token: token });
        isVaultCronAuth = data === true;
      } catch (_) {
        isVaultCronAuth = false;
      }
    }

    if (!isServiceRole && !isCronEnvAuth && !isVaultCronAuth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const cairo = getCairoNow();
    const today = cairo.today;

    // Find sessions that are scheduled and their date has passed or is today
    // Fetch sessions with group status to skip frozen groups
    const { data: sessions, error: fetchError } = await supabase
      .from("sessions")
      .select("id, session_date, session_time, duration_minutes, group_id, groups!inner(status)")
      .eq("status", "scheduled")
      .lte("session_date", today)
      .neq("groups.status", "frozen");

    if (fetchError) throw fetchError;

    let completedCount = 0;
    let warningCount = 0;
    let skippedWarnings = 0;
    const completedIds: string[] = [];

    for (const session of sessions || []) {
      // Check if grace period (session end + 60 min) has passed
      const gracePeriodPast = isCairoTimePastSessionEnd(
        session.session_date,
        session.session_time,
        session.duration_minutes + 60 // Add 60 min grace period
      );

      if (!gracePeriodPast) continue;

      // Grace period expired - check if actions were completed
      const [attendanceRes, quizRes, assignmentRes] = await Promise.all([
        supabase.from("attendance").select("id").eq("session_id", session.id).limit(1),
        supabase.from("quiz_assignments").select("id").eq("session_id", session.id).eq("is_active", true).limit(1),
        supabase.from("assignments").select("id").eq("session_id", session.id).eq("is_active", true).limit(1),
      ]);

      const hasAttendance = (attendanceRes.data?.length || 0) > 0;
      const hasQuiz = (quizRes.data?.length || 0) > 0;
      const hasAssignment = (assignmentRes.data?.length || 0) > 0;

      // Get instructor for this session's group
      const { data: groupData } = await supabase
        .from("groups")
        .select("instructor_id, name, name_ar")
        .eq("id", session.group_id)
        .single();

      if (groupData?.instructor_id) {
        // Idempotency: check if warnings already exist for this session
        const { data: existingWarnings } = await supabase
          .from("instructor_warnings")
          .select("warning_type")
          .eq("session_id", session.id)
          .eq("instructor_id", groupData.instructor_id);

        const existingTypes = new Set((existingWarnings || []).map(w => w.warning_type));

        // Issue separate warnings for each missing action (skip if already exists)
        const warningsToInsert = [];

        if (!hasAttendance && !existingTypes.has("no_attendance")) {
          warningsToInsert.push({
            instructor_id: groupData.instructor_id,
            warning_type: "no_attendance",
            reason: `Failed to record attendance within grace period for session on ${session.session_date} (Group: ${groupData.name})`,
            reason_ar: `لم يسجل الحضور خلال فترة السماح للسيشن بتاريخ ${session.session_date} (مجموعة: ${groupData.name_ar})`,
            severity: "minor",
            session_id: session.id,
            reference_type: "session",
            reference_id: session.id,
          });
        }

        if (!hasQuiz && !existingTypes.has("no_quiz")) {
          warningsToInsert.push({
            instructor_id: groupData.instructor_id,
            warning_type: "no_quiz",
            reason: `Failed to assign quiz within grace period for session on ${session.session_date} (Group: ${groupData.name})`,
            reason_ar: `لم يعين كويز خلال فترة السماح للسيشن بتاريخ ${session.session_date} (مجموعة: ${groupData.name_ar})`,
            severity: "minor",
            session_id: session.id,
            reference_type: "session",
            reference_id: session.id,
          });
        }

        if (!hasAssignment && !existingTypes.has("no_assignment")) {
          warningsToInsert.push({
            instructor_id: groupData.instructor_id,
            warning_type: "no_assignment",
            reason: `Failed to assign homework within grace period for session on ${session.session_date} (Group: ${groupData.name})`,
            reason_ar: `لم يعين واجب خلال فترة السماح للسيشن بتاريخ ${session.session_date} (مجموعة: ${groupData.name_ar})`,
            severity: "minor",
            session_id: session.id,
            reference_type: "session",
            reference_id: session.id,
          });
        }

        const skipped = (existingWarnings?.length || 0);
        if (skipped > 0) skippedWarnings += skipped;

        if (warningsToInsert.length > 0) {
          await supabase.from("instructor_warnings").insert(warningsToInsert);

          // Record instructor as absent
          await supabase.from("session_staff_attendance").upsert({
            session_id: session.id,
            staff_id: groupData.instructor_id,
            status: "absent",
            actual_hours: 0,
          }, { onConflict: "session_id,staff_id" });

          warningCount += warningsToInsert.length;
        }
      }

      // Mark session as completed regardless
      completedIds.push(session.id);
      completedCount++;
    }

    // Sequential update — one at a time to ensure triggers process consistent snapshots
    for (const id of completedIds) {
      const { error: updateError } = await supabase
        .from("sessions")
        .update({ status: "completed" })
        .eq("id", id);

      if (updateError) {
        console.error(`Failed to complete session ${id}:`, updateError.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        completed: completedCount,
        warnings_issued: warningCount,
        skipped_duplicate_warnings: skippedWarnings,
        timestamp: new Date().toISOString(),
        cairoTime: `${cairo.today} ${cairo.timeHHMMSS}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
