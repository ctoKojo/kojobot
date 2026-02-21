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
    // Authenticate: only service role or matching cron secret allowed
    const authHeader = req.headers.get("Authorization");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");

    const token = authHeader?.replace("Bearer ", "") ?? "";
    const isServiceRole = token === supabaseKey;
    const isCronAuth = cronSecret && token === cronSecret;

    if (!isServiceRole && !isCronAuth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use Cairo time for "today" comparison
    const cairo = getCairoNow();
    const today = cairo.today;

    // Find sessions that are scheduled and their date has passed or is today
    const { data: sessions, error: fetchError } = await supabase
      .from("sessions")
      .select("id, session_date, session_time, duration_minutes, group_id")
      .eq("status", "scheduled")
      .lte("session_date", today);

    if (fetchError) throw fetchError;

    let completedCount = 0;
    const completedIds: string[] = [];

    for (const session of sessions || []) {
      // Use Cairo-aware comparison for session end time
      if (isCairoTimePastSessionEnd(
        session.session_date,
        session.session_time,
        session.duration_minutes
      )) {
        completedIds.push(session.id);
        completedCount++;
      }
    }

    // Batch update
    if (completedIds.length > 0) {
      const { error: updateError } = await supabase
        .from("sessions")
        .update({ status: "completed" })
        .in("id", completedIds);

      if (updateError) throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        completed: completedCount,
        timestamp: new Date().toISOString(),
        cairoTime: `${cairo.today} ${cairo.timeHHMMSS}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
