import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const log: any[] = [];

    // Find all cancelled non-makeup sessions
    const { data: cancelled, error: cErr } = await supabase
      .from("sessions")
      .select("id, group_id, session_number, session_date, session_time, level_id, is_makeup")
      .eq("status", "cancelled")
      .or("is_makeup.eq.false,is_makeup.is.null");

    if (cErr) throw new Error("fetch cancelled: " + cErr.message);

    log.push({ step: "found_cancelled", count: cancelled?.length, ids: cancelled?.map(s => ({ id: s.id, num: s.session_number, group: s.group_id })) });

    for (const s of cancelled || []) {
      if (!s.session_number) { log.push({ skip: s.id, reason: "no session_number" }); continue; }
      const nextNum = s.session_number + 1;

      // Check ALL sessions with nextNum for this group
      const { data: allNext, error: anErr } = await supabase
        .from("sessions")
        .select("id, session_number, status, is_makeup")
        .eq("group_id", s.group_id)
        .eq("session_number", nextNum);

      log.push({ step: "check_next", group: s.group_id, nextNum, allNext, error: anErr?.message });

      // Filter: only non-makeup, non-cancelled
      const validNext = (allNext || []).filter(x => !x.is_makeup && x.status !== 'cancelled');

      if (validNext.length > 0) {
        log.push({ skip: s.id, reason: "next_exists", validNext });
        continue;
      }

      // Get group info
      const { data: group } = await supabase
        .from("groups")
        .select("schedule_day, schedule_time, duration_minutes, level_id, is_active, owed_sessions_count")
        .eq("id", s.group_id)
        .single();

      if (!group) { log.push({ skip: s.id, reason: "group_not_found" }); continue; }
      if (!group.is_active) { log.push({ skip: s.id, reason: "group_inactive" }); continue; }

      // Calculate next date
      const dayMap: Record<string, number> = {
        Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
        Thursday: 4, Friday: 5, Saturday: 6,
      };

      const lastDateObj = new Date(s.session_date + "T00:00:00Z");
      const targetDow = dayMap[group.schedule_day] ?? lastDateObj.getUTCDay();
      const currentDow = lastDateObj.getUTCDay();
      let daysAhead = (targetDow - currentDow + 7) % 7;
      if (daysAhead === 0) daysAhead = 7;

      const nextDate = new Date(lastDateObj);
      nextDate.setUTCDate(nextDate.getUTCDate() + daysAhead);
      const nextDateStr = nextDate.toISOString().split("T")[0];

      log.push({ step: "inserting", group: s.group_id, nextNum, nextDateStr });

      const { data: inserted, error: iErr } = await supabase
        .from("sessions")
        .insert({
          group_id: s.group_id,
          session_date: nextDateStr,
          session_time: group.schedule_time,
          duration_minutes: group.duration_minutes,
          status: "scheduled",
          session_number: nextNum,
          level_id: group.level_id,
          is_makeup: false,
        })
        .select("id, session_number, session_date")
        .single();

      if (iErr) {
        log.push({ step: "insert_error", group: s.group_id, error: iErr.message, code: iErr.code });
        continue;
      }

      await supabase
        .from("groups")
        .update({ owed_sessions_count: (group.owed_sessions_count || 0) + 1 })
        .eq("id", s.group_id);

      log.push({ step: "fixed", group: s.group_id, new_session: inserted });
    }

    return new Response(JSON.stringify({ log }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
