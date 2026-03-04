import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limit: 3 requests per IP per hour
    const clientIP = getClientIP(req);
    const rateResult = checkRateLimit(`sub:${clientIP}`, {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateResult.allowed) {
      return rateLimitResponse(rateResult, corsHeaders);
    }

    const body = await req.json();
    const { name, phone, email, plan_id, attendance_mode, honeypot } = body;

    // Honeypot check - silently reject bots
    if (honeypot) {
      return new Response(
        JSON.stringify({ success: true, request_id: crypto.randomUUID() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-side validation
    const errors: string[] = [];

    if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
      errors.push("Name must be 2-100 characters");
    }

    if (!phone || typeof phone !== "string") {
      errors.push("Phone is required");
    } else {
      const phoneClean = phone.replace(/[\s\-\(\)]/g, "");
      if (!/^(\+?\d{10,15})$/.test(phoneClean)) {
        errors.push("Invalid phone format");
      }
    }

    if (!email || typeof email !== "string") {
      errors.push("Email is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.push("Invalid email format");
    } else if (email.trim().length > 255) {
      errors.push("Email too long");
    }

    if (!plan_id || typeof plan_id !== "string") {
      errors.push("Plan is required");
    }

    if (attendance_mode && !["online", "offline"].includes(attendance_mode)) {
      errors.push("Invalid attendance mode");
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: errors }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert using service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify plan exists
    const { data: plan } = await supabase
      .from("landing_plans")
      .select("id")
      .eq("id", plan_id)
      .single();

    if (!plan) {
      return new Response(
        JSON.stringify({ error: "Invalid plan" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data, error } = await supabase
      .from("subscription_requests")
      .insert({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        plan_id,
        attendance_mode: attendance_mode || "offline",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to submit request" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, request_id: data.id }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
