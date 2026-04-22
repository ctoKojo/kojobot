// Process scheduled bulk reminders that are due.
// Runs every 5 minutes via pg_cron.
//
// For each pending row whose scheduled_at <= now():
//   1. Mark as processing.
//   2. Resolve recipients per student using the chosen recipient_mode.
//   3. Invoke send-email for each recipient with a deterministic idempotencyKey.
//   4. Persist a result_summary and final status (sent/failed).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveStudentRecipients } from '../_shared/recipientResolver.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduledRow {
  id: string;
  scheduled_at: string;
  template_name: string;
  recipient_mode: 'parent' | 'student' | 'both' | 'smart';
  student_ids: string[];
  template_data: Record<string, unknown>;
  custom_subject: string | null;
  custom_message: string | null;
}

function pickName(profile: { full_name?: string | null; full_name_ar?: string | null } | null | undefined): string {
  if (!profile) return '';
  return profile.full_name_ar || profile.full_name || '';
}

async function buildRecipientsForStudent(
  supabase: ReturnType<typeof createClient>,
  studentId: string,
  mode: ScheduledRow['recipient_mode'],
): Promise<Array<{ email: string; name: string; recipientType: 'parent' | 'student'; parentId?: string; studentName: string }>> {
  // Fetch student profile
  const { data: student } = await supabase
    .from('profiles')
    .select('user_id, email, full_name, full_name_ar')
    .eq('user_id', studentId)
    .maybeSingle();

  const studentName = pickName(student as any) || 'Student';
  const studentEmail = (student as any)?.email as string | null;

  // Smart / parent / both → resolve parents
  let parentRecipients: Array<{ email: string; name: string; parentId: string }> = [];
  if (mode === 'smart' || mode === 'parent' || mode === 'both') {
    const resolved = await resolveStudentRecipients(supabase, studentId, student as any);
    parentRecipients = resolved.recipients
      .filter((r) => r.recipientType === 'parent' && r.email)
      .map((r) => ({ email: r.email, name: r.name, parentId: r.parentId! }));
  }

  const out: Array<{ email: string; name: string; recipientType: 'parent' | 'student'; parentId?: string; studentName: string }> = [];

  if (mode === 'parent') {
    for (const p of parentRecipients) {
      out.push({ email: p.email, name: p.name, recipientType: 'parent', parentId: p.parentId, studentName });
    }
  } else if (mode === 'student') {
    if (studentEmail) out.push({ email: studentEmail, name: studentName, recipientType: 'student', studentName });
  } else if (mode === 'both') {
    for (const p of parentRecipients) {
      out.push({ email: p.email, name: p.name, recipientType: 'parent', parentId: p.parentId, studentName });
    }
    if (studentEmail) out.push({ email: studentEmail, name: studentName, recipientType: 'student', studentName });
  } else {
    // smart: parents first, fallback to student
    if (parentRecipients.length > 0) {
      for (const p of parentRecipients) {
        out.push({ email: p.email, name: p.name, recipientType: 'parent', parentId: p.parentId, studentName });
      }
    } else if (studentEmail) {
      out.push({ email: studentEmail, name: studentName, recipientType: 'student', studentName });
    }
  }

  return out;
}

async function processOne(
  supabase: ReturnType<typeof createClient>,
  row: ScheduledRow,
): Promise<{ ok: number; fail: number; skipped: number; errors: string[] }> {
  const summary = { ok: 0, fail: 0, skipped: 0, errors: [] as string[] };
  const stamp = new Date(row.scheduled_at).toISOString().slice(0, 10);

  for (const studentId of row.student_ids) {
    let recipients: Awaited<ReturnType<typeof buildRecipientsForStudent>> = [];
    try {
      recipients = await buildRecipientsForStudent(supabase, studentId, row.recipient_mode);
    } catch (e) {
      summary.fail++;
      summary.errors.push(`resolve ${studentId}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    if (recipients.length === 0) {
      summary.skipped++;
      continue;
    }

    for (const rec of recipients) {
      const data = {
        ...row.template_data,
        recipientName: rec.name,
        studentName: rec.studentName,
      };
      const idKey = `sched-${row.id}-${rec.recipientType}-${rec.parentId ?? studentId}-${studentId}-${stamp}`;
      try {
        const { data: result, error } = await supabase.functions.invoke('send-email', {
          body: {
            to: rec.email,
            templateName: row.template_name,
            templateData: data,
            idempotencyKey: idKey,
            customSubject: row.custom_subject || undefined,
            customBody: row.custom_message || undefined,
          },
        });
        if (error || (result && result.success === false)) {
          summary.fail++;
          summary.errors.push(`send ${rec.email}: ${error?.message ?? result?.error ?? 'unknown'}`);
        } else {
          summary.ok++;
        }
      } catch (e) {
        summary.fail++;
        summary.errors.push(`send ${rec.email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return summary;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Pull rows that are due. Limit batch to avoid runaway runs.
  const { data: due, error: pullErr } = await supabase
    .from('scheduled_bulk_reminders')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(20);

  if (pullErr) {
    return new Response(JSON.stringify({ error: pullErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rows = (due ?? []) as unknown as ScheduledRow[];
  const processed: Array<{ id: string; status: string; summary: any }> = [];

  for (const row of rows) {
    // Claim atomically: only proceed if it's still pending
    const { data: claimed, error: claimErr } = await supabase
      .from('scheduled_bulk_reminders')
      .update({ status: 'processing' })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (claimErr || !claimed) {
      continue; // someone else picked it up, or it was cancelled
    }

    let summary: Awaited<ReturnType<typeof processOne>>;
    try {
      summary = await processOne(supabase, row);
    } catch (e) {
      summary = { ok: 0, fail: row.student_ids.length, skipped: 0, errors: [e instanceof Error ? e.message : String(e)] };
    }

    const finalStatus = summary.fail > 0 && summary.ok === 0 ? 'failed' : 'sent';
    await supabase
      .from('scheduled_bulk_reminders')
      .update({
        status: finalStatus,
        processed_at: new Date().toISOString(),
        result_summary: summary as any,
      })
      .eq('id', row.id);

    processed.push({ id: row.id, status: finalStatus, summary });
  }

  return new Response(
    JSON.stringify({ success: true, processed_count: processed.length, processed }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
