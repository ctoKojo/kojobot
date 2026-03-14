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

    // List all groups
    const { data: groups, error } = await supabase
      .from("groups")
      .select("id, name, schedule_day, is_active")
      .order("name");

    // List all cancelled sessions
    const { data: cancelled } = await supabase
      .from("sessions")
      .select("id, group_id, session_number, status, is_makeup")
      .eq("status", "cancelled");

    return new Response(JSON.stringify({ groups, cancelled, error: error?.message }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
