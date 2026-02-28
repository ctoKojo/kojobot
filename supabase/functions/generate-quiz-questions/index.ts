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

// Technical terms whitelist (allowed in Arabic text)
const TECH_TERMS_WHITELIST = new Set([
  // Programming keywords & concepts
  "variable", "variables", "loop", "loops", "for", "while", "if", "else", "elif",
  "function", "functions", "def", "return", "class", "object", "objects",
  "array", "arrays", "list", "lists", "string", "strings", "integer", "int", "float", "boolean", "bool",
  "python", "java", "javascript", "html", "css", "scratch", "arduino",
  "sensor", "sensors", "servo", "pwm", "led", "leds", "resistor", "breadboard",
  "voltage", "current", "input", "output", "print", "import", "module",
  "true", "false", "none", "null", "undefined", "type", "error",
  "pixel", "pixels", "rgb", "url", "api", "ide", "ui", "ux",
  "bug", "bugs", "debug", "code", "coding", "program", "programming",
  "wifi", "bluetooth", "usb", "cpu", "ram", "rom", "gpu",
  "bit", "byte", "binary", "hex", "algorithm", "data", "database",
  "web", "app", "software", "hardware", "robot", "robotics",
  "sprite", "block", "blocks", "event", "events", "operator", "operators",
  "condition", "conditions", "iteration", "recursion", "parameter", "parameters",
  "syntax", "compile", "compiler", "interpreter", "runtime", "library",
  "framework", "method", "methods", "property", "properties", "attribute",
  "index", "dictionary", "tuple", "set", "stack", "queue",
  "tinkercad", "microbit", "micro:bit", "raspberry", "pi",
  // Common code example words (variable names, sample data in code snippets)
  "x", "y", "z", "a", "b", "c", "d", "i", "j", "n", "my", "new", "name", "age", "num",
  "items", "fruits", "colors", "numbers", "friends", "subjects", "animals", "cities",
  "add", "remove", "insert", "append", "delete", "update", "get", "len", "length", "size", "count",
  "red", "green", "blue", "yellow", "white", "black",
  "math", "science", "arabic",
  "ahmed", "sara", "ali", "omar", "mona",
  "br", "hr", "div", "span", "p", "img", "src", "href",
  "hello", "world", "hi", "ok", "yes", "no",
  "max", "min", "sum", "sort", "range", "map", "filter",
  "file", "open", "close", "read", "write", "save",
  "start", "stop", "run", "end", "next", "back",
  "key", "value", "item", "element", "node", "link",
  "color", "number", "text", "font", "image", "button", "page",
]);

interface GeneratedQuestion {
  question_text_ar: string;
  options_ar: string[];
  correct_index: number;
  rationale?: string;
  tags?: string[];
}

