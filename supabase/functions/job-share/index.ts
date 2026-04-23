import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SITE_URL = "https://kojobot.com";
// 1216x640 social share card (designed for OG / Twitter previews)
const DEFAULT_IMAGE = `${SITE_URL}/og-careers.jpg`;

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(html: string, max = 200): string {
  const text = String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Path can be /functions/v1/job-share/<slug> OR ?slug=<slug>
    const pathParts = url.pathname.split("/").filter(Boolean);
    const slug = url.searchParams.get("slug") || pathParts[pathParts.length - 1];

    if (!slug || slug === "job-share") {
      return new Response("Missing slug", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: job } = await supabase
      .from("jobs")
      .select("slug,title_en,title_ar,description_en,description_ar,location_en,location_ar,type,status,deadline_at")
      .eq("slug", slug)
      .maybeSingle();

    const canonical = `${SITE_URL}/careers/${slug}`;

    // Detect Arabic preference from query (?lang=ar) or Accept-Language
    const langParam = url.searchParams.get("lang");
    const acceptLang = req.headers.get("accept-language") || "";
    const isAr = langParam === "ar" || (langParam !== "en" && acceptLang.toLowerCase().startsWith("ar"));

    let title: string;
    let description: string;
    let titleAlt: string;
    let descriptionAlt: string;

    if (!job) {
      title = isAr ? "وظيفة غير متاحة — Kojobot Careers" : "Job not found — Kojobot Careers";
      titleAlt = isAr ? "Job not found — Kojobot Careers" : "وظيفة غير متاحة — Kojobot Careers";
      description = isAr
        ? "هذه الوظيفة لم تعد متاحة. تصفح فرص العمل الحالية في كوجوبوت أكاديمي."
        : "This job is no longer available. Browse current openings at Kojobot Academy.";
      descriptionAlt = description;
    } else {
      const tEn = job.title_en || "Job opening";
      const tAr = job.title_ar || "وظيفة شاغرة";
      const dEn = stripHtml(job.description_en || "");
      const dAr = stripHtml(job.description_ar || "");
      const locEn = job.location_en ? ` · ${job.location_en}` : "";
      const locAr = job.location_ar ? ` · ${job.location_ar}` : "";

      title = isAr ? `${tAr}${locAr} — Kojobot Careers` : `${tEn}${locEn} — Kojobot Careers`;
      titleAlt = isAr ? `${tEn}${locEn} — Kojobot Careers` : `${tAr}${locAr} — Kojobot Careers`;
      description = (isAr ? dAr : dEn) || (isAr ? "تقدم الآن لهذه الوظيفة في كوجوبوت أكاديمي." : "Apply now for this opportunity at Kojobot Academy.");
      descriptionAlt = (isAr ? dEn : dAr) || description;
    }

    const html = `<!DOCTYPE html>
<html lang="${isAr ? "ar" : "en"}" dir="${isAr ? "rtl" : "ltr"}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${canonical}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Kojobot Academy" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${DEFAULT_IMAGE}" />
  <meta property="og:image:secure_url" content="${DEFAULT_IMAGE}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1216" />
  <meta property="og:image:height" content="640" />
  <meta property="og:image:alt" content="${escapeHtml(title)}" />
  <meta property="og:locale" content="${isAr ? "ar_EG" : "en_US"}" />
  <meta property="og:locale:alternate" content="${isAr ? "en_US" : "ar_EG"}" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@kojobot" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${DEFAULT_IMAGE}" />
  <meta name="twitter:image:alt" content="${escapeHtml(title)}" />

  <!-- Localized alternates -->
  <link rel="alternate" hreflang="${isAr ? "en" : "ar"}" href="${canonical}" />

  <!-- Send real users straight to the SPA (crawlers ignore JS + meta refresh) -->
  <meta http-equiv="refresh" content="0; url=${canonical}" />
  <script>window.location.replace(${JSON.stringify(canonical)});</script>
  <style>body{font-family:system-ui,sans-serif;background:#0a0a14;color:#f0f0ff;margin:0;padding:48px 24px;text-align:center}a{color:#6455F0}img{max-width:100%;height:auto;border-radius:12px;margin:24px 0}</style>
</head>
<body>
  <img src="${DEFAULT_IMAGE}" alt="Kojobot Academy" />
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p><a href="${canonical}">${isAr ? "افتح الوظيفة" : "Open job page"}</a></p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
        "X-Robots-Tag": "all",
        ...corsHeaders,
      },
    });
  } catch (err) {
    console.error("job-share error:", err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
