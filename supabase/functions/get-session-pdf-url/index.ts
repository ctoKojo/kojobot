import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SIGNED_URL_EXPIRY = 3600; // 60 minutes

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth check
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

    // Get session data for authorization
    const { data: session, error: sessionError } = await serviceClient
      .from("curriculum_sessions")
      .select("id, age_group_id, level_id")
      .eq("id", sessionId)
      .eq("is_active", true)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get PDF path from assets table
    const { data: asset } = await serviceClient
      .from("curriculum_session_assets")
      .select("student_pdf_path")
      .eq("session_id", sessionId)
      .single();

    if (!asset?.student_pdf_path) {
      return new Response(JSON.stringify({ error: "No PDF found for this session" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin (admins can always access)
    const { data: adminRole } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      // Not admin - verify student is enrolled in a group with matching curriculum
      const { data: enrollment } = await serviceClient
        .from("group_students")
        .select("group_id, groups!inner(age_group_id, level_id)")
        .eq("student_id", user.id)
        .eq("is_active", true);

      const hasAccess = enrollment?.some((e: any) => {
        const g = e.groups;
        return g?.age_group_id === session.age_group_id && g?.level_id === session.level_id;
      });

      if (!hasAccess) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Generate signed URL
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
