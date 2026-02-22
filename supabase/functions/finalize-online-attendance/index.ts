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
    // Authenticate: only service role or matching cron secret
    const authHeader = req.headers.get("Authorization");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");

    const token = authHeader?.replace("Bearer ", "") ?? "";
    const isServiceRole = token === supabaseKey;
    const isCronAuth = cronSecret && token === cronSecret;

    if (!isServiceRole && !isCronAuth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const cairo = getCairoNow();

    // 1. Find completed sessions in online groups that have online_attendance_logs
    //    but no attendance records yet
    const { data: candidates, error: fetchErr } = await supabase
      .from("sessions")
      .select(`
        id, session_date, session_time, duration_minutes, group_id,
        groups!inner(id, attendance_mode, duration_minutes)
      `)
      .eq("status", "completed")
      .eq("groups.attendance_mode", "online");

    if (fetchErr) throw fetchErr;

    let processedCount = 0;

    for (const session of candidates || []) {
      // Check if attendance already exists for this session (idempotent)
      const { count: existingAttendance } = await supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id);

      if (existingAttendance && existingAttendance > 0) {
        // Already finalized, skip
        continue;
      }

      // Check if there are any online_attendance_logs for this session
      const { data: logs } = await supabase
        .from("online_attendance_logs")
        .select("student_id, first_joined_at, last_seen_at, attendance_status_initial, status")
        .eq("session_id", session.id);

      if (!logs || logs.length === 0) {
        // No logs at all — skip (will be handled when there are logs)
        continue;
      }

      // Get all active students in the group
      const { data: groupStudents } = await supabase
        .from("group_students")
        .select("student_id")
        .eq("group_id", session.group_id)
        .eq("is_active", true);

      if (!groupStudents || groupStudents.length === 0) continue;

      const durationMinutes = session.duration_minutes || 60;
      const minMinutes = Math.min(durationMinutes * 0.6, 40);

      // Build attendance records
      const records: Array<{ student_id: string; status: string }> = [];

      for (const gs of groupStudents) {
        const log = logs.find((l) => l.student_id === gs.student_id);

        if (!log) {
          // No log = absent
          records.push({ student_id: gs.student_id, status: "absent" });
          continue;
        }

        // Calculate total_minutes from timestamps (server-side)
        const firstJoined = new Date(log.first_joined_at).getTime();
        const lastSeen = new Date(log.last_seen_at).getTime();
        const totalMinutes = Math.min(
          (lastSeen - firstJoined) / 60000,
          durationMinutes
        );

        if (totalMinutes < minMinutes) {
          records.push({ student_id: gs.student_id, status: "absent" });
        } else {
          // Determine present/late based on first_joined_at relative to session start
          const sessionStartStr = `${session.session_date}T${session.session_time}`;
          const sessionStart = new Date(sessionStartStr + "+02:00").getTime(); // Cairo is UTC+2 (approximate, DST handled by server)
          const joinedMinutesAfterStart = (firstJoined - sessionStart) / 60000;

          if (joinedMinutesAfterStart <= 15) {
            records.push({ student_id: gs.student_id, status: "present" });
          } else if (joinedMinutesAfterStart <= 20) {
            records.push({ student_id: gs.student_id, status: "late" });
          } else {
            records.push({ student_id: gs.student_id, status: "absent" });
          }
        }
      }

      // Save attendance via RPC
      if (records.length > 0) {
        const { error: saveErr } = await supabase.rpc("save_attendance", {
          p_session_id: session.id,
          p_group_id: session.group_id,
          p_records: records,
        });

        if (saveErr) {
          console.error(`Error saving attendance for session ${session.id}:`, saveErr);
          continue;
        }
      }

      // Update online_attendance_logs status
      // Mark as 'completed' or 'dropped' based on last_seen_at
      const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

      await supabase
        .from("online_attendance_logs")
        .update({ status: "completed" })
        .eq("session_id", session.id)
        .gte("last_seen_at", threeMinAgo);

      await supabase
        .from("online_attendance_logs")
        .update({ status: "dropped" })
        .eq("session_id", session.id)
        .eq("status", "active")
        .lt("last_seen_at", threeMinAgo);

      processedCount++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
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
