// Weekly Content Audit
// Scans current-week scheduled sessions and notifies admins about gaps:
//   - Missing curriculum content / slides
//   - Missing quiz
//   - Missing assignment
//   - Missing summary video for kojo_core groups
//   - Missing full video  for kojo_x   groups
//
// Idempotency: keyed by ISO week (YYYY-Www). Each admin gets ONE digest
// per week via send-email's idempotencyKey dedup in email_send_log.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCairoNow } from "../_shared/cairoTime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SessionRow {
  id: string;
  session_date: string;
  level_id: string;
  content_number: number | null;
  groups: {
    id: string;
    name: string;
    name_ar: string;
    group_type: string;
    age_group_id: string;
  };
}

interface GapEntry {
  group_name: string;
  group_name_ar: string;
  session_date: string;
  group_type: string;
  missing: string[];
  missing_ar: string[];
}

// ISO week number (Cairo-based date)
function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${d.getUTCFullYear()}-W${week.toString().padStart(2, "0")}`;
}

// Compute Cairo week window: Saturday → Friday (academy convention)
function cairoWeekWindow(today: string): { start: string; end: string } {
  const d = new Date(today + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  // Saturday = 6 → start of week
  const daysSinceSaturday = (dow + 1) % 7;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - daysSinceSaturday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = (x: Date) =>
    `${x.getUTCFullYear()}-${(x.getUTCMonth() + 1).toString().padStart(2, "0")}-${x.getUTCDate().toString().padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") ?? "";

    const isServiceRole = token === supabaseKey;
    const isCronEnvAuth = !!cronSecret && token === cronSecret;

    let isVaultCronAuth = false;
    if (!isServiceRole && !isCronEnvAuth && token) {
      try {
        const tmp = createClient(supabaseUrl, supabaseKey);
        const { data } = await tmp.rpc("verify_cron_token", { p_token: token });
        isVaultCronAuth = data === true;
      } catch (_) { /* ignore */ }
    }

    if (!isServiceRole && !isCronEnvAuth && !isVaultCronAuth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const cairo = getCairoNow();
    const { start, end } = cairoWeekWindow(cairo.today);
    const weekKey = isoWeekKey(cairo.today);

    // Fetch all scheduled sessions in this week (skip frozen groups)
    const { data: sessions, error: sErr } = await supabase
      .from("sessions")
      .select(`
        id, session_date, level_id, content_number,
        groups!inner ( id, name, name_ar, group_type, age_group_id, status )
      `)
      .eq("status", "scheduled")
      .gte("session_date", start)
      .lte("session_date", end)
      .neq("groups.status", "frozen");

    if (sErr) throw sErr;

    const gaps: GapEntry[] = [];

    for (const s of (sessions || []) as unknown as SessionRow[]) {
      const g = s.groups;
      const missing: string[] = [];
      const missingAr: string[] = [];

      // Lookup curriculum session
      let curriculum: any = null;
      if (s.content_number != null) {
        const { data } = await supabase
          .from("curriculum_sessions")
          .select("id, slides_url, summary_video_url, full_video_url, quiz_id, assignment_title")
          .eq("level_id", s.level_id)
          .eq("age_group_id", g.age_group_id)
          .eq("session_number", s.content_number)
          .eq("is_active", true)
          .maybeSingle();
        curriculum = data;
      }

      if (!curriculum) {
        missing.push("Curriculum content");
        missingAr.push("محتوى المنهج");
      } else {
        if (!curriculum.slides_url) {
          missing.push("Slides");
          missingAr.push("الشرائح");
        }
        if (!curriculum.quiz_id) {
          missing.push("Quiz");
          missingAr.push("الكويز");
        }
        if (!curriculum.assignment_title) {
          missing.push("Assignment");
          missingAr.push("الواجب");
        }
        if (g.group_type === "kojo_core" && !curriculum.summary_video_url) {
          missing.push("Summary video (Core group)");
          missingAr.push("فيديو الملخص (مجموعة Core)");
        }
        if (g.group_type === "kojo_x" && !curriculum.full_video_url) {
          missing.push("Full video (X group)");
          missingAr.push("الفيديو الكامل (مجموعة X)");
        }
      }

      if (missing.length > 0) {
        gaps.push({
          group_name: g.name,
          group_name_ar: g.name_ar,
          session_date: s.session_date,
          group_type: g.group_type,
          missing,
          missing_ar: missingAr,
        });
      }
    }

    if (gaps.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No content gaps detected this week",
          week: weekKey,
          window: { start, end },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build digest rows
    const rowsHtml = gaps
      .map(
        (g) =>
          `<tr>
             <td style="padding:8px;border-bottom:1px solid #eee">${g.group_name}</td>
             <td style="padding:8px;border-bottom:1px solid #eee">${g.session_date}</td>
             <td style="padding:8px;border-bottom:1px solid #eee">${g.group_type}</td>
             <td style="padding:8px;border-bottom:1px solid #eee;color:#b91c1c">${g.missing.join(", ")}</td>
           </tr>`,
      )
      .join("");
    const tableHtml =
      `<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px">
         <thead><tr style="background:#f3f4f6">
           <th style="text-align:left;padding:8px">Group</th>
           <th style="text-align:left;padding:8px">Date</th>
           <th style="text-align:left;padding:8px">Type</th>
           <th style="text-align:left;padding:8px">Missing</th>
         </tr></thead>
         <tbody>${rowsHtml}</tbody>
       </table>`;

    const rowsHtmlAr = gaps
      .map(
        (g) =>
          `<tr>
             <td style="padding:8px;border-bottom:1px solid #eee">${g.group_name_ar}</td>
             <td style="padding:8px;border-bottom:1px solid #eee">${g.session_date}</td>
             <td style="padding:8px;border-bottom:1px solid #eee">${g.group_type}</td>
             <td style="padding:8px;border-bottom:1px solid #eee;color:#b91c1c">${g.missing_ar.join("، ")}</td>
           </tr>`,
      )
      .join("");
    const tableHtmlAr =
      `<table dir="rtl" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px">
         <thead><tr style="background:#f3f4f6">
           <th style="text-align:right;padding:8px">المجموعة</th>
           <th style="text-align:right;padding:8px">التاريخ</th>
           <th style="text-align:right;padding:8px">النوع</th>
           <th style="text-align:right;padding:8px">الناقص</th>
         </tr></thead>
         <tbody>${rowsHtmlAr}</tbody>
       </table>`;

    const tgLines = gaps
      .map(
        (g) =>
          `• *${g.group_name_ar}* (${g.session_date}, ${g.group_type})\n  ❗ ${g.missing_ar.join("، ")}`,
      )
      .join("\n\n");

    // Resolve admin recipients
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminIds = (admins || []).map((a) => a.user_id);
    const idempotencyKey = `weekly-content-audit-${weekKey}`;

    const templateData = {
      week_key: weekKey,
      week_start: start,
      week_end: end,
      gaps_count: gaps.length,
      gaps_table_html: tableHtml,
      gaps_table_html_ar: tableHtmlAr,
      gaps_telegram_md: tgLines,
    };

    let dispatched = 0;
    for (const userId of adminIds) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", userId)
        .maybeSingle();

      const email = prof?.email;
      const perUserKey = `${idempotencyKey}-${userId}`;

      await Promise.allSettled([
        email
          ? supabase.functions.invoke("send-email", {
              body: {
                to: email,
                templateName: "admin-weekly-content-gap",
                templateData,
                idempotencyKey: perUserKey,
                audience: "admin",
                skipTelegramFanout: true,
              },
            })
          : Promise.resolve(null),
        supabase.functions.invoke("send-telegram", {
          body: {
            userId,
            templateName: "admin-weekly-content-gap",
            templateData,
            audience: "admin",
            idempotencyKey: `${perUserKey}-tg`,
          },
        }),
      ]);
      dispatched++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        week: weekKey,
        window: { start, end },
        gaps: gaps.length,
        admins_notified: dispatched,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[weekly-content-audit]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
