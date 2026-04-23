import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIXED_POINTS = 1;
const MAX_QUESTIONS = 20;
const GENERATE_RATE_LIMIT = 5;

interface GeneratedQuestion {
  question_text_ar: string;
  options_ar: string[];
  correct_index: number;
  rationale?: string;
  tags?: string[];
  code_snippet?: string;
  _qid?: string; // internal tracking id
}

interface ValidationResult {
  passed: GeneratedQuestion[]; // questions that passed (may have warnings)
  rejected: { question: GeneratedQuestion; reasons: string[] }[];
  warnings: Record<string, string[]>; // keyed by _qid
}

// ── Banned option phrases ──
const BANNED_PHRASES = ["كل ما سبق", "جميع ما سبق", "لا شيء مما سبق", "ليس أي مما سبق", "كل الإجابات", "لا شيء"];

// ── Eliminable short answers ──
const ELIMINABLE_WORDS = new Set(["فقط", "نعم", "لا", "صح", "غلط", "أبداً", "دائماً", "أكيد"]);

// ── Non-Latin character regex (Arabic, CJK, Cyrillic, etc.) ──
const NON_LATIN_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/;

// ── Detect non-Latin inside code identifiers (outside strings/comments) ──
function hasNonLatinInCodeIdentifiers(code: string): boolean {
  const lines = code.split("\n");
  for (const line of lines) {
    // Skip full-line comments
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;

    // Remove string literals (single, double, triple quotes, backtick templates)
    const withoutStrings = trimmed
      .replace(/"""[\s\S]*?"""/g, "")
      .replace(/'''[\s\S]*?'''/g, "")
      .replace(/`[^`]*`/g, "")
      .replace(/"(?:[^"\\]|\\.)*"/g, "")
      .replace(/'(?:[^'\\]|\\.)*'/g, "")
      // Remove inline comments
      .replace(/#.*$/, "")
      .replace(/\/\/.*$/, "");

    if (NON_LATIN_RE.test(withoutStrings)) return true;
  }
  return false;
}

// ── Check if code has non-Latin inside strings/comments (warning level) ──
function hasNonLatinInCodeStringsOrComments(code: string): boolean {
  // Check strings
  const stringMatches = code.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`/g) || [];
  for (const s of stringMatches) {
    if (NON_LATIN_RE.test(s)) return true;
  }
  // Check comments
  const commentMatches = code.match(/#.*$|\/\/.*$/gm) || [];
  for (const c of commentMatches) {
    if (NON_LATIN_RE.test(c)) return true;
  }
  return false;
}

// ── English ratio in text ──
function englishRatio(text: string): number {
  const cleaned = text.replace(/\s+/g, "");
  if (cleaned.length === 0) return 0;
  const englishChars = (cleaned.match(/[a-zA-Z]/g) || []).length;
  return englishChars / cleaned.length;
}

function validateQuestions(questions: GeneratedQuestion[]): ValidationResult {
  const passed: GeneratedQuestion[] = [];
  const rejected: { question: GeneratedQuestion; reasons: string[] }[] = [];
  const warnings: Record<string, string[]> = {};

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    // Assign internal tracking ID
    q._qid = `q_${i}_${Date.now()}`;
    const hardErrors: string[] = [];
    const qWarnings: string[] = [];

    // ── HARD ERRORS ──

    // 1. Must have exactly 4 options
    if (!q.options_ar || q.options_ar.length !== 4) {
      hardErrors.push("يجب أن يحتوي على 4 اختيارات بالضبط");
      rejected.push({ question: q, reasons: hardErrors });
      continue;
    }

    // 2. correct_index must be 0-3
    if (typeof q.correct_index !== "number" || q.correct_index < 0 || q.correct_index > 3) {
      hardErrors.push("correct_index يجب أن يكون بين 0 و 3");
    }

    // 3. No duplicate options
    const uniqueOptions = new Set(q.options_ar.map((o: string) => o.trim()));
    if (uniqueOptions.size !== 4) {
      hardErrors.push("يوجد اختيارات مكررة");
    }

    // 4. Banned phrases
    for (const opt of q.options_ar) {
      if (BANNED_PHRASES.some(b => opt.includes(b))) {
        hardErrors.push(`اختيار ممنوع: "${opt}"`);
      }
    }

    // 5. Non-Latin in code identifiers (not in strings/comments)
    if (q.code_snippet && hasNonLatinInCodeIdentifiers(q.code_snippet)) {
      hardErrors.push("حروف غير لاتينية في أكواد البرمجة (خارج النصوص والتعليقات)");
    }

    // 6. Code snippet has markdown backticks as block markers → auto-fix (safe)
    if (q.code_snippet) {
      // Only strip leading/trailing ``` block markers, not backticks inside code
      q.code_snippet = q.code_snippet.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();
    }

    // 7. Code snippet too long → hard error at 4000
    if (q.code_snippet && q.code_snippet.length > 4000) {
      hardErrors.push("الكود طويل جداً (أكثر من 4000 حرف)");
    }

    // If any hard errors, reject
    if (hardErrors.length > 0) {
      rejected.push({ question: q, reasons: hardErrors });
      continue;
    }

    // ── WARNINGS ──

    // W1. Non-Latin in code strings/comments
    if (q.code_snippet && hasNonLatinInCodeStringsOrComments(q.code_snippet)) {
      qWarnings.push("نص غير إنجليزي داخل strings أو comments في الكود");
    }

    // W2. English ratio check (dynamic threshold)
    const questionAndOptionsText = q.question_text_ar + " " + q.options_ar.join(" ");
    const ratio = englishRatio(questionAndOptionsText);
    const threshold = q.code_snippet ? 0.40 : 0.25; // Higher tolerance when code exists
    if (ratio > threshold) {
      qWarnings.push(`نسبة الإنجليزي عالية (${Math.round(ratio * 100)}%) — المسموح ${Math.round(threshold * 100)}%`);
    }

    // W3. Option length disparity
    const optLengths = q.options_ar.map((o: string) => o.trim().length);
    const avgLen = optLengths.reduce((a: number, b: number) => a + b, 0) / 4;
    if (avgLen > 0) {
      const shortest = Math.min(...optLengths);
      // Very short option compared to average
      if (shortest < avgLen * 0.15 && avgLen > 5) {
        // Check if it's an eliminable word
        const shortOpts = q.options_ar.filter((o: string) => o.trim().length === shortest);
        const isEliminable = shortOpts.some(o => ELIMINABLE_WORDS.has(o.trim()));
        if (isEliminable) {
          qWarnings.push("اختيار قصير جداً وعام (مثل 'نعم'/'لا') وسط اختيارات طويلة — سهل الحذف");
        } else if (shortest < avgLen * 0.1) {
          qWarnings.push("تفاوت كبير في طول الاختيارات");
        }
      }
    }

    // W4. Code snippet length warning (1200-4000)
    if (q.code_snippet && q.code_snippet.length > 1200) {
      qWarnings.push(`الكود طويل نسبياً (${q.code_snippet.length} حرف)`);
    }

    // Safe auto-fix: truncate code > 2000
    if (q.code_snippet && q.code_snippet.length > 2000) {
      q.code_snippet = q.code_snippet.slice(0, 2000);
    }

    // Add fixed points
    q.points = FIXED_POINTS as any;

    // Clean empty code_snippet
    if (q.code_snippet !== undefined && q.code_snippet !== null) {
      q.code_snippet = q.code_snippet.trim() || undefined;
    }

    passed.push(q);
    if (qWarnings.length > 0) {
      warnings[q._qid] = qWarnings;
    }
  }

  return { passed, rejected, warnings };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      sessionId,
      questionsCount = 10,
      ageGroup = "10-13",
      difficulty = "medium",
      additionalContext = "",
    } = body;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const count = Math.min(Math.max(parseInt(questionsCount) || 10, 5), MAX_QUESTIONS);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit
    const rl = checkRateLimit(`generate-quiz:${user.id}`, { maxRequests: GENERATE_RATE_LIMIT, windowMs: 3600000 });
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    // Fetch session data
    const { data: session, error: sessionError } = await serviceClient
      .from("curriculum_sessions")
      .select("title_ar, description_ar, session_number")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch PDF text from assets table
    const { data: assetData } = await serviceClient
      .from("curriculum_session_assets")
      .select("student_pdf_text")
      .eq("session_id", sessionId)
      .maybeSingle();

    const studentPdfText = assetData?.student_pdf_text || null;

    if (!session.description_ar && !studentPdfText) {
      return new Response(JSON.stringify({ error: "الوصف ونص PDF كلاهما فارغ. لا يمكن توليد أسئلة بدون محتوى." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context
    let contextParts: string[] = [];
    contextParts.push(`عنوان الدرس: ${session.title_ar}`);
    contextParts.push(`رقم الدرس: ${session.session_number}`);
    if (session.description_ar) contextParts.push(`وصف الدرس: ${session.description_ar}`);
    if (studentPdfText) contextParts.push(`محتوى الدرس:\n${studentPdfText}`);
    if (additionalContext && additionalContext.trim().length > 0 && additionalContext.length <= 500) {
      contextParts.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 تعليمات إضافية إلزامية من المدرس (لازم تتنفذ في الأسئلة):
${additionalContext.trim()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ملاحظة: التعليمات اللي فوق دي أولوية قصوى — لازم تظهر بوضوح في الأسئلة المُولّدة. لو طلب المدرس تركيز على موضوع معين، خلي الأسئلة كلها حواليه. لو طلب نوع معين من الأسئلة، التزم بيه.`);
    }

    const difficultyMap: Record<string, string> = {
      easy: `سهل جداً (Easy):
- أسئلة استرجاع وتذكر مباشر للمفاهيم الأساسية فقط
- الإجابة موجودة حرفياً في المحتوى
- بدون تحليل أو ربط بين مفاهيم
- لو فيه code_snippet يكون قصير جداً (سطر أو سطرين كحد أقصى)
- المشتتات (الإجابات الغلط) واضحة وسهل استبعادها
- مثال: "إيه هو الـ variable؟" أو "أنهي حاجة من دي variable؟"`,
      medium: `متوسط (Medium):
- أسئلة فهم وتطبيق محدود
- محتاج المتعلم يفكر شوية ويربط مفهوم بمثال
- لو فيه code_snippet يكون 3-6 أسطر بسيطة
- المشتتات معقولة لكن واحدة منهم واضح إنها غلط
- مثال: "الكود ده هيطبع إيه؟" مع كود بسيط`,
      hard: `صعب (Hard):
- أسئلة تحليل، تتبع تنفيذ كود، أو ربط أكتر من مفهوم
- محتاج تفكير متعدد الخطوات للوصول للإجابة
- لو فيه code_snippet ممكن يكون 6-15 سطر فيه loops أو conditionals متداخلة
- المشتتات كلها قريبة ومعقولة — مفيش مشتت واضح إنه غلط
- ممكن أسئلة "إيه الغلط في الكود؟" أو "إيه أحسن طريقة لـ..."
- اختر مفاهيم متقدمة من المحتوى لو متاحة`,
    };

    const ageGroupMap: Record<string, string> = {
      "6-9": "أطفال من 6 إلى 9 سنوات - استخدم لغة بسيطة جداً",
      "10-13": "أطفال من 10 إلى 13 سنة - لغة واضحة ومباشرة",
      "14-18": "مراهقين من 14 إلى 18 سنة - يمكن استخدام مصطلحات تقنية أكثر",
    };

const systemPrompt = `أنت مدرس متخصص في تعليم الأطفال البرمجة والتكنولوجيا.

قواعد صارمة:
1. اكتب كل الأسئلة والاختيارات بالعامية المصرية (مش فصحى). مثلاً: "إيه اللي هيحصل"، "الكود ده بيعمل إيه"، "أنهي إجابة صح"
2. المصطلحات التقنية الإنجليزية مسموحة داخل النص العربي مثل: variable, loop, function, array, list, print, input, if, else
3. ممنوع أي جملة كاملة بالإنجليزية في نص السؤال أو الاختيارات
4. لكل سؤال 4 اختيارات بالضبط
5. اختيار صحيح واحد فقط (correct_index من 0 إلى 3)
6. ممنوع "كل ما سبق" أو "لا شيء مما سبق" أو "جميع ما سبق"
7. ممنوع تلميحات واضحة في السؤال توصل للإجابة
8. أطوال الاختيارات تكون متقاربة — ممنوع اختيار كلمة واحدة وباقي الاختيارات جمل
9. نوّع الأسئلة:
   - نظرية (بدون كود): "إيه هي الـ List في Python؟"
   - تطبيقية بكود: "الكود ده هيطبع إيه؟"
   - تحليلية: "إيه الغلط في الكود ده؟"
   - سيناريو: "لو عايز تعمل كذا، هتستخدم إيه؟"
   مهم: على الأقل 40% أسئلة نظرية بدون code_snippet.
10. الكود يتحط في code_snippet فقط — raw بدون markdown أو backticks
11. ممنوع عربي داخل code_snippet نهائياً — حتى داخل strings أو comments. استخدم إنجليزي بسيط.
    مثلاً ممنوع: fruits = ["تفاح"] — الصح: fruits = ["apple"]
    ممنوع: # ده بيطبع — الصح: # prints the result
12. الاختيارات الغلط لازم تكون منطقية ومعقولة.

مثال صح ✅:
{
  "question_text_ar": "إيه اللي هيطبعه الكود ده؟",
  "code_snippet": "x = [1, 2, 3]\\nprint(len(x))",
  "options_ar": ["3", "2", "1", "خطأ في الكود"],
  "correct_index": 0
}

مثال غلط ❌ (عربي في الكود + backticks):
{
  "question_text_ar": "إيه نتيجة الكود ده؟",
  "code_snippet": "\`\`\`python\\nfruits = [\\"تفاح\\", \\"موز\\"]\\n# ده بيطبع الفواكه\\nprint(fruits)\`\`\`",
  "options_ar": ["['تفاح', 'موز']", "خطأ", "كل ما سبق", "2"],
  "correct_index": 0
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الفئة العمرية المستهدفة: ${ageGroupMap[ageGroup] || ageGroupMap["10-13"]}

⚡ مستوى الصعوبة المطلوب (التزم به بصرامة في كل سؤال):
${difficultyMap[difficulty] || difficultyMap["medium"]}

عدد الأسئلة المطلوب: ${count}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ملاحظة هامة: مستوى الصعوبة المذكور أعلاه ليس اقتراح — هو إلزامي ولازم ينعكس في:
(أ) عمق التفكير المطلوب للوصول للإجابة
(ب) تعقيد الكود لو فيه code_snippet
(ج) صعوبة استبعاد المشتتات (الإجابات الغلط)
لو طلبت "صعب" وجبت أسئلة بسيطة، السيشن هتتعتبر فاشلة.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const generateWithAI = async (retryMessage?: string): Promise<GeneratedQuestion[]> => {
      const messages: any[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextParts.join("\n\n") },
      ];

      if (retryMessage) {
        messages.push({ role: "user", content: retryMessage });
      }

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          tools: [
            {
              type: "function",
              function: {
                name: "generate_mcq_list",
                description: "Generate a list of multiple choice questions in Arabic",
                parameters: {
                  type: "object",
                  properties: {
                    questions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          question_text_ar: { type: "string", description: "Question text in Arabic" },
                          options_ar: {
                            type: "array",
                            items: { type: "string" },
                            minItems: 4,
                            maxItems: 4,
                            description: "4 answer options in Arabic",
                          },
                          correct_index: { type: "number", description: "Index of correct answer (0-3)" },
                          rationale: { type: "string", description: "Brief explanation for the correct answer" },
                          tags: { type: "array", items: { type: "string" }, description: "Topic tags" },
                          code_snippet: { type: "string", description: "Raw code snippet if the question involves code. No markdown, no backticks, no Arabic. Leave empty/omit if no code needed." },
                        },
                        required: ["question_text_ar", "options_ar", "correct_index"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["questions"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "generate_mcq_list" } },
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) throw new Error("Rate limit exceeded on AI service. Please try again later.");
        if (aiResponse.status === 402) throw new Error("AI credits depleted. Please add credits to continue.");
        const errText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errText);
        throw new Error("Failed to generate questions");
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

      if (!toolCall?.function?.arguments) throw new Error("No tool call response from AI");

      const parsed = JSON.parse(toolCall.function.arguments);
      return parsed.questions || [];
    };

    // ── Attempt 1 ──
    let questions = await generateWithAI();
    let validation = validateQuestions(questions);

    // ── Retry if too many rejected (less than half passed) ──
    const minAcceptable = Math.ceil(count * 0.5);
    if (validation.passed.length < minAcceptable) {
      // Build retry message with specific rejection reasons
      const rejectionSummary = validation.rejected
        .map(r => r.reasons.join("، "))
        .filter((v, i, a) => a.indexOf(v) === i) // deduplicate
        .slice(0, 5)
        .join("\n- ");

      console.log(`Attempt 1: ${validation.passed.length}/${questions.length} passed. Retrying with reasons.`);

      const retryMsg = `الأسئلة السابقة تم رفض ${validation.rejected.length} منها للأسباب التالية:
- ${rejectionSummary}

أعد توليد ${count} سؤال مع تجنب هذه الأخطاء تماماً.
تذكر: عربي فقط، 4 اختيارات بالضبط، ممنوع "كل ما سبق"، الكود بدون backticks أو عربي.`;

      questions = await generateWithAI(retryMsg);
      validation = validateQuestions(questions);

      // If still not enough, return error
      if (validation.passed.length === 0) {
        return new Response(JSON.stringify({
          error: "فشل في توليد أسئلة صالحة بعد محاولتين",
          rejected_count: validation.rejected.length,
          rejection_reasons: validation.rejected.map(r => r.reasons).flat(),
        }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Build response: questions with their warnings, plus rejected report
    const finalQuestions = validation.passed.map(q => ({
      question_text_ar: q.question_text_ar,
      options_ar: q.options_ar,
      correct_index: q.correct_index,
      points: FIXED_POINTS,
      rationale: q.rationale,
      tags: q.tags,
      code_snippet: q.code_snippet || undefined,
      _qid: q._qid,
    }));

    // Map warnings to match final question order (keyed by _qid)
    const finalWarnings: Record<string, string[]> = {};
    for (const q of finalQuestions) {
      if (q._qid && validation.warnings[q._qid]) {
        finalWarnings[q._qid] = validation.warnings[q._qid];
      }
    }

    const rejectedReport = validation.rejected.map(r => ({
      question_preview: r.question.question_text_ar?.slice(0, 60) + "...",
      reasons: r.reasons,
    }));

    const duration = Date.now() - startTime;
    console.log(`generate-quiz: user=${user.id}, session=${sessionId}, passed=${finalQuestions.length}, rejected=${validation.rejected.length}, warnings=${Object.keys(finalWarnings).length}, duration=${duration}ms`);

    return new Response(JSON.stringify({
      questions: finalQuestions,
      warnings: finalWarnings,
      rejected: rejectedReport,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-quiz-questions error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
