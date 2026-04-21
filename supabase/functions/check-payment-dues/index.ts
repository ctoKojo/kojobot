import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rateLimit.ts";
import { getCairoToday, getCairoDatePlusDays } from "../_shared/cairoTime.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting - max 5 requests per minute
    const clientIP = getClientIP(req);
    const rateLimitResult = checkRateLimit(`check-payment-dues:${clientIP}`, { maxRequests: 5, windowMs: 60000 });
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult, corsHeaders);
    }

    // Authentication: require a valid JWT and verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub;

    // Verify caller is admin
    const { data: roleData } = await supabaseAuth.from('user_roles').select('role').eq('user_id', userId).single();
    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role for privileged operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Use Cairo timezone for date comparisons
    const today = getCairoToday();

    // Find overdue subscriptions that are not yet suspended
    const { data: overdueSubs } = await supabase
      .from('subscriptions')
      .select('id, student_id, next_payment_date, remaining_amount')
      .eq('status', 'active')
      .eq('is_suspended', false)
      .lt('next_payment_date', today)
      .gt('remaining_amount', 0);

    let suspendedCount = 0;
    let skippedCount = 0;

    for (const sub of overdueSubs || []) {
      // Idempotency: check if a suspension notification was already sent today
      const { data: existingNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', sub.student_id)
        .eq('category', 'payment')
        .eq('title', 'Account Suspended')
        .gte('created_at', `${today}T00:00:00`)
        .limit(1);

      if (existingNotif && existingNotif.length > 0) {
        skippedCount++;
        // Still suspend the account even if notification was already sent
        await supabase
          .from('subscriptions')
          .update({ is_suspended: true })
          .eq('id', sub.id);
        continue;
      }

      await supabase
        .from('subscriptions')
        .update({ is_suspended: true })
        .eq('id', sub.id);

      await supabase.from('notifications').insert({
        user_id: sub.student_id,
        title: 'Account Suspended',
        title_ar: 'تم إيقاف حسابك',
        message: 'Your account has been suspended due to overdue payment. Please contact the administration.',
        message_ar: 'تم إيقاف حسابك بسبب تأخر في سداد القسط. يرجى التواصل مع الإدارة.',
        type: 'warning',
        category: 'payment',
      });

      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, full_name_ar')
        .eq('user_id', sub.student_id)
        .single();

      for (const admin of admins || []) {
        await supabase.from('notifications').insert({
          user_id: admin.user_id,
          title: 'Student Account Suspended',
          title_ar: 'تم إيقاف حساب طالب',
          message: `${profile?.full_name || 'A student'} has been suspended due to overdue payment.`,
          message_ar: `تم إيقاف حساب ${profile?.full_name_ar || profile?.full_name || 'طالب'} بسبب تأخر في الدفع.`,
          type: 'warning',
          category: 'payment',
          action_url: `/student/${sub.student_id}`,
        });
      }

      suspendedCount++;
    }

    // Check for upcoming payments (5 days warning) - Cairo timezone
    const warningDate = getCairoDatePlusDays(5);

    const { data: upcomingSubs } = await supabase
      .from('subscriptions')
      .select('id, student_id, next_payment_date, installment_amount')
      .eq('status', 'active')
      .eq('is_suspended', false)
      .gt('remaining_amount', 0)
      .gte('next_payment_date', today)
      .lte('next_payment_date', warningDate);

    let warningsSent = 0;

    for (const sub of upcomingSubs || []) {
      // Idempotency: check if a payment-due-soon notification already exists today
      const { data: existingWarning } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', sub.student_id)
        .eq('category', 'payment')
        .eq('title', 'Payment Due Soon')
        .gte('created_at', `${today}T00:00:00`)
        .limit(1);

      if (existingWarning && existingWarning.length > 0) {
        continue; // Already notified today
      }

      await supabase.from('notifications').insert({
        user_id: sub.student_id,
        title: 'Payment Due Soon',
        title_ar: 'موعد الدفع قريب',
        message: `Your next payment of ${sub.installment_amount} EGP is due on ${sub.next_payment_date}.`,
        message_ar: `موعد الدفع القادم ${sub.installment_amount} ج.م في ${sub.next_payment_date}.`,
        type: 'info',
        category: 'payment',
      });

      // Send email reminder (best-effort, fire-and-forget)
      try {
        const { data: studentProfile } = await supabase
          .from('profiles')
          .select('email, full_name, full_name_ar')
          .eq('user_id', sub.student_id)
          .maybeSingle();

        if (studentProfile?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              to: studentProfile.email,
              templateName: 'payment-due',
              templateData: {
                studentName: studentProfile.full_name_ar || studentProfile.full_name || '',
                amount: sub.installment_amount,
                dueDate: sub.next_payment_date,
              },
              idempotencyKey: `payment-due-${sub.student_id}-${sub.next_payment_date}`,
            },
          });
        }
      } catch (emailErr) {
        console.error('Email send failed for payment due:', emailErr);
      }

      warningsSent++;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      suspended: suspendedCount,
      skipped_duplicate: skippedCount,
      warnings_sent: warningsSent,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
