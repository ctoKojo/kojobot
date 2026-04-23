// Cron-triggered function. Runs every 15 minutes.
// Sends reminders 24h ± 15m and 1h ± 15m before scheduled interviews.
// Idempotent: checks reminder_*_sent_at before sending.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-token',
}

function formatCairoTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const dateFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const timeFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
  return { date: dateFmt.format(d), time: timeFmt.format(d) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  // Auth: cron token (verify_cron_token RPC) OR service-role JWT
  const cronToken = req.headers.get('x-cron-token')
  const authHeader = req.headers.get('authorization') ?? ''
  let authorized = false

  if (cronToken) {
    try {
      const { data } = await supabase.rpc('verify_cron_token', { p_token: cronToken })
      if (data === true) authorized = true
    } catch (_) { /* ignore */ }
  }
  if (!authorized && authHeader.startsWith('Bearer ')) {
    // Trust service-role JWT (cron job calling without our custom token)
    const token = authHeader.replace('Bearer ', '')
    if (token === serviceKey) authorized = true
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const now = Date.now()
    // Windows: 24h ± 15m, 1h ± 15m
    const w24Start = new Date(now + (24 * 60 - 15) * 60_000).toISOString()
    const w24End = new Date(now + (24 * 60 + 15) * 60_000).toISOString()
    const w1Start = new Date(now + (60 - 15) * 60_000).toISOString()
    const w1End = new Date(now + (60 + 15) * 60_000).toISOString()

    // Fetch candidates for both windows
    const { data: candidates24 } = await supabase
      .from('job_interviews')
      .select('id, application_id, scheduled_at, duration_minutes, mode, meeting_link, location, reminder_24h_sent_at, job_applications!inner(applicant_name, applicant_email, jobs!inner(title_en, title_ar))')
      .eq('status', 'scheduled')
      .is('reminder_24h_sent_at', null)
      .gte('scheduled_at', w24Start)
      .lte('scheduled_at', w24End)

    const { data: candidates1 } = await supabase
      .from('job_interviews')
      .select('id, application_id, scheduled_at, duration_minutes, mode, meeting_link, location, reminder_1h_sent_at, job_applications!inner(applicant_name, applicant_email, jobs!inner(title_en, title_ar))')
      .eq('status', 'scheduled')
      .is('reminder_1h_sent_at', null)
      .gte('scheduled_at', w1Start)
      .lte('scheduled_at', w1End)

    const results: Array<{ id: string; window: string; ok: boolean; error?: string }> = []

    const sendReminder = async (interview: any, window: '24h' | '1h') => {
      const app = interview.job_applications
      const jobTitleAr = app?.jobs?.title_ar || app?.jobs?.title_en || ''
      const cairo = formatCairoTime(interview.scheduled_at)
      const modeLabel = interview.mode === 'online' ? 'Online (Video Call)' : interview.mode === 'onsite' ? 'Onsite' : 'Phone'
      const modeLabelAr = interview.mode === 'online' ? 'أونلاين' : interview.mode === 'onsite' ? 'حضوري' : 'هاتفية'
      const locBlock =
        interview.mode === 'online' && interview.meeting_link
          ? `<div><strong>🔗 Meeting link:</strong> <a href="${interview.meeting_link}" style="color:#7c3aed">${interview.meeting_link}</a></div>`
          : interview.mode === 'onsite' && interview.location
            ? `<div><strong>🏢 Location:</strong> ${interview.location}</div>`
            : ''
      const locBlockAr =
        interview.mode === 'online' && interview.meeting_link
          ? `<div><strong>🔗 رابط الاجتماع:</strong> <a href="${interview.meeting_link}" style="color:#7c3aed">${interview.meeting_link}</a></div>`
          : interview.mode === 'onsite' && interview.location
            ? `<div><strong>🏢 المكان:</strong> ${interview.location}</div>`
            : ''

      const reminderWindow = window === '24h' ? 'tomorrow' : 'in 1 hour'
      const reminderWindowAr = window === '24h' ? 'بكرة' : 'بعد ساعة'

      const { error: sendErr } = await supabase.functions.invoke('send-email', {
        body: {
          to: app.applicant_email,
          templateName: 'job-interview-reminder',
          audience: 'staff',
          idempotencyKey: `interview-${interview.id}-reminder-${window}`,
          templateData: {
            applicant_name: app.applicant_name,
            job_title: jobTitleAr,
            interview_time_cairo: `${cairo.date} ${cairo.time}`,
            interview_mode: modeLabel,
            interview_mode_ar: modeLabelAr,
            interview_location_block: locBlock,
            interview_location_block_ar: locBlockAr,
            reminder_window: reminderWindow,
            reminder_window_ar: reminderWindowAr,
          },
        },
      })

      if (sendErr) {
        results.push({ id: interview.id, window, ok: false, error: sendErr.message })
        return
      }

      // Mark sent
      const updateField = window === '24h' ? { reminder_24h_sent_at: new Date().toISOString() } : { reminder_1h_sent_at: new Date().toISOString() }
      await supabase.from('job_interviews').update(updateField).eq('id', interview.id)
      results.push({ id: interview.id, window, ok: true })
    }

    for (const i of (candidates24 || [])) await sendReminder(i, '24h')
    for (const i of (candidates1 || [])) await sendReminder(i, '1h')

    return new Response(
      JSON.stringify({
        success: true,
        processed_24h: candidates24?.length || 0,
        processed_1h: candidates1?.length || 0,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('send-interview-reminders error:', err)
    return new Response(JSON.stringify({ error: 'Internal error', details: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
