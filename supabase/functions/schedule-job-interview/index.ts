// Schedule a job interview, build .ics attachment, and send confirmation email.
// Auth: caller must be admin or reception.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.23.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BodySchema = z.object({
  application_id: z.string().uuid(),
  scheduled_at: z.string().datetime(), // ISO UTC
  duration_minutes: z.number().int().min(5).max(480),
  mode: z.enum(['online', 'onsite', 'phone']),
  meeting_link: z.string().url().optional().nullable(),
  location: z.string().min(1).max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

// Format Date to ICS UTC stamp YYYYMMDDTHHMMSSZ
function toIcsUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function buildIcs(opts: {
  uid: string
  start: Date
  end: Date
  summary: string
  description: string
  location: string
  organizerEmail: string
}): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kojobot//Recruitment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(opts.start)}`,
    `DTEND:${toIcsUtc(opts.end)}`,
    `SUMMARY:${escapeIcsText(opts.summary)}`,
    `DESCRIPTION:${escapeIcsText(opts.description)}`,
    `LOCATION:${escapeIcsText(opts.location)}`,
    `ORGANIZER;CN=Kojobot Recruitment:mailto:${opts.organizerEmail}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Interview reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

function formatCairoTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  // Africa/Cairo (UTC+2 / UTC+3 with DST). Use Intl for accuracy.
  const dateFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  return { date: dateFmt.format(d), time: timeFmt.format(d) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''))
    const userId = claims?.claims?.sub as string | undefined
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Authorization: admin or reception
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
    const allowed = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'reception')
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const body = parsed.data

    // Validate online → meeting_link, onsite → location
    if (body.mode === 'online' && !body.meeting_link) {
      return new Response(JSON.stringify({ error: 'meeting_link required for online interviews' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (body.mode === 'onsite' && !body.location) {
      return new Response(JSON.stringify({ error: 'location required for onsite interviews' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Load application + job
    const { data: app, error: appErr } = await admin
      .from('job_applications')
      .select('id, applicant_name, applicant_email, job_id, jobs!inner(title_en, title_ar)')
      .eq('id', body.application_id)
      .maybeSingle()

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: 'Application not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Insert interview
    const { data: interview, error: insertErr } = await admin
      .from('job_interviews')
      .insert({
        application_id: body.application_id,
        scheduled_at: body.scheduled_at,
        duration_minutes: body.duration_minutes,
        mode: body.mode,
        meeting_link: body.meeting_link || null,
        location: body.location || null,
        notes: body.notes || null,
        created_by: userId,
      })
      .select('*')
      .single()

    if (insertErr || !interview) {
      console.error('Insert interview error:', insertErr)
      return new Response(JSON.stringify({ error: 'Failed to create interview', details: insertErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Move application to "interviewing" status if not already
    await admin
      .from('job_applications')
      .update({ status: 'interviewing', reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq('id', body.application_id)

    // Build .ics
    const start = new Date(body.scheduled_at)
    const end = new Date(start.getTime() + body.duration_minutes * 60_000)
    const jobTitle = (app as any).jobs?.title_en || 'Kojobot Job'
    const jobTitleAr = (app as any).jobs?.title_ar || jobTitle
    const locStr =
      body.mode === 'online'
        ? body.meeting_link!
        : body.mode === 'onsite'
          ? body.location!
          : 'Phone call (we will call you)'

    const ics = buildIcs({
      uid: `interview-${interview.id}@kojobot.com`,
      start,
      end,
      summary: `Kojobot Interview: ${jobTitle}`,
      description: `Interview with ${app.applicant_name} for ${jobTitle}.\n\nMode: ${body.mode}\nLocation: ${locStr}${body.notes ? `\n\nNotes: ${body.notes}` : ''}`,
      location: locStr,
      organizerEmail: 'academy@kojobot.com',
    })

    const cairoTimes = formatCairoTime(body.scheduled_at)
    const modeLabel = body.mode === 'online' ? 'Online (Video Call)' : body.mode === 'onsite' ? 'Onsite' : 'Phone'
    const modeLabelAr = body.mode === 'online' ? 'أونلاين (مكالمة فيديو)' : body.mode === 'onsite' ? 'حضوري' : 'هاتفية'
    const locBlock =
      body.mode === 'online'
        ? `<div style="margin-bottom:8px"><strong>🔗 Meeting link:</strong> <a href="${body.meeting_link}" style="color:#7c3aed">${body.meeting_link}</a></div>`
        : body.mode === 'onsite'
          ? `<div style="margin-bottom:8px"><strong>🏢 Location:</strong> ${body.location}</div>`
          : ''
    const locBlockAr =
      body.mode === 'online'
        ? `<div style="margin-bottom:8px"><strong>🔗 رابط الاجتماع:</strong> <a href="${body.meeting_link}" style="color:#7c3aed">${body.meeting_link}</a></div>`
        : body.mode === 'onsite'
          ? `<div style="margin-bottom:8px"><strong>🏢 المكان:</strong> ${body.location}</div>`
          : ''

    // Send email via send-email function (it handles DB-template lookup + logging)
    const emailResp = await admin.functions.invoke('send-email', {
      body: {
        to: app.applicant_email,
        templateName: 'job-interview-scheduled',
        audience: 'staff',
        idempotencyKey: `interview-${interview.id}-scheduled`,
        templateData: {
          applicant_name: app.applicant_name,
          job_title: jobTitleAr, // Arabic preferred for primary audience
          interview_date: cairoTimes.date,
          interview_time_cairo: cairoTimes.time,
          duration_minutes: String(body.duration_minutes),
          interview_mode: modeLabel,
          interview_mode_ar: modeLabelAr,
          interview_location_block: locBlock,
          interview_location_block_ar: locBlockAr,
        },
      },
    })

    if (emailResp.error) {
      console.warn('Email send failed (non-blocking):', emailResp.error)
    }

    // Note: .ics attachment requires a Resend `attachments` array. The current
    // send-email function does not yet pass attachments. We send the email
    // body with all interview details; the .ics is returned in the response
    // for the UI to offer as a download link if desired.
    const icsBase64 = btoa(unescape(encodeURIComponent(ics)))

    return new Response(
      JSON.stringify({
        success: true,
        interview,
        ics_base64: icsBase64,
        email_sent: !emailResp.error,
        email_error: emailResp.error?.message || null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('schedule-job-interview error:', err)
    return new Response(JSON.stringify({ error: 'Internal error', details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