function validateQuestions(questions: GeneratedQuestion[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qNum = i + 1;

    // Must have exactly 4 options
    if (!q.options_ar || q.options_ar.length !== 4) {
      errors.push(`Q${qNum}: Must have exactly 4 options`);
      continue;
    }

    // correct_index must be 0-3
    if (typeof q.correct_index !== "number" || q.correct_index < 0 || q.correct_index > 3) {
      errors.push(`Q${qNum}: correct_index must be 0-3`);
    }

    // No duplicate options
    const uniqueOptions = new Set(q.options_ar.map((o: string) => o.trim()));
    if (uniqueOptions.size !== 4) {
      errors.push(`Q${qNum}: Duplicate options found`);
    }

    // Filter "all of the above" type answers
    const banned = ["كل ما سبق", "جميع ما سبق", "لا شيء مما سبق", "ليس أي مما سبق", "كل الإجابات", "لا شيء"];
    for (const opt of q.options_ar) {
      if (banned.some(b => opt.includes(b))) {
        errors.push(`Q${qNum}: Contains banned option "${opt}"`);
      }
    }

    // Language check: ensure primarily Arabic with only whitelisted English terms
    const allText = q.question_text_ar + " " + q.options_ar.join(" ");
    const englishWords = allText.match(/[a-zA-Z]{2,}/g) || []; // ignore single letters
    const nonWhitelisted = englishWords.filter(w => !TECH_TERMS_WHITELIST.has(w.toLowerCase()));
    if (nonWhitelisted.length > 6) {
      errors.push(`Q${qNum}: Too many non-technical English words: ${nonWhitelisted.slice(0, 5).join(", ")}`);
    }
  }

  return { valid: errors.length === 0, errors };
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
      .select("title_ar, description_ar, session_number, student_pdf_text")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check content availability
    if (!session.description_ar && !session.student_pdf_text) {
      return new Response(JSON.stringify({ error: "الوصف ونص PDF كلاهما فارغ. لا يمكن توليد أسئلة بدون محتوى." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context
    let contextParts: string[] = [];
    contextParts.push(`عنوان الدرس: ${session.title_ar}`);
    contextParts.push(`رقم الدرس: ${session.session_number}`);
    if (session.description_ar) contextParts.push(`وصف الدرس: ${session.description_ar}`);
    if (session.student_pdf_text) contextParts.push(`محتوى الدرس:\n${session.student_pdf_text}`);
    if (additionalContext && additionalContext.length <= 500) {
      contextParts.push(`سياق إضافي: ${additionalContext}`);
    }

    const difficultyMap: Record<string, string> = {
      easy: "سهل - أسئلة مباشرة تقيس الفهم الأساسي",
      medium: "متوسط - أسئلة تحتاج تفكير وتطبيق",
      hard: "صعب - أسئلة تحليلية تحتاج ربط مفاهيم",
    };

    const ageGroupMap: Record<string, string> = {
      "6-9": "أطفال من 6 إلى 9 سنوات - استخدم لغة بسيطة جداً",
      "10-13": "أطفال من 10 إلى 13 سنة - لغة واضحة ومباشرة",
      "14-18": "مراهقين من 14 إلى 18 سنة - يمكن استخدام مصطلحات تقنية أكثر",
    };

    const systemPrompt = `أنت مدرس متخصص في تعليم الأطفال البرمجة والتكنولوجيا.

قواعد صارمة:
1. اكتب كل الأسئلة والاختيارات بالعربي فقط
2. المصطلحات التقنية الإنجليزية مسموحة فقط داخل النص مثل: variable, loop, function, array, class, object, python, javascript, html, css, scratch, arduino, sensor, servo, LED, if, else, print, input, output, sprite, block
3. ممنوع أي جملة كاملة بالإنجليزية
4. ممنوع شرح أو تعليق بالإنجليزية
5. لكل سؤال 4 اختيارات بالضبط
6. اختيار صحيح واحد فقط (correct_index من 0 إلى 3)
7. ممنوع "كل ما سبق" أو "لا شيء مما سبق" أو "جميع ما سبق"
8. ممنوع تلميحات واضحة في السؤال توصل للإجابة
9. أطوال الاختيارات تكون متقاربة
10. نوّع الأسئلة: فهم + تطبيق + تحليل
11. ممنوع أسئلة الحفظ الأعمى فقط

الفئة العمرية: ${ageGroupMap[ageGroup] || ageGroupMap["10-13"]}
مستوى الصعوبة: ${difficultyMap[difficulty] || difficultyMap["medium"]}
عدد الأسئلة المطلوب: ${count}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const generateWithRetry = async (retryMessage?: string): Promise<GeneratedQuestion[]> => {
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
        if (aiResponse.status === 429) {
          throw new Error("Rate limit exceeded on AI service. Please try again later.");
        }
        if (aiResponse.status === 402) {
          throw new Error("AI credits depleted. Please add credits to continue.");
        }
        const errText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errText);
        throw new Error("Failed to generate questions");
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

      if (!toolCall?.function?.arguments) {
        throw new Error("No tool call response from AI");
      }

      const parsed = JSON.parse(toolCall.function.arguments);
      return parsed.questions || [];
    };

    // First attempt
    let questions = await generateWithRetry();
    let validation = validateQuestions(questions);

    // Retry once if validation fails
    if (!validation.valid) {
      console.log(`Validation failed (attempt 1), errors: ${validation.errors.join("; ")}`);
      const retryMsg = `الأسئلة السابقة فيها أخطاء:\n${validation.errors.join("\n")}\n\nأعد توليد الأسئلة مع تصحيح هذه الأخطاء. تذكر: عربي فقط، 4 اختيارات بالضبط، ممنوع "كل ما سبق".`;
      questions = await generateWithRetry(retryMsg);
      validation = validateQuestions(questions);

      if (!validation.valid) {
        console.error(`Validation failed after retry: ${validation.errors.join("; ")}`);
        return new Response(JSON.stringify({
          error: "فشل في توليد أسئلة صالحة بعد محاولتين",
          details: validation.errors,
        }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Add fixed points
    const finalQuestions = questions.map(q => ({
      ...q,
      points: FIXED_POINTS,
    }));

    const duration = Date.now() - startTime;
    console.log(`generate-quiz: user=${user.id}, session=${sessionId}, questions=${finalQuestions.length}, textSize=${(session.student_pdf_text || "").length}, duration=${duration}ms`);

    return new Response(JSON.stringify({ questions: finalQuestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-quiz-questions error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
