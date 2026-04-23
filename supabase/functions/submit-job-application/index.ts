import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FormField {
  key: string;
  type: string;
  label_en?: string;
  label_ar?: string;
  required?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIP = getClientIP(req);
    const rateResult = checkRateLimit(`job-app:${clientIP}`, {
      maxRequests: 5,
      windowMs: 60 * 1000,
    });
    if (!rateResult.allowed) {
      return rateLimitResponse(rateResult, corsHeaders);
    }

    const body = await req.json();
    const {
      job_id,
      applicant_name,
      applicant_email,
      applicant_phone,
      cv_url,
      answers,
      invite_token,
      honeypot,
    } = body;

    // Honeypot
    if (honeypot) {
      return new Response(
        JSON.stringify({ success: true, application_id: crypto.randomUUID() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Basic validation
    const errors: string[] = [];
    if (!job_id || typeof job_id !== "string") errors.push("Job ID is required");
    if (!applicant_name || typeof applicant_name !== "string" || applicant_name.trim().length < 2 || applicant_name.trim().length > 100) {
      errors.push("Name must be 2-100 characters");
    }
    if (!applicant_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(applicant_email).trim())) {
      errors.push("Valid email is required");
    }
    if (applicant_phone && !/^(\+?\d{8,15})$/.test(String(applicant_phone).replace(/[\s\-\(\)]/g, ""))) {
      errors.push("Invalid phone format");
    }

    if (errors.length > 0) {
      return new Response(JSON.stringify({ error: "Validation failed", details: errors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify job exists, is published, not expired
    const { data: job } = await supabase
      .from("jobs")
      .select("id, title_en, title_ar, status, deadline_at, form_fields")
      .eq("id", job_id)
      .maybeSingle();

    if (!job || job.status !== "published") {
      return new Response(JSON.stringify({ error: "Job not available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (job.deadline_at && new Date(job.deadline_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Application deadline has passed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate required dynamic fields
    const fields: FormField[] = Array.isArray(job.form_fields) ? job.form_fields : [];
    const safeAnswers: Record<string, unknown> = (answers && typeof answers === "object") ? answers : {};
    for (const f of fields) {
      if (f.required && f.key !== "full_name" && f.key !== "email" && f.key !== "phone" && f.key !== "cv") {
        const v = safeAnswers[f.key];
        if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
          return new Response(
            JSON.stringify({ error: `Field "${f.label_en || f.key}" is required` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Verify invite token if provided
    let inviteId: string | null = null;
    if (invite_token && typeof invite_token === "string") {
      const { data: invite } = await supabase
        .from("job_invites")
        .select("id, job_id, expires_at, status")
        .eq("token", invite_token)
        .maybeSingle();
      if (invite && invite.job_id === job_id && new Date(invite.expires_at) >= new Date() && invite.status !== "applied") {
        inviteId = invite.id;
      }
    }

    const normalizedEmail = applicant_email.trim().toLowerCase();

    // Pre-check for duplicate (friendly error message)
    const { data: existing } = await supabase
      .from("job_applications")
      .select("id, tracking_code, status")
      .eq("job_id", job_id)
      .ilike("applicant_email", normalizedEmail)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          error: "duplicate_application",
          message: "You have already applied for this job",
          message_ar: "لقد قدمت بالفعل على هذه الوظيفة",
          tracking_code: existing.tracking_code,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert application
    const { data: application, error: insertError } = await supabase
      .from("job_applications")
      .insert({
        job_id,
        applicant_name: applicant_name.trim(),
        applicant_email: normalizedEmail,
        applicant_phone: applicant_phone?.trim() || null,
        cv_url: cv_url || null,
        answers: safeAnswers,
        source: inviteId ? "invite" : "direct",
        invite_id: inviteId,
        ip_address: clientIP,
        user_agent: req.headers.get("user-agent")?.substring(0, 500) || null,
      })
      .select("id, tracking_code")
      .single();

    if (insertError) {
      // Race-condition: unique index caught duplicate after pre-check
      if (insertError.code === "23505") {
        const { data: dup } = await supabase
          .from("job_applications")
          .select("tracking_code")
          .eq("job_id", job_id)
          .ilike("applicant_email", normalizedEmail)
          .maybeSingle();
        return new Response(
          JSON.stringify({
            error: "duplicate_application",
            message: "You have already applied for this job",
            message_ar: "لقد قدمت بالفعل على هذه الوظيفة",
            tracking_code: dup?.tracking_code,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to submit application" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fire notifications (non-blocking)
    const appUrl = req.headers.get("origin") || "https://kojobot.com";
    const applicationUrl = `${appUrl}/admin/jobs/${job_id}/applications/${application.id}`;

    // Notify admins via Telegram
    supabase.functions.invoke("send-notification", {
      body: {
        event_key: "admin-new-job-application",
        audience: "admin",
        variables: {
          applicant_name: applicant_name.trim(),
          applicant_email: applicant_email.trim().toLowerCase(),
          job_title: job.title_en,
          job_title_ar: job.title_ar,
          application_url: applicationUrl,
        },
        idempotency_key: `job-app-${application.id}`,
      },
    }).catch((e) => console.error("admin notify failed:", e));

    // Send confirmation email to applicant (with tracking code)
    const trackingUrl = `${appUrl}/application-status?code=${application.tracking_code}`;
    supabase.functions.invoke("send-email", {
      body: {
        to: normalizedEmail,
        templateName: "job-application-received",
        audience: "staff",
        idempotencyKey: `job-app-received-${application.id}`,
        templateData: {
          applicant_name: applicant_name.trim(),
          job_title: job.title_en,
          job_title_ar: job.title_ar,
          application_id: application.id,
          tracking_code: application.tracking_code,
          tracking_url: trackingUrl,
          app_url: appUrl,
        },
      },
    }).catch((e) => console.error("applicant email failed:", e));

    return new Response(
      JSON.stringify({
        success: true,
        application_id: application.id,
        tracking_code: application.tracking_code,
        tracking_url: trackingUrl,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
