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
  "ahmed", "sara", "ali", "omar", "mona", "hassan", "leila", "youssef", "kareem", "faris", "mazen", "mohamed",
  "br", "hr", "div", "span", "p", "img", "src", "href",
  "hello", "world", "hi", "ok", "yes", "no",
  // Common nouns often used as sample data in lists/arrays
  "car", "cars", "bike", "bikes", "plane", "planes", "bus", "train",
  "dog", "dogs", "cat", "cats", "mouse", "bird", "fish", "rabbit", "animal",
  "cup", "plate", "spoon", "fork", "knife", "table", "chair",
  "apple", "banana", "orange", "grape", "lemon", "mango", "fruit",
  "book", "books", "pen", "pencil", "paper", "eraser", "ruler",
  "game", "games", "movie", "movies", "song", "player", "players", "team",
  "pizza", "cake", "milk", "water", "juice", "food", "drink",
  "shirt", "shoe", "shoes", "hat", "bag", "box",
  "house", "school", "park", "door", "window", "room",
  "mother", "father", "brother", "sister", "friend", "teacher", "student",
  "day", "week", "month", "year", "time", "date",
  "big", "small", "fast", "slow", "hot", "cold", "old", "tall", "short",
  "bmw", "mercedes", "audi", "kia", "toyota",
  "history", "english", "art", "music", "sport", "sports",
  "total", "result", "answer", "score", "point", "points", "level",
  "message", "info", "warning", "success", "fail", "pass", "test",
  // Common English words that appear in print statements / output
  "the", "is", "are", "was", "were", "am", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "can", "may", "might",
  "to", "of", "in", "on", "at", "by", "an", "or", "and", "not", "it", "its", "this", "that", "with", "from",
  "first", "second", "third", "last", "final", "after", "before",
  "subject", "subjects", "your", "our", "their", "his", "her",
  "enter", "select", "choose", "press", "click", "type", "show", "display", "check",
  "equal", "equals", "same", "different", "than", "more", "less",
  "all", "each", "every", "any", "some", "many", "much", "few", "only", "also", "just", "then",
  "what", "which", "how", "when", "where", "who", "why",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "welcome", "goodbye", "thanks", "please",
  "correct", "wrong", "right", "left", "up", "down",
  "line", "lines", "step", "steps", "part", "parts", "example", "examples",
  "use", "using", "used", "make", "makes", "made", "give", "gives", "take", "takes",
  "let", "var", "const", "try", "catch", "throw", "switch", "case", "break", "continue", "default",
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
  code_snippet?: string;
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
    const questionAndOptionsText = q.question_text_ar + " " + q.options_ar.join(" ");
    const englishWords = questionAndOptionsText.match(/[a-zA-Z]{2,}/g) || [];
    const nonWhitelisted = englishWords.filter(w => !TECH_TERMS_WHITELIST.has(w.toLowerCase()));
    if (nonWhitelisted.length > 10) {
      errors.push(`Q${qNum}: Too many non-technical English words: ${nonWhitelisted.slice(0, 5).join(", ")}`);
    }

    // Auto-fix: strip Arabic text from code_snippet instead of failing
    if (q.code_snippet) {
      q.code_snippet = q.code_snippet.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u200F\u200E]+/g, '').replace(/""/g, '"placeholder"');
    }

    // Validate: no easily eliminable options (check for very short options vs others)
    const optLengths = q.options_ar.map((o: string) => o.trim().length);
    const avgLen = optLengths.reduce((a: number, b: number) => a + b, 0) / 4;
    // Only flag if 3+ options are very short compared to average (very extreme cases)
    const tooShort = optLengths.filter((l: number) => l < avgLen * 0.2);
    if (tooShort.length >= 3) {
      errors.push(`Q${qNum}: Options have very uneven lengths, suggesting easily eliminable answers`);
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
1. اكتب كل الأسئلة والاختيارات بالعامية المصرية (مش فصحى). مثلاً: "إيه اللي هيحصل"، "الكود ده بيعمل إيه"، "أنهي إجابة صح"
2. المصطلحات التقنية الإنجليزية مسموحة فقط داخل النص مثل: variable, loop, function, array, class, object, python, javascript, html, css, scratch, arduino, sensor, servo, LED, if, else, print, input, output, sprite, block
3. ممنوع أي جملة كاملة بالإنجليزية
4. ممنوع شرح أو تعليق بالإنجليزية
5. لكل سؤال 4 اختيارات بالضبط
6. اختيار صحيح واحد فقط (correct_index من 0 إلى 3)
7. ممنوع "كل ما سبق" أو "لا شيء مما سبق" أو "جميع ما سبق"
8. ممنوع تلميحات واضحة في السؤال توصل للإجابة
9. أطوال الاختيارات تكون متقاربة
10. نوّع الأسئلة بين الأنواع دي:
    - أسئلة مفاهيم نظرية (بدون كود): "إيه هي الـ List في Python؟"، "إيه الفرق بين...؟"
    - أسئلة تطبيقية بكود: "الكود ده هيطبع إيه؟"
    - أسئلة تحليلية: "إيه الغلط في الكود ده؟"
    - أسئلة سيناريو: "لو عايز تعمل كذا، هتستخدم إيه؟"
    مهم جداً: مش كل الأسئلة تكون فيها كود! على الأقل 40% من الأسئلة تكون نظرية بدون code_snippet. خلي code_snippet فاضي (مش موجود) في الأسئلة النظرية.
11. ممنوع أسئلة الحفظ الأعمى فقط
12. إذا كان السؤال يتعلق بكود برمجي أو يحتاج عرض كود، ضع الكود في حقل code_snippet المنفصل. ممنوع وضع الكود داخل نص السؤال question_text_ar. الكود يكون raw بدون markdown أو backticks.
13. حتى لو الكود سطر واحد فقط، يجب وضعه في code_snippet وليس في نص السؤال.
14. ممنوع تماماً وضع أي نص عربي داخل الكود في code_snippet. الكود لازم يكون إنجليزي بالكامل. مثلاً ممنوع: fruits = ["تفاح", "موز"] — الصح: fruits = ["apple", "banana"]
15. الاختيارات الغلط لازم تكون منطقية ومعقولة ومش سهلة الحذف. ممنوع اختيارات سخيفة أو واضح إنها غلط. الطالب لازم يفكر عشان يختار الإجابة الصح.
16. كل الاختيارات لازم تكون من نفس النوع والسياق. مثلاً لو السؤال عن نتيجة كود، كل الاختيارات تكون نتائج محتملة ومعقولة.

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
                          code_snippet: { type: "string", description: "Raw code snippet if the question involves code. No markdown, no backticks. Leave empty if no code needed." },
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

    // Add fixed points and clean code_snippet
    const finalQuestions = questions.map(q => {
      let snippet = q.code_snippet?.trim() || null;
      // Remove markdown backticks if AI added them
      if (snippet) {
        snippet = snippet.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();
        if (snippet.length > 2000) snippet = snippet.slice(0, 2000);
        if (!snippet) snippet = null;
      }
      return {
        ...q,
        points: FIXED_POINTS,
        code_snippet: snippet,
      };
    });

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
