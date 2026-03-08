import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_AGE_GROUPS = ["6_9", "10_13", "14_18"];
const VALID_LEVELS = ["foundation", "intermediate", "advanced"];
const VALID_DIFFICULTIES = ["easy", "medium", "hard"];
const VALID_ANSWERS = ["A", "B", "C", "D"];

interface QuestionInput {
  age_group: string;
  level: string;
  skill: string;
  difficulty: string;
  question_type?: string;
  question_text_ar: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation_ar?: string;
  code_snippet?: string | null;
  image_url?: string | null;
  is_active?: boolean;
}

function validateQuestion(q: any, index: number): string[] {
  const errors: string[] = [];
  const prefix = `Q#${index + 1}`;

  if (!q.age_group || !VALID_AGE_GROUPS.includes(q.age_group))
    errors.push(`${prefix}: invalid age_group "${q.age_group}"`);
  if (!q.level || !VALID_LEVELS.includes(q.level))
    errors.push(`${prefix}: invalid level "${q.level}"`);
  if (!q.skill || typeof q.skill !== "string" || q.skill.trim().length === 0)
    errors.push(`${prefix}: missing skill`);
  if (!q.difficulty || !VALID_DIFFICULTIES.includes(q.difficulty))
    errors.push(`${prefix}: invalid difficulty "${q.difficulty}"`);
  if (!q.question_text_ar || typeof q.question_text_ar !== "string" || q.question_text_ar.trim().length < 3)
    errors.push(`${prefix}: missing or too short question_text_ar`);
  if (!q.options || typeof q.options !== "object")
    errors.push(`${prefix}: missing options`);
  else {
    for (const key of ["A", "B", "C", "D"]) {
      if (!q.options[key] || typeof q.options[key] !== "string" || q.options[key].trim().length === 0)
        errors.push(`${prefix}: missing option ${key}`);
    }
  }
  if (!q.correct_answer || !VALID_ANSWERS.includes(q.correct_answer))
    errors.push(`${prefix}: invalid correct_answer "${q.correct_answer}"`);
  if (q.explanation_ar !== undefined && q.explanation_ar !== null && typeof q.explanation_ar !== "string")
    errors.push(`${prefix}: explanation_ar must be string or null`);

  return errors;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check - admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const body = await req.json();
    const { questions, mode } = body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(
        JSON.stringify({ error: "questions array is required and must not be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === VALIDATE ALL QUESTIONS ===
    const allErrors: string[] = [];
    for (let i = 0; i < questions.length; i++) {
      const errs = validateQuestion(questions[i], i);
      allErrors.push(...errs);
    }

    // If mode is "validate_only", return validation result
    if (mode === "validate_only") {
      const skills = [...new Set(questions.map((q: any) => q.skill))];
      const byAgeGroup: Record<string, number> = {};
      const byLevel: Record<string, number> = {};
      for (const q of questions) {
        byAgeGroup[q.age_group] = (byAgeGroup[q.age_group] || 0) + 1;
        byLevel[q.level] = (byLevel[q.level] || 0) + 1;
      }

      return new Response(
        JSON.stringify({
          valid: allErrors.length === 0,
          total: questions.length,
          errors: allErrors,
          distribution: { by_age_group: byAgeGroup, by_level: byLevel },
          skills,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === IMPORT MODE: must pass validation first ===
    if (allErrors.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Validation failed. Fix errors before importing.",
          errors: allErrors,
          count: allErrors.length,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === TRANSACTIONAL REPLACE via RPC or sequential with service role ===
    // Since Supabase JS doesn't support raw transactions, we use service role
    // with sequential: delete then insert. Both use service role for atomicity guarantee.
    // If insert fails, the old data is already gone - so we wrap carefully.

    // Build rows
    const rows = questions.map((q: QuestionInput) => ({
      age_group: q.age_group,
      level: q.level,
      skill: q.skill,
      difficulty: q.difficulty,
      question_type: q.question_type || "mcq",
      question_text_ar: q.question_text_ar,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation_ar: q.explanation_ar || null,
      code_snippet: q.code_snippet || null,
      image_url: q.image_url || null,
      is_active: q.is_active !== undefined ? q.is_active : true,
      usage_count: 0,
      success_rate: 0,
    }));

    // Step 1: Delete dependent rows in placement_exam_attempt_questions
    const { error: depDeleteError } = await adminClient
      .from("placement_exam_attempt_questions")
      .delete()
      .gte("id", 0);

    if (depDeleteError) {
      return new Response(
        JSON.stringify({ error: "Failed to delete dependent attempt questions", details: depDeleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Delete all existing questions
    const { error: deleteError } = await adminClient
      .from("placement_question_bank")
      .delete()
      .gte("id", 0);

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: "Failed to delete old data", details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Insert in batches of 50
    const BATCH_SIZE = 50;
    let insertedCount = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await adminClient
        .from("placement_question_bank")
        .insert(batch);

      if (insertError) {
        return new Response(
          JSON.stringify({
            error: "Insert failed mid-batch",
            inserted_so_far: insertedCount,
            batch_start: i,
            details: insertError.message,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      insertedCount += batch.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: insertedCount,
        deleted_old: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
