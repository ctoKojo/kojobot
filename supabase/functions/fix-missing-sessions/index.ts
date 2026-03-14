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

    const fixes: any[] = [];

    // Find all cancelled sessions that don't have a next session
    const { data: cancelled, error: cErr } = await supabase
      .from("sessions")
      .select("id, group_id, session_number, session_date, session_time, level_id, is_makeup, status")
      .eq("status", "cancelled")
      .eq("is_makeup", false);

    if (cErr) throw cErr;

    for (const s of cancelled || []) {
      const nextNum = s.session_number + 1;

      // Check if next session exists (non-cancelled, non-makeup)
      const { data: existing } = await supabase
        .from("sessions")
        .select("id")
        .eq("group_id", s.group_id)
        .eq("session_number", nextNum)
        .eq("is_makeup", false)
        .neq("status", "cancelled")
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Get group info
      const { data: group } = await supabase
        .from("groups")
        .select("schedule_day, schedule_time, duration_minutes, level_id, is_active, owed_sessions_count")
        .eq("id", s.group_id)
        .single();

      if (!group || !group.is_active) continue;

      // Calculate next date
      const dayMap: Record<string, number> = {
        Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
        Thursday: 4, Friday: 5, Saturday: 6,
      };

      // Find last regular session date
      const { data: lastSessions } = await supabase
        .from("sessions")
        .select("session_date")
        .eq("group_id", s.group_id)
        .eq("is_makeup", false)
        .not("session_number", "is", null)
        .in("status", ["scheduled", "completed", "cancelled"])
        .order("session_date", { ascending: false })
        .limit(1);

      const lastDate = lastSessions?.[0]?.session_date || s.session_date;
      const lastDateObj = new Date(lastDate + "T00:00:00Z");
      const targetDow = dayMap[group.schedule_day] ?? lastDateObj.getUTCDay();
      const currentDow = lastDateObj.getUTCDay();
      let daysAhead = (targetDow - currentDow + 7) % 7;
      if (daysAhead === 0) daysAhead = 7;

      const nextDate = new Date(lastDateObj);
      nextDate.setUTCDate(nextDate.getUTCDate() + daysAhead);
      const nextDateStr = nextDate.toISOString().split("T")[0];

      // Insert the missing session
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
        })
        .select("id, session_number, session_date")
        .single();

      if (iErr) {
        fixes.push({ group_id: s.group_id, error: iErr.message });
        continue;
      }

      // Update owed_sessions_count
      await supabase
        .from("groups")
        .update({ owed_sessions_count: (group.owed_sessions_count || 0) + 1 })
        .eq("id", s.group_id);

      fixes.push({
        group_id: s.group_id,
        cancelled_session: s.session_number,
        new_session: inserted,
      });
    }

    return new Response(JSON.stringify({ fixes, count: fixes.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
