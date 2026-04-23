// Convert a hired application into an employee account.
// Calls existing create-user function, then links converted_employee_id back to the application.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.23.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BodySchema = z.object({
  application_id: z.string().uuid(),
  password: z.string().min(8).max(128),
  hire_role: z.enum(['instructor', 'reception']),
  hire_start_date: z.string(), // YYYY-MM-DD
  base_salary: z.number().nonnegative().max(10_000_000).optional(),
  // Instructor extras
  specialization: z.string().max(200).optional(),
  specialization_ar: z.string().max(200).optional(),
  employment_status: z.enum(['permanent', 'training']).optional(),
  work_type: z.enum(['full_time', 'part_time']).optional(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''))
    const userId = claims?.claims?.sub as string | undefined
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Authorization: admin only (can hire instructor/reception)
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', userId)
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin')
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Only admins can convert applications to employees' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    // Load application
    const { data: app, error: appErr } = await admin
      .from('job_applications')
      .select('id, applicant_name, applicant_email, applicant_phone, status, converted_employee_id')
      .eq('id', body.application_id)
      .maybeSingle()

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: 'Application not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (app.converted_employee_id) {
      return new Response(JSON.stringify({ error: 'Already converted', employee_id: app.converted_employee_id }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Call create-user (forwarding caller auth)
    const createPayload: Record<string, unknown> = {
      email: app.applicant_email,
      password: body.password,
      full_name: app.applicant_name,
      phone: app.applicant_phone || undefined,
      role: body.hire_role,
    }
    if (body.hire_role === 'instructor') {
      createPayload.specialization = body.specialization || null
      createPayload.specialization_ar = body.specialization_ar || null
      createPayload.employment_status = body.employment_status || 'permanent'
      createPayload.work_type = body.work_type || 'full_time'
    }

    const createResp = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        apikey: anonKey,
      },
      body: JSON.stringify(createPayload),
    })
    const createJson = await createResp.json()

    if (!createResp.ok || !createJson.user_id) {
      return new Response(
        JSON.stringify({ error: createJson.error || 'Failed to create employee', details: createJson }),
        { status: createResp.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const newUserId = createJson.user_id as string

    // Optional base_salary insert
    if (body.base_salary !== undefined && body.base_salary > 0) {
      await admin.from('employee_salaries').insert({
        employee_id: newUserId,
        employee_type: body.hire_role,
        base_salary: body.base_salary,
        effective_from: body.hire_start_date,
        is_active: true,
      })
    }

    // Update application
    await admin
      .from('job_applications')
      .update({
        converted_employee_id: newUserId,
        hire_start_date: body.hire_start_date,
        hire_role: body.hire_role,
        status: 'hired',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', body.application_id)

    // Activity log
    await admin.from('activity_logs').insert({
      user_id: userId,
      action: 'convert_application_to_employee',
      entity_type: 'job_application',
      entity_id: body.application_id,
      details: { new_user_id: newUserId, role: body.hire_role },
    })

    return new Response(
      JSON.stringify({
        success: true,
        employee_id: newUserId,
        message: `Employee account created for ${app.applicant_name}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('convert-application-to-employee error:', err)
    return new Response(JSON.stringify({ error: 'Internal error', details: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
