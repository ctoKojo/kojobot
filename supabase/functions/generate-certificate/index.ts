import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const MAX_RETRIES = 3;

interface CertConfig {
  name_y_percent: number;
  font_size: number;
  font_color_hex: string;
}

const DEFAULT_CONFIG: CertConfig = {
  name_y_percent: 59,
  font_size: 36,
  font_color_hex: "#1B2A4A",
};

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!
      ).auth.getUser(token);

      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin"]);

      if (!roles || roles.length === 0) {
        return new Response(JSON.stringify({ error: "Permission denied" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    } else {
      const cronSecret = Deno.env.get("CRON_SECRET");
      const providedSecret = req.headers.get("x-cron-secret");
      if (!cronSecret || providedSecret !== cronSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const certificateId = body.certificate_id;

    // Fetch pending certificates with level config
    let query = supabaseAdmin
      .from("student_certificates")
      .select("*, levels:level_id(certificate_template_path, name, certificate_config)")
      .in("status", ["pending", "failed"])
      .lt("retry_count", MAX_RETRIES)
      .order("created_at", { ascending: true })
      .limit(10);

    if (certificateId) {
      query = supabaseAdmin
        .from("student_certificates")
        .select("*, levels:level_id(certificate_template_path, name, certificate_config)")
        .eq("id", certificateId)
        .in("status", ["pending", "failed"])
        .lt("retry_count", MAX_RETRIES);
    }

    const { data: certs, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!certs || certs.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No pending certificates" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Download the custom script font once for all certificates
    let customFont: Uint8Array | null = null;
    try {
      const { data: fontData, error: fontError } = await supabaseAdmin
        .storage
        .from("certificates")
        .download("fonts/DancingScript.ttf");
      if (!fontError && fontData) {
        customFont = new Uint8Array(await fontData.arrayBuffer());
      }
    } catch {
      console.warn("Could not load custom font, falling back to Helvetica");
    }

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const cert of certs) {
      try {
        // Lock: set status to generating
        const { error: lockError } = await supabaseAdmin
          .from("student_certificates")
          .update({ status: "generating", updated_at: new Date().toISOString() })
          .eq("id", cert.id)
          .eq("status", cert.status);

        if (lockError) {
          results.push({ id: cert.id, status: "skipped", error: "Lock failed" });
          continue;
        }

        const levelData = cert.levels as any;
        const templatePath = levelData?.certificate_template_path;
        if (!templatePath) {
          throw new Error("No template path configured for this level");
        }

        // Read config from level, with defaults
        const rawConfig = levelData?.certificate_config || {};
        const config: CertConfig = {
          name_y_percent: rawConfig.name_y_percent ?? DEFAULT_CONFIG.name_y_percent,
          font_size: rawConfig.font_size ?? DEFAULT_CONFIG.font_size,
          font_color_hex: rawConfig.font_color_hex ?? DEFAULT_CONFIG.font_color_hex,
        };

        // Download template from storage
        const { data: templateData, error: dlError } = await supabaseAdmin
          .storage
          .from("certificates")
          .download(templatePath);

        if (dlError || !templateData) {
          throw new Error(`Failed to download template: ${dlError?.message || "No data"}`);
        }

        // Load PDF and overlay student name
        const pdfBytes = await templateData.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        // Register fontkit for custom fonts
        pdfDoc.registerFontkit(fontkit);
        
        const pages = pdfDoc.getPages();
        const page = pages[0];
        const { width, height } = page.getSize();

        // Use custom script font if available, otherwise fallback
        let font;
        if (customFont) {
          font = await pdfDoc.embedFont(customFont);
        } else {
          font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        }

        const studentName = cert.student_name_snapshot || "Unknown";
        const fontSize = config.font_size;
        const textWidth = font.widthOfTextAtSize(studentName, fontSize);

        // Place name centered, using config y position (% from bottom)
        const yPosition = height * (config.name_y_percent / 100);

        page.drawText(studentName, {
          x: (width - textWidth) / 2,
          y: yPosition,
          size: fontSize,
          font,
          color: hexToRgb(config.font_color_hex),
        });

        const modifiedPdf = await pdfDoc.save();

        // Upload to storage
        const storagePath = `generated/${cert.student_id}/${cert.certificate_code}.pdf`;

        // Delete old file if exists (regenerate case)
        if (cert.storage_path) {
          await supabaseAdmin.storage.from("certificates").remove([cert.storage_path]);
        }

        const { error: uploadError } = await supabaseAdmin
          .storage
          .from("certificates")
          .upload(storagePath, modifiedPdf, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        // Update certificate record
        await supabaseAdmin
          .from("student_certificates")
          .update({
            status: "ready",
            storage_path: storagePath,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cert.id);

        results.push({ id: cert.id, status: "ready" });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const newRetryCount = (cert.retry_count || 0) + 1;
        const newStatus = newRetryCount >= MAX_RETRIES ? "failed" : "pending";

        await supabaseAdmin
          .from("student_certificates")
          .update({
            status: newStatus,
            error_message: errorMsg,
            retry_count: newRetryCount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cert.id);

        results.push({ id: cert.id, status: "failed", error: errorMsg });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});