// Compliance scan report PDF generator (jsPDF, server-side)
// Input: { trace_id: string }
// Output: PDF binary

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import autoTable from "https://esm.sh/jspdf-autotable@3.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReportInput {
  trace_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin/reception
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id);
    const allowed = (roles ?? []).some(
      (r: { role: string }) => r.role === "admin" || r.role === "reception",
    );
    if (!allowed) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as ReportInput;
    if (!body?.trace_id) {
      return new Response(JSON.stringify({ error: "trace_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch run telemetry
    const { data: runs } = await admin
      .from("compliance_scan_runs")
      .select("*")
      .filter("metadata->>trace_id", "eq", body.trace_id)
      .order("started_at", { ascending: false })
      .limit(1);
    const run = runs?.[0];

    // Fetch warnings created in this run
    const { data: warnings } = await admin
      .from("instructor_warnings")
      .select(
        "id, warning_type, severity, reason, created_at, instructor_id, session_id, settings_version, level_id, content_number",
      )
      .eq("trace_id", body.trace_id)
      .order("created_at", { ascending: true });

    // Fetch dedup attempts
    const { data: dedups } = await admin
      .from("warning_dedup_log")
      .select("fingerprint, existing_warning_id, attempted_at, reason")
      .eq("trace_id", body.trace_id);

    // Fetch anomalies
    const { data: anomalies } = await admin
      .from("data_quality_issues")
      .select("issue_type, entity_id, details, detected_at")
      .filter("details->>trace_id", "eq", body.trace_id);

    // Group warnings by type
    const byType: Record<string, number> = {};
    (warnings ?? []).forEach((w) => {
      byType[w.warning_type] = (byType[w.warning_type] ?? 0) + 1;
    });

    // Build PDF
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Compliance Scan Report", margin, y);
    y += 24;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Trace ID: ${body.trace_id}`, margin, y);
    y += 14;
    if (run) {
      doc.text(
        `Started: ${new Date(run.started_at).toLocaleString("en-GB")}`,
        margin,
        y,
      );
      y += 14;
      if (run.finished_at) {
        doc.text(
          `Finished: ${new Date(run.finished_at).toLocaleString("en-GB")}`,
          margin,
          y,
        );
        y += 14;
      }
      doc.text(
        `Duration: ${run.execution_time_ms ?? "-"} ms`,
        margin,
        y,
      );
      y += 14;
      doc.text(
        `Settings version: ${run.metadata?.settings_version ?? "-"}`,
        margin,
        y,
      );
      y += 18;
    }

    // Summary box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Summary", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const summary = [
      ["Sessions scanned", String(run?.sessions_scanned ?? 0)],
      ["Warnings created", String(run?.warnings_created ?? warnings?.length ?? 0)],
      ["Warnings auto-resolved", String(run?.warnings_auto_resolved ?? 0)],
      ["Warnings skipped", String(run?.warnings_skipped ?? 0)],
      ["Duplicate attempts", String(dedups?.length ?? 0)],
      ["Anomalies", String(anomalies?.length ?? 0)],
    ];
    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: summary,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [40, 40, 60] },
    });
    // @ts-ignore lastAutoTable
    y = doc.lastAutoTable.finalY + 20;

    // Breakdown by type
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Breakdown by Warning Type", margin, y);
    y += 8;
    autoTable(doc, {
      startY: y + 6,
      head: [["Warning type", "Count"]],
      body: Object.entries(byType).map(([t, c]) => [t, String(c)]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [40, 40, 60] },
    });
    // @ts-ignore
    y = doc.lastAutoTable.finalY + 20;

    // Anomalies table
    if ((anomalies ?? []).length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Anomalies", margin, y);
      autoTable(doc, {
        startY: y + 6,
        head: [["Type", "Entity", "Detected at"]],
        body: (anomalies ?? []).map((a) => [
          a.issue_type,
          a.entity_id,
          new Date(a.detected_at).toLocaleString("en-GB"),
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8 },
        headStyles: { fillColor: [120, 60, 60] },
      });
      // @ts-ignore
      y = doc.lastAutoTable.finalY + 20;
    }

    // Warnings table (paginated)
    if ((warnings ?? []).length > 0) {
      doc.addPage();
      y = margin;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Warnings created", margin, y);
      autoTable(doc, {
        startY: y + 6,
        head: [["Type", "Severity", "Reason", "Created"]],
        body: (warnings ?? []).map((w) => [
          w.warning_type,
          w.severity ?? "-",
          (w.reason ?? "").slice(0, 80),
          new Date(w.created_at).toLocaleString("en-GB"),
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [40, 40, 60] },
        columnStyles: { 2: { cellWidth: 250 } },
      });
    }

    // Footer on every page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Page ${i} / ${pageCount}  •  Generated ${new Date().toISOString()}`,
        margin,
        doc.internal.pageSize.getHeight() - 16,
      );
    }

    const pdfBytes = doc.output("arraybuffer");
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="compliance-report-${body.trace_id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (e) {
    console.error("export-compliance-report error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
