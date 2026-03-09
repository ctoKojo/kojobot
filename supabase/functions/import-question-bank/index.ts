import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })

const VALID_SECTIONS = ["section_a", "section_b", "section_c"]
const VALID_TRACK_CATEGORIES = ["software", "hardware"]
const VALID_DIFFICULTIES = ["easy", "medium", "hard"]
const VALID_ANSWERS = ["A", "B", "C", "D"]
const VALID_REVIEW_STATUSES = ["pending", "approved", "rejected", "needs_revision"]

interface QuestionInput {
  section: string
  skill: string
  track_category?: string | null
  question_text_ar: string
  options: Record<string, string>
  correct_answer: string
  code_snippet?: string | null
  image_url?: string | null
  explanation_ar?: string | null
  difficulty?: string
  review_status?: string
  is_active?: boolean
}

function validateQuestion(q: unknown, index: number): string[] {
  const errors: string[] = []
  const p = `Q#${index + 1}`

  if (!q || typeof q !== "object") {
    errors.push(`${p}: not an object`)
    return errors
  }

  const obj = q as Record<string, unknown>

  // section (required)
  if (!obj.section || !VALID_SECTIONS.includes(obj.section as string)) {
    errors.push(`${p}: invalid section "${obj.section}". Must be one of: ${VALID_SECTIONS.join(", ")}`)
  }

  // skill (required)
  if (!obj.skill || typeof obj.skill !== "string" || (obj.skill as string).trim().length === 0) {
    errors.push(`${p}: missing or empty skill`)
  }

  // track_category — required for section_c, must be null/absent for others
  if (obj.section === "section_c") {
    if (!obj.track_category || !VALID_TRACK_CATEGORIES.includes(obj.track_category as string)) {
      errors.push(`${p}: section_c requires track_category (software or hardware)`)
    }
  } else if (obj.track_category && obj.track_category !== null) {
    errors.push(`${p}: track_category must be null for ${obj.section}`)
  }

  // question_text_ar (required, min 3 chars)
  if (!obj.question_text_ar || typeof obj.question_text_ar !== "string" || (obj.question_text_ar as string).trim().length < 3) {
    errors.push(`${p}: missing or too short question_text_ar (min 3 chars)`)
  }

  // options (required, must have A B C D as non-empty strings)
  if (!obj.options || typeof obj.options !== "object" || Array.isArray(obj.options)) {
    errors.push(`${p}: missing or invalid options object`)
  } else {
    const opts = obj.options as Record<string, unknown>
    for (const key of VALID_ANSWERS) {
      if (!opts[key] || typeof opts[key] !== "string" || (opts[key] as string).trim().length === 0) {
        errors.push(`${p}: missing or empty option ${key}`)
      }
    }
    // Check no extra keys
    const extraKeys = Object.keys(opts).filter(k => !VALID_ANSWERS.includes(k))
    if (extraKeys.length > 0) {
      errors.push(`${p}: unexpected option keys: ${extraKeys.join(", ")}`)
    }
  }

  // correct_answer (required, A-D)
  if (!obj.correct_answer || !VALID_ANSWERS.includes(obj.correct_answer as string)) {
    errors.push(`${p}: invalid correct_answer "${obj.correct_answer}". Must be A, B, C, or D`)
  }

  // difficulty (optional, defaults to medium)
  if (obj.difficulty !== undefined && obj.difficulty !== null && !VALID_DIFFICULTIES.includes(obj.difficulty as string)) {
    errors.push(`${p}: invalid difficulty "${obj.difficulty}". Must be: ${VALID_DIFFICULTIES.join(", ")}`)
  }

  // review_status (optional, defaults to pending)
  if (obj.review_status !== undefined && obj.review_status !== null && !VALID_REVIEW_STATUSES.includes(obj.review_status as string)) {
    errors.push(`${p}: invalid review_status "${obj.review_status}". Must be: ${VALID_REVIEW_STATUSES.join(", ")}`)
  }

  // explanation_ar (optional string)
  if (obj.explanation_ar !== undefined && obj.explanation_ar !== null && typeof obj.explanation_ar !== "string") {
    errors.push(`${p}: explanation_ar must be string or null`)
  }

  // code_snippet (optional string)
  if (obj.code_snippet !== undefined && obj.code_snippet !== null && typeof obj.code_snippet !== "string") {
    errors.push(`${p}: code_snippet must be string or null`)
  }

  return errors
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "Missing authorization" }, 401)

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    // Verify admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: "Unauthorized" }, 401)

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()

    if (!roleData) return json({ error: "Admin role required" }, 403)

    // Parse body
    const body = await req.json()
    const { questions, mode } = body

    if (!Array.isArray(questions) || questions.length === 0) {
      return json({ error: "questions array is required and must not be empty" }, 400)
    }

    // ===== VALIDATE ALL =====
    const allErrors: string[] = []
    for (let i = 0; i < questions.length; i++) {
      allErrors.push(...validateQuestion(questions[i], i))
    }

    // Distribution summary
    const bySection: Record<string, number> = {}
    const byTrack: Record<string, number> = {}
    const skills = new Set<string>()
    for (const q of questions) {
      if (q.section) bySection[q.section] = (bySection[q.section] || 0) + 1
      if (q.track_category) byTrack[q.track_category] = (byTrack[q.track_category] || 0) + 1
      if (q.skill) skills.add(q.skill)
    }

    if (mode === "validate_only") {
      return json({
        valid: allErrors.length === 0,
        total: questions.length,
        errors: allErrors,
        distribution: { by_section: bySection, by_track: byTrack },
        skills: [...skills],
      })
    }

    // ===== IMPORT: must pass validation =====
    if (allErrors.length > 0) {
      return json({
        error: "Validation failed. Fix errors before importing.",
        errors: allErrors,
        count: allErrors.length,
      }, 400)
    }

    // Build rows for placement_v2_questions
    const rows = questions.map((q: QuestionInput) => ({
      section: q.section,
      skill: q.skill,
      track_category: q.section === "section_c" ? q.track_category : null,
      question_text_ar: q.question_text_ar,
      options: q.options,
      correct_answer: q.correct_answer,
      code_snippet: q.code_snippet || null,
      image_url: q.image_url || null,
      explanation_ar: q.explanation_ar || null,
      difficulty: q.difficulty || "medium",
      review_status: q.review_status || "pending",
      is_active: q.is_active !== undefined ? q.is_active : true,
      is_archived: false,
      usage_count: 0,
      success_rate: 0,
    }))

    // Insert in batches of 50
    const BATCH_SIZE = 50
    let insertedCount = 0
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const { error: insertError } = await admin
        .from("placement_v2_questions")
        .insert(batch)

      if (insertError) {
        return json({
          error: "Insert failed mid-batch",
          inserted_so_far: insertedCount,
          batch_start: i,
          details: insertError.message,
        }, 500)
      }
      insertedCount += batch.length
    }

    return json({
      success: true,
      imported: insertedCount,
      distribution: { by_section: bySection, by_track: byTrack },
    })

  } catch (err) {
    return json({ error: "Internal error", details: String(err) }, 500)
  }
})
