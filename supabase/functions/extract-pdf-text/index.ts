import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PDF_TEXT_LENGTH = 20000;
const EXTRACT_RATE_LIMIT = 10;

function cleanSensitiveData(text: string): string {
  // Remove emails
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]");
  // Remove phone numbers (various formats)
  text = text.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, "[PHONE]");
  return text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

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

    // Verify user is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit
    const clientIP = getClientIP(req);
    const rl = checkRateLimit(`extract-pdf:${user.id}`, { maxRequests: EXTRACT_RATE_LIMIT, windowMs: 3600000 });
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    // Get session PDF path from assets table
    const { data: asset, error: assetError } = await serviceClient
      .from("curriculum_session_assets")
      .select("id, student_pdf_path")
      .eq("session_id", sessionId)
      .single();

    console.log("asset lookup:", { sessionId, asset, assetError: assetError?.message });

    if (assetError || !asset?.student_pdf_path) {
      return new Response(JSON.stringify({ error: "No PDF found for this session", detail: assetError?.message || "student_pdf_path is null" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from("session-slides-pdf")
      .download(asset.student_pdf_path);

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download PDF" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert to base64 for Gemini (chunked to avoid memory limit)
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const CHUNK_SIZE = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.subarray(i, i + CHUNK_SIZE);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);

    // Use Gemini to extract text from PDF
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a text extraction assistant. Extract ALL text content from the provided PDF document. Return ONLY the extracted text, nothing else. Preserve the original language (Arabic/English). Do not add any commentary or formatting.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text from this PDF document:",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI extraction error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "Failed to extract text from PDF" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let extractedText = aiData.choices?.[0]?.message?.content || "";

    // Clean sensitive data
    extractedText = cleanSensitiveData(extractedText);

    // Truncate to max length
    if (extractedText.length > MAX_PDF_TEXT_LENGTH) {
      extractedText = extractedText.substring(0, MAX_PDF_TEXT_LENGTH);
    }

    // Store extracted text in assets table
    const { error: updateError } = await serviceClient
      .from("curriculum_session_assets")
      .update({
        student_pdf_text: extractedText,
        student_pdf_text_updated_at: new Date().toISOString(),
        processing_status: "done",
        last_error_text: null,
      })
      .eq("id", asset.id);

    if (updateError) {
      console.error("Failed to store extracted text:", updateError);
      // Try to set error status
      await serviceClient.from("curriculum_session_assets").update({
        processing_status: "error",
        last_error_text: updateError.message,
      }).eq("id", asset.id);
      return new Response(JSON.stringify({ error: "Failed to store extracted text" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const duration = Date.now() - startTime;
    console.log(`extract-pdf-text: user=${user.id}, session=${sessionId}, textLength=${extractedText.length}, duration=${duration}ms`);

    return new Response(JSON.stringify({ extracted: true, textLength: extractedText.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("extract-pdf-text error:", error);
    // Try to mark asset as error if we have context
    try {
      const body = await req.clone().json().catch(() => null);
      if (body?.sessionId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sc = createClient(supabaseUrl, supabaseServiceKey);
        await sc.from("curriculum_session_assets").update({
          processing_status: "error",
          last_error_text: error instanceof Error ? error.message : "Unknown error",
        }).eq("session_id", body.sessionId);
      }
    } catch { /* ignore cleanup errors */ }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
