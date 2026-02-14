import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current timestamp in UTC
    const now = new Date().toISOString();
    const today = now.split("T")[0];
    const currentTime = now.split("T")[1].substring(0, 8);

    // Find sessions that are scheduled and their date+time+duration has passed
    const { data: sessions, error: fetchError } = await supabase
      .from("sessions")
      .select("id, session_date, session_time, duration_minutes, group_id")
      .eq("status", "scheduled")
      .lte("session_date", today);

    if (fetchError) throw fetchError;

    let completedCount = 0;
    const completedIds: string[] = [];

    for (const session of sessions || []) {
      // Calculate session end time
      const sessionStart = new Date(
        `${session.session_date}T${session.session_time}`
      );
      const sessionEnd = new Date(
        sessionStart.getTime() + session.duration_minutes * 60 * 1000
      );

      if (new Date() >= sessionEnd) {
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
        timestamp: now,
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
