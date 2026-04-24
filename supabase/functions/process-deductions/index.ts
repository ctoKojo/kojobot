import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Auth: only service role or CRON_SECRET allowed
  const authHeader = req.headers.get('Authorization');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cronSecret = Deno.env.get('CRON_SECRET');
  const token = authHeader?.replace('Bearer ', '') ?? '';
  const isServiceRole = token === supabaseKey;
  const isCronAuth = cronSecret && token === cronSecret;

  if (!isServiceRole && !isCronAuth) {
    console.warn('[Process Deductions] Unauthorized access attempt');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    // Default month for fallback; actual month derived from event.created_at below
    const fallbackMonth = now.toISOString().substring(0, 7) + '-01';

    const results = { processed: 0, skipped: 0, errors: [] as string[] };

    console.log(`[Process Deductions] Running at ${now.toISOString()}`);

    // Fetch all pending deductions
    const { data: pendingEvents, error: fetchError } = await supabase
      .from('performance_events')
      .select('*')
      .eq('event_type', 'deduction_pending')
      .eq('is_archived', false)
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch pending deductions: ${fetchError.message}`);
    }

    for (const event of (pendingEvents || [])) {
      try {
        const details = event.details as any;
        const amount = details?.deduction_amount;
        const warningType = details?.warning_type;
        const ruleId = details?.rule_id;
        const ruleVersion = details?.rule_version;

        if (!amount || !warningType) {
          results.skipped++;
          continue;
        }

        // Idempotency: check if deduction already applied for this reference
        const { data: existingDeduction } = await supabase
          .from('performance_events')
          .select('id')
          .eq('instructor_id', event.instructor_id)
          .eq('event_type', 'deduction_applied')
          .eq('reference_id', event.reference_id)
          .eq('is_archived', false)
          .limit(1)
          .maybeSingle();

        if (existingDeduction) {
          // Already applied, just archive the pending event
          await supabase
            .from('performance_events')
            .update({ is_archived: true })
            .eq('id', event.id);
          results.skipped++;
          continue;
        }

        // Use event.created_at to determine the correct month for the deduction
        const eventMonth = event.created_at ? event.created_at.substring(0, 7) + '-01' : fallbackMonth;

        // Apply deduction via salary_events
        const { error: salaryError } = await supabase
          .from('salary_events')
          .insert({
            employee_id: event.instructor_id,
            month: eventMonth,
            event_type: 'warning_deduction',
            amount: amount,
            description: `Warning deduction: ${warningType} (severity: ${details?.severity || 'minor'})`,
            description_ar: `خصم إنذار: ${warningType} (الدرجة: ${details?.severity || 'بسيط'})`,
            source: 'warning_rule',
            reference_id: event.reference_id,
            metadata: {
              warning_type: warningType,
              severity: details?.severity,
              rule_id: ruleId,
              rule_version: ruleVersion,
              warning_count: details?.warning_count,
              performance_event_id: event.id,
            },
          });

        if (salaryError) {
          results.errors.push(`Salary insert error for ${event.instructor_id}: ${salaryError.message}`);
          continue;
        }

        // Mark as applied
        await supabase.from('performance_events').insert({
          instructor_id: event.instructor_id,
          event_type: 'deduction_applied',
          reference_id: event.reference_id,
          reference_type: event.reference_type,
          details: { ...details, applied_at: now.toISOString(), source_event_id: event.id },
        });

        // Archive the pending event
        await supabase
          .from('performance_events')
          .update({ is_archived: true })
          .eq('id', event.id);

        // Notify the instructor
        const { data: snapshot } = await supabase
          .from('salary_month_snapshots')
          .select('net_amount')
          .eq('employee_id', event.instructor_id)
          .eq('month', eventMonth)
          .maybeSingle();

        await supabase.from('notifications').insert({
          user_id: event.instructor_id,
          type: 'warning',
          category: 'financial',
          title: 'Warning Deduction Applied',
          title_ar: 'تم تطبيق خصم إنذار',
          message: `Deduction of ${amount} EGP applied. Current balance: ${snapshot?.net_amount || 0} EGP`,
          message_ar: `تم خصم ${amount} ج.م. رصيدك الحالي: ${snapshot?.net_amount || 0} ج.م`,
          action_url: '/profile',
        });

        results.processed++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.errors.push(`Event ${event.id}: ${msg}`);
      }
    }

    // Update system_health_metrics with deductions count
    const todayStr = now.toISOString().split('T')[0];
    await supabase.from('system_health_metrics').upsert({
      date: todayStr,
      total_deductions: results.processed,
    }, { onConflict: 'date' });

    console.log(`[Process Deductions] Done. Processed: ${results.processed}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`);

    return new Response(
      JSON.stringify({ success: true, timestamp: now.toISOString(), results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error('Process deductions error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
