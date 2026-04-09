import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const MAX_RETRIES = 3;
const REGEN_RATE_LIMIT = 5; // max regenerations per minute per cert

interface CertConfig {
  anchor_type: "baseline" | "bottom" | "center";
  anchor_y_percent: number;
  font_size: number;
  font_color_hex: string;
  font_key: string;
  x_offset_px: number;
  max_name_width_percent: number;
}

const DEFAULT_CONFIG: CertConfig = {
  anchor_type: "bottom",
  anchor_y_percent: 52,
  font_size: 42,
  font_color_hex: "#1B2A4A",
  font_key: "playfair_italic",
  x_offset_px: 0,
  max_name_width_percent: 80,
};

// Font registry with known metrics (fallback – actual metrics computed from embedded font)
const FONT_REGISTRY: Record<string, { path: string; fallback_ascent: number; fallback_descent: number }> = {
  playfair_italic: {
    path: "fonts/PlayfairDisplay-Italic.ttf",
    fallback_ascent: 0.85,
    fallback_descent: -0.22,
  },
  poppins_semibold: {
    path: "fonts/Poppins-SemiBold.ttf",
    fallback_ascent: 0.92,
    fallback_descent: -0.24,
  },
};

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/** Merge old config format into new CertConfig */
function parseConfig(raw: Record<string, unknown>): CertConfig {
  return {
    anchor_type: (raw.anchor_type as CertConfig["anchor_type"]) ?? DEFAULT_CONFIG.anchor_type,
    anchor_y_percent: (raw.anchor_y_percent as number) ?? (raw.name_y_percent as number) ?? DEFAULT_CONFIG.anchor_y_percent,
    font_size: (raw.font_size as number) ?? DEFAULT_CONFIG.font_size,
    font_color_hex: (raw.font_color_hex as string) ?? DEFAULT_CONFIG.font_color_hex,
    font_key: (raw.font_key as string) ?? DEFAULT_CONFIG.font_key,
    x_offset_px: (raw.x_offset_px as number) ?? DEFAULT_CONFIG.x_offset_px,
    max_name_width_percent: (raw.max_name_width_percent as number) ?? DEFAULT_CONFIG.max_name_width_percent,
  };
}

/** Compute draw Y so that the visible text anchors correctly */
function computeDrawY(
  anchorType: CertConfig["anchor_type"],
  anchorYPercent: number,
  pageHeight: number,
  fontSize: number,
  ascentRatio: number,
  descentRatio: number,
): number {
  const anchorY = pageHeight * (anchorYPercent / 100);
  const ascent = ascentRatio * fontSize;
  const descent = Math.abs(descentRatio) * fontSize;

  switch (anchorType) {
    case "bottom":
      // anchor_y = visible bottom of text → draw baseline above descent
      return anchorY + descent;
    case "center": {
      const textHeight = ascent + descent;
      return anchorY - textHeight / 2 + descent;
    }
    case "baseline":
    default:
      return anchorY;
  }
}

/** Auto-scale font to fit within maxWidth */
function fitFontSize(
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  text: string,
  maxSize: number,
  maxWidth: number,
  minSize = 16,
): number {
  let size = maxSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 1;
  }
  return size;
}

async function verifyAuth(req: Request, supabaseAdmin: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    ).auth.getUser(token);

    if (authError || !user) return { ok: false, status: 401, msg: "Unauthorized" };

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin"]);

    if (!roles || roles.length === 0) return { ok: false, status: 403, msg: "Permission denied" };
    return { ok: true, status: 200, msg: "" };
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || providedSecret !== cronSecret) return { ok: false, status: 401, msg: "Unauthorized" };
  return { ok: true, status: 200, msg: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const auth = await verifyAuth(req, supabaseAdmin);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.msg }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-load fonts from storage (cache per font_key)
    const fontCache: Record<string, Uint8Array> = {};
    const loadFont = async (fontKey: string): Promise<Uint8Array | null> => {
      if (fontCache[fontKey]) return fontCache[fontKey];
      const reg = FONT_REGISTRY[fontKey];
      if (!reg) return null;
      try {
        const { data, error } = await supabaseAdmin.storage.from("certificates").download(reg.path);
        if (error || !data) return null;
        const bytes = new Uint8Array(await data.arrayBuffer());
        fontCache[fontKey] = bytes;
        return bytes;
      } catch {
        return null;
      }
    };

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
        if (!templatePath) throw new Error("No template path configured for this level");

        const config = parseConfig((levelData?.certificate_config as Record<string, unknown>) || {});

        // Download template
        const { data: templateData, error: dlError } = await supabaseAdmin.storage
          .from("certificates")
          .download(templatePath);
        if (dlError || !templateData) throw new Error(`Template download failed: ${dlError?.message || "No data"}`);

        // Load PDF
        const pdfBytes = await templateData.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);
        pdfDoc.registerFontkit(fontkit);

        const pages = pdfDoc.getPages();
        const page = pages[0];
        const { width, height } = page.getSize();

        // Embed font
        let font;
        let ascentRatio: number;
        let descentRatio: number;

        const customFontBytes = await loadFont(config.font_key);
        if (customFontBytes) {
          font = await pdfDoc.embedFont(customFontBytes);
          // Extract real metrics from font
          const em = (font as any).embedder?.font?.unitsPerEm || 1000;
          const rawAscent = (font as any).embedder?.font?.ascent;
          const rawDescent = (font as any).embedder?.font?.descent;
          ascentRatio = rawAscent ? rawAscent / em : (FONT_REGISTRY[config.font_key]?.fallback_ascent ?? 0.85);
          descentRatio = rawDescent ? rawDescent / em : (FONT_REGISTRY[config.font_key]?.fallback_descent ?? -0.22);
        } else {
          font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          ascentRatio = 0.718;
          descentRatio = -0.207;
        }

        const studentName = cert.student_name_snapshot || "Unknown";

        // Auto-scale if name too wide
        const maxWidth = width * (config.max_name_width_percent / 100);
        const fontSize = fitFontSize(font, studentName, config.font_size, maxWidth);

        const textWidth = font.widthOfTextAtSize(studentName, fontSize);

        // Compute Y using font metrics
        const drawY = computeDrawY(config.anchor_type, config.anchor_y_percent, height, fontSize, ascentRatio, descentRatio);

        // Compute X (centered + offset)
        const drawX = (width - textWidth) / 2 + config.x_offset_px;

        page.drawText(studentName, {
          x: drawX,
          y: drawY,
          size: fontSize,
          font,
          color: hexToRgb(config.font_color_hex),
        });

        const modifiedPdf = await pdfDoc.save();

        // Upload
        const storagePath = `generated/${cert.student_id}/${cert.certificate_code}.pdf`;
        if (cert.storage_path) {
          await supabaseAdmin.storage.from("certificates").remove([cert.storage_path]);
        }

        const { error: uploadError } = await supabaseAdmin.storage
          .from("certificates")
          .upload(storagePath, modifiedPdf, { contentType: "application/pdf", upsert: true });
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        // Save last_working_config for rollback
        await supabaseAdmin
          .from("student_certificates")
          .update({
            status: "ready",
            storage_path: storagePath,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cert.id);

        // Save working config snapshot on level
        await supabaseAdmin
          .from("levels")
          .update({ certificate_config: { ...config, _last_working: true } as any })
          .eq("id", cert.level_id)
          .is("certificate_config->_last_working", null); // only if not already marked

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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
