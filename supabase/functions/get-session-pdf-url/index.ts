import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SIGNED_URL_EXPIRY = 3600;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Session + Group in one query (JOIN via foreign key)
    const { data: session, error: sessionError } = await serviceClient
      .from("sessions")
      .select("id, group_id, session_number, groups!inner(id, age_group_id, level_id)")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!session.session_number) {
      return new Response(JSON.stringify({ error: "Session has no session number" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const group = session.groups as any;
    if (!group?.age_group_id || !group?.level_id) {
      return new Response(JSON.stringify({ error: "Group missing curriculum info" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parallel: curriculum session lookup + admin role check
    const [currResult, adminResult] = await Promise.all([
      serviceClient
        .from("curriculum_sessions")
        .select("id, age_group_id, level_id")
        .eq("age_group_id", group.age_group_id)
        .eq("level_id", group.level_id)
        .eq("session_number", session.session_number)
        .eq("is_published", true)
        .eq("is_active", true)
        .single(),
      serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle(),
    ]);

    const currSession = currResult.data;
    if (currResult.error || !currSession) {
      return new Response(JSON.stringify({ error: "No published curriculum session found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get PDF path from assets table
    const { data: asset } = await serviceClient
      .from("curriculum_session_assets")
      .select("student_pdf_path")
      .eq("session_id", currSession.id)
      .single();

    if (!asset?.student_pdf_path) {
      return new Response(JSON.stringify({ error: "No PDF found for this session" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Authorization (admin result already fetched)
    if (!adminResult.data) {
      const { data: enrollment } = await serviceClient
        .from("group_students")
        .select("group_id, groups!inner(age_group_id, level_id)")
        .eq("student_id", user.id)
        .eq("is_active", true);

      const hasAccess = enrollment?.some((e: any) => {
        const g = e.groups;
        return g?.age_group_id === currSession.age_group_id && g?.level_id === currSession.level_id;
      });

      if (!hasAccess) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 5. Generate signed URL
    const { data: signedUrl, error: signError } = await serviceClient.storage
      .from("session-slides-pdf")
      .createSignedUrl(asset.student_pdf_path, SIGNED_URL_EXPIRY);

    if (signError || !signedUrl) {
      return new Response(JSON.stringify({ error: "Failed to generate download URL" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: signedUrl.signedUrl, expiresIn: SIGNED_URL_EXPIRY }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-session-pdf-url error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
