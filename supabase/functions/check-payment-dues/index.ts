import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toISOString().split('T')[0];

    // Find overdue subscriptions that are not yet suspended
    const { data: overdueSubs } = await supabase
      .from('subscriptions')
      .select('id, student_id, next_payment_date, remaining_amount')
      .eq('status', 'active')
      .eq('is_suspended', false)
      .lt('next_payment_date', today)
      .gt('remaining_amount', 0);

    let suspendedCount = 0;

    for (const sub of overdueSubs || []) {
      // Suspend the subscription
      await supabase
        .from('subscriptions')
        .update({ is_suspended: true })
        .eq('id', sub.id);

      // Notify the student
      await supabase.from('notifications').insert({
        user_id: sub.student_id,
        title: 'Account Suspended',
        title_ar: 'تم إيقاف حسابك',
        message: 'Your account has been suspended due to overdue payment. Please contact the administration.',
        message_ar: 'تم إيقاف حسابك بسبب تأخر في سداد القسط. يرجى التواصل مع الإدارة.',
        type: 'warning',
        category: 'payment',
      });

      // Notify admins
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

    // Also check for upcoming payments (5 days warning)
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    const warningDate = fiveDaysFromNow.toISOString().split('T')[0];

    const { data: upcomingSubs } = await supabase
      .from('subscriptions')
      .select('id, student_id, next_payment_date, installment_amount')
      .eq('status', 'active')
      .eq('is_suspended', false)
      .gt('remaining_amount', 0)
      .gte('next_payment_date', today)
      .lte('next_payment_date', warningDate);

    for (const sub of upcomingSubs || []) {
      await supabase.from('notifications').insert({
        user_id: sub.student_id,
        title: 'Payment Due Soon',
        title_ar: 'موعد الدفع قريب',
        message: `Your next payment of ${sub.installment_amount} EGP is due on ${sub.next_payment_date}.`,
        message_ar: `موعد الدفع القادم ${sub.installment_amount} ج.م في ${sub.next_payment_date}.`,
        type: 'info',
        category: 'payment',
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      suspended: suspendedCount, 
      warnings_sent: upcomingSubs?.length || 0 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
