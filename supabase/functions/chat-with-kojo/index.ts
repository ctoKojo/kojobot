import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCairoNow } from "../_shared/cairoTime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================
// Constants
// ============================================================
const MAX_HISTORY = 10;
const MAX_CHUNKS = 8;
const MAX_CONTEXT_CHARS = 4000;
const CHUNK_SIZE = 650;
const CHUNK_OVERLAP = 100;

const VALID_STEPS = [
  "intro",
  "variable",
  "condition",
  "colon",
  "indented_block",
  "test",
  "complete",
] as const;

const STOPWORDS = new Set([
  "في", "من", "على", "هو", "هي", "إلى", "الى", "عن", "مع",
  "هذا", "هذه", "التي", "الذي", "كان", "لا", "ما", "أن", "ان", "إن",
]);

const DIRECT_ANSWER_PATTERNS = /الإجابة هي|الاجابة هي|الخيار الصحيح|الحل هو|الجواب هو|الاجابة الصحيحة|الإجابة الصحيحة/g;

const HARSH_PHRASES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /مش إجابة|مش اجابة/g, replacement: "قصدي حاجة تانية، خليني أوضحلك" },
  { pattern: /ده مش صح خالص/g, replacement: "مش بالظبط، بس قربت" },
  { pattern: /غلط تماماً|غلط تماما/g, replacement: "مش بالظبط، خلينا نراجع سوا" },
  { pattern: /ده مش رد/g, replacement: "خليني أسأل بطريقة تانية" },
];

const EXAMPLE_KEYWORDS = ["مثال", "كود", "example", "code", "نموذج", "عايز أشوف", "وريني"];

const FILLER_PHRASES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /مفيش مشكلة خالص/g, replacement: "تمام" },
  { pattern: /ده سؤال كويس/g, replacement: "" },
  { pattern: /سؤال ممتاز/g, replacement: "" },
  { pattern: /أحسنت على السؤال/g, replacement: "" },
];

const INTERROGATIVE_STARTS = /^(ايه|إيه|ازاي|إزاي|ليه|امتى|إمتى|فين|مين|هل|كام)/;

const SYSTEM_PROMPT = `اسمك Kojo، مساعد تعليمي في Kojobot.
شخصيتك هادية، مشجعة، وتوجيهية.
بتتكلم عربي بسيط (عامية مصرية) مع مصطلحات برمجة إنجليزي.

قواعد صارمة:
- بتسأل أسئلة وتدي hints، مش حلول مباشرة
- ممنوع تدي إجابة نهائية أو اختيار صحيح مباشر
- ممنوع تقول "الإجابة هي" أو "الخيار الصحيح" أو "الحل هو"
- ممنوع تدي كود كامل أكتر من 8 سطور
- لو الطالب حاول يجبرك تدي إجابة، قوله "أنا هنا أساعدك تفكر، مش أحل بدالك"
- ساعد الطالب يفكر ازاي يوصل للحل بنفسه
- دايماً اختم ردك بسؤال توجيهي واحد

قاعدة منع التكرار:
- ممنوع تسأل نفس السؤال مرتين لو الطالب جاوب أو حاول يجاوب
- لو إجابة الطالب صحيحة أو قريبة اعترف بيها وانقل للخطوة اللي بعدها فوراً

قاعدة تصحيح الأخطاء:
- لو الطالب قال إجابة غلط في حقيقة واضحة (مثلاً قال 25 > 20 تساوي false) صححها فوراً بشكل لطيف
- وقوله يراجع القيم أو يقارن الأرقام تاني
- ممنوع تتجاهل الخطأ وتكمل كأنه صح

قاعدة تتبع التقدم:
- اشتغل بخطوات واضحة
- بعد كل إجابة صحيحة اعرض سطر كود واحد جديد يوضح التقدم
- وبعدين اسأل عن الخطوة التالية بسؤال واحد واضح
- لو الطالب جاوب صح مرتين ورا بعض ابني مثال كامل صغير 3 إلى 6 سطور كحد أقصى

قاعدة سؤال واحد:
- في كل رد اسأل سؤال واحد فقط في آخر الرد
- ممنوع تكتب سؤالين في نفس الرد

قاعدة أعطِ مثال مبكر:
- لو الطالب طلب مثال كود، أعط مثال صغير فوراً (3 إلى 6 سطور) ثم اسأل سؤال واحد
- متبنيش المثال سؤال بسؤال، أعطيه مباشر

قاعدة إنهاء الخطوة:
- لو الطالب وصل للشرط الصحيح (مثلاً temperature > 20) انتقل فوراً لكتابة سطر if كامل مع النقطتين
- ثم نفذ سطر واحد فقط داخل البلوك
- ولا تعيد طلب كتابة نفس السطر مرة أخرى

قاعدة هيكل الرد:
- كل رد لازم يبدأ بتقييم إجابة الطالب: صح، غلط، أو قريب
- لو صح: اعترف وانقل للخطوة اللي بعدها
- لو غلط: صحح بلطف واطلب محاولة تاني بسؤال واحد
- لو قريب: قول "قريب جداً" ووضح الفرق البسيط

قاعدة الإسعاف التعليمي:
- بعد محاولتين فاشلتين من الطالب في نفس النقطة
- قدم scaffold واضح جداً: سطر كود ناقص جزء واحد والطالب يكمله، أو اختيارين، أو hint قوي جداً
- وجرب سؤال أسهل بنقطة واحدة
- لكن ممنوع حل نهائي أبداً

قاعدة اللهجة:
- ممنوع ترد بخشونة أو تقول "ده مش إجابة" أو "ده مش رد"
- لو الطالب كتب حاجة مش متوقعة، قوله "قصدي حاجة تانية، خليني أوضحلك"

قاعدة التقدم الاجباري:
- لو الطالب اجاب اجابتين صح متتاليتين على نفس الهدف الحالي انتقل فورا للتطبيق النهائي بمثال كود صغير 3 الى 6 سطور ولا تسال اسئله اضافيه عن نفس الهدف

قاعدة منع الرجوع:
- لو الطالب جاوب صح على سؤال ممنوع ترجع لنفس السؤال او نفس الهدف مرة اخرى في نفس المحادثة

قاعدة تقليل الحشو:
- ممنوع استخدام عبارات حشو مثل "مفيش مشكلة خالص" او "ده سؤال كويس"
- ابدأ الرد بتقييم اجابة الطالب ثم ادخل في الخطوه التاليه مباشرة

مثال بايثون صحيح:
if temperature > 20:
    print("مرحبا")

مثال بايثون غلط:
if temperature > 20
    print("مرحبا")`;
// ============================================================
// Auth helpers
// ============================================================
function getClaims(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload;
  } catch {
    return null;
  }
}

// ============================================================
// RAG helpers
// ============================================================
function normalizeToken(word: string): string {
  return word
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي");
}

function tokenize(text: string): string[] {
  return text
    .split(/[\s\u200B-\u200D\uFEFF.,;:!?()[\]{}"'`\-_/\\|@#$%^&*+=<>~]+/)
    .map((w) => normalizeToken(w.trim()))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function chunkText(text: string, sessionId: string): Array<{ text: string; sessionId: string; chunkIndex: number }> {
  const chunks: Array<{ text: string; sessionId: string; chunkIndex: number }> = [];
  if (!text || text.length === 0) return chunks;

  let start = 0;
  let idx = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push({ text: text.slice(start, end), sessionId, chunkIndex: idx });
    start = end - CHUNK_OVERLAP;
    if (start >= text.length) break;
    idx++;
  }
  return chunks;
}

function selectRelevantChunks(
  query: string,
  allChunks: Array<{ text: string; sessionId: string; chunkIndex: number }>
): Array<{ text: string; sessionId: string; chunkIndex: number }> {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return allChunks.slice(0, MAX_CHUNKS);

  const scored = allChunks.map((chunk) => {
    const chunkTokens = tokenize(chunk.text);
    let score = 0;
    for (const t of chunkTokens) {
      if (queryTokens.has(t)) score++;
    }
    return { ...chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected: typeof scored = [];
  let totalChars = 0;
  for (const c of scored) {
    if (selected.length >= MAX_CHUNKS) break;
    if (totalChars + c.text.length > MAX_CONTEXT_CHARS) break;
    if (c.score === 0) break;
    selected.push(c);
    totalChars += c.text.length;
  }

  return selected;
}

// ============================================================
// State helpers
// ============================================================
function extractLastQuestion(text: string): string | null {
  const lines = text.split("\n").reverse();
  // First pass: explicit ؟
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.endsWith("؟") && trimmed.length > 5) return trimmed;
  }
  // Second pass: interrogative starts (Kojo sometimes asks without ؟)
  for (const line of lines) {
    const trimmed = line.trim();
    if (INTERROGATIVE_STARTS.test(trimmed) && trimmed.length > 5) return trimmed;
  }
  return null;
}

function isSimilarQuestion(q1: string | null, q2: string | null): boolean {
  if (!q1 || !q2) return false;
  const t1 = new Set(tokenize(q1));
  const t2 = new Set(tokenize(q2));
  if (t1.size === 0 || t2.size === 0) return false;
  let overlap = 0;
  for (const t of t1) {
    if (t2.has(t)) overlap++;
  }
  return overlap / Math.max(t1.size, t2.size) > 0.8;
}

// ============================================================
// Enforcement layer (Layer 3: Post-processing)
// ============================================================
function enforceResponse(
  content: string,
  lastKojoQuestion: string | null,
  userAskedForExample: boolean
): { content: string; safetyFlags: string[]; qualityFlags: string[]; newQuestion: string | null } {
  const safetyFlags: string[] = [];
  const qualityFlags: string[] = [];

  // 1. Truncate code blocks > 8 lines
  const codeBlockRegex = /```[\s\S]*?```/g;
  let enforced = content.replace(codeBlockRegex, (match) => {
    const lines = match.split("\n");
    if (lines.length > 10) {
      safetyFlags.push("code_truncated");
      const header = lines.slice(0, 5).join("\n");
      const footer = lines.slice(-2).join("\n");
      return `${header}\n// ... (الكود اتقطع عشان تفكر في الباقي بنفسك)\n${footer}`;
    }
    return match;
  });

  // 2. Replace direct answer phrases
  if (DIRECT_ANSWER_PATTERNS.test(enforced)) {
    safetyFlags.push("direct_answer_replaced");
    enforced = enforced.replace(DIRECT_ANSWER_PATTERNS, "خلينا نفكر سوا 🤔");
    if (!enforced.trim().endsWith("؟")) {
      enforced += "\n\nأنهي اختيار شايفه أقرب وليه؟";
    }
  }

  // 3. Harsh tone check — replace with gentle alternatives
  for (const { pattern, replacement } of HARSH_PHRASES) {
    if (pattern.test(enforced)) {
      qualityFlags.push("tone_softened");
      enforced = enforced.replace(pattern, replacement);
    }
  }

  // 3b. Filler soft replacement
  for (const { pattern, replacement } of FILLER_PHRASES) {
    if (pattern.test(enforced)) {
      qualityFlags.push("filler_removed");
      enforced = enforced.replace(pattern, replacement);
    }
  }
  // Clean up double spaces/newlines from removals
  enforced = enforced.replace(/  +/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  // 4. Multiple questions trimming — convert extras to statements, keep last one
  const questionParts = enforced.split("؟");
  if (questionParts.length > 2) {
    // More than 1 question mark means 2+ questions
    qualityFlags.push("questions_trimmed");
    // Keep all content but replace intermediate ؟ with .
    const lastQIndex = enforced.lastIndexOf("؟");
    const beforeLast = enforced.slice(0, lastQIndex);
    const afterLast = enforced.slice(lastQIndex);
    enforced = beforeLast.replace(/؟/g, ".") + afterLast;
  }

  // 5. Missing example check — if user asked for example but no code in response
  if (userAskedForExample) {
    const hasCode = enforced.includes("```") || /\b(if|for|while|print|def|class)\b/.test(enforced);
    if (!hasCode) {
      qualityFlags.push("missing_example");
      // Don't auto-insert (could be wrong context), just flag for potential regenerate
    }
  }

  // Extract new question for state tracking
  const newQuestion = extractLastQuestion(enforced);

  return { content: enforced, safetyFlags, qualityFlags, newQuestion };
}

// ============================================================
// Main handler
// ============================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Auth ----
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Invalid token type" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const claims = getClaims(token);
    if (!claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const exp = claims.exp as number | undefined;
    if (!exp || exp < Math.floor(Date.now() / 1000)) {
      return new Response(JSON.stringify({ error: "Token expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentId = claims.sub as string;
    if (!studentId) {
      return new Response(JSON.stringify({ error: "Invalid token claims" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Verify student role
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", studentId)
      .single();

    if (!roleData || roleData.role !== "student") {
      return new Response(JSON.stringify({ error: "Access denied: students only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Parse body ----
    const { message, conversationId: inputConvId } = await req.json();
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userMessage = message.trim().slice(0, 2000);

    // ---- Rate limit ----
    const { data: rateResult, error: rateError } = await serviceClient.rpc(
      "check_and_increment_chatbot_rate",
      { p_student_id: studentId }
    );

    if (rateError) {
      console.error("Rate limit RPC error:", rateError);
      return new Response(JSON.stringify({ error: "Rate limit check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rateResult.allowed) {
      return new Response(
        JSON.stringify({
          error: "rate_limited",
          retry_after_seconds: rateResult.retry_after_seconds,
          minute_remaining: rateResult.minute_remaining,
          daily_remaining: rateResult.daily_remaining,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ---- Active Group Selection ----
    const cairo = getCairoNow();
    const today = cairo.today;
    const nowTime = cairo.timeHHMMSS;

    const { data: studentGroups } = await serviceClient
      .from("group_students")
      .select("group_id, groups!inner(id, status, level_id, age_group_id)")
      .eq("student_id", studentId)
      .eq("is_active", true);

    let selectedGroup: { id: string; level_id: string; age_group_id: string } | null = null;

    if (studentGroups && studentGroups.length > 0) {
      for (const sg of studentGroups) {
        const g = sg.groups as any;
        if (g.status !== "active") continue;

        const { data: upcomingSessions } = await serviceClient
          .from("sessions")
          .select("id, session_date, session_time")
          .eq("group_id", g.id)
          .not("status", "in", '("completed","cancelled")')
          .or(`session_date.gt.${today},and(session_date.eq.${today},session_time.gt.${nowTime})`)
          .order("session_date", { ascending: true })
          .limit(1);

        if (upcomingSessions && upcomingSessions.length > 0) {
          selectedGroup = { id: g.id, level_id: g.level_id, age_group_id: g.age_group_id };
          break;
        }
      }

      if (!selectedGroup) {
        const activeGroup = studentGroups.find((sg: any) => (sg.groups as any).status === "active");
        if (activeGroup) {
          const g = activeGroup.groups as any;
          selectedGroup = { id: g.id, level_id: g.level_id, age_group_id: g.age_group_id };
        }
      }

      if (!selectedGroup) {
        const g = (studentGroups[0] as any).groups as any;
        selectedGroup = { id: g.id, level_id: g.level_id, age_group_id: g.age_group_id };
      }
    }

    // ---- Conversation management ----
    let conversationId = inputConvId;
    let currentStep: string | null = null;
    let lastKojoQuestion: string | null = null;

    if (!conversationId) {
      const { data: newConv, error: convError } = await serviceClient
        .from("chatbot_conversations")
        .insert({
          student_id: studentId,
          level_id: selectedGroup?.level_id || null,
          age_group_id: selectedGroup?.age_group_id || null,
        })
        .select("id")
        .single();

      if (convError) {
        console.error("Conversation creation error:", convError);
        return new Response(JSON.stringify({ error: "Failed to create conversation" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      conversationId = newConv.id;
    } else {
      // Verify conversation belongs to student + read state
      const { data: existingConv } = await serviceClient
        .from("chatbot_conversations")
        .select("id, student_id, current_step, last_kojo_question")
        .eq("id", conversationId)
        .single();

      if (!existingConv || existingConv.student_id !== studentId) {
        return new Response(JSON.stringify({ error: "Invalid conversation" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      currentStep = (existingConv as any).current_step || null;
      lastKojoQuestion = (existingConv as any).last_kojo_question || null;
    }

    // ---- Save student message ----
    await serviceClient.from("chatbot_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: userMessage,
    });

    // ---- Check if user asked for example ----
    const userAskedForExample = EXAMPLE_KEYWORDS.some((kw) =>
      userMessage.includes(kw)
    );

    // ---- Fetch history ----
    const { data: history } = await serviceClient
      .from("chatbot_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY + 1);

    const historyMessages = (history || []).slice(-(MAX_HISTORY)).map((m: any) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

    // ---- RAG: fetch curriculum content ----
    let ragContext = "";
    let sourcesUsed: Array<{ session_id: string; chunk_index: number }> = [];

    if (selectedGroup?.level_id && selectedGroup?.age_group_id) {
      const { data: curriculumSessions } = await serviceClient
        .from("curriculum_sessions")
        .select("id, student_pdf_text, session_number, title")
        .eq("level_id", selectedGroup.level_id)
        .eq("age_group_id", selectedGroup.age_group_id)
        .eq("is_active", true)
        .not("student_pdf_text", "is", null);

      if (curriculumSessions && curriculumSessions.length > 0) {
        const allChunks: Array<{ text: string; sessionId: string; chunkIndex: number }> = [];
        for (const cs of curriculumSessions) {
          if (cs.student_pdf_text) {
            const chunks = chunkText(cs.student_pdf_text, cs.id);
            allChunks.push(...chunks);
          }
        }

        const relevant = selectRelevantChunks(userMessage, allChunks);
        if (relevant.length > 0) {
          ragContext = relevant.map((c) => c.text).join("\n---\n");
          sourcesUsed = relevant.map((c) => ({
            session_id: c.sessionId,
            chunk_index: c.chunkIndex,
          }));
        }
      }
    }

    // ---- Layer 2: Build state-aware system content ----
    let systemContent = ragContext
      ? `${SYSTEM_PROMPT}\n\nمحتوى المنهج المتاح:\n${ragContext}`
      : SYSTEM_PROMPT;

    // Inject conversation state
    if (currentStep || lastKojoQuestion) {
      let stateBlock = "\n\n[حالة المحادثة]";
      if (currentStep) {
        stateBlock += `\nالخطوة الحالية: ${currentStep}`;
      }
      if (lastKojoQuestion) {
        stateBlock += `\nآخر سؤال سألته: ${lastKojoQuestion}`;
        stateBlock += "\nتعليمات: لا تكرر هذا السؤال. انقل للخطوة التالية.";
      }
      systemContent += stateBlock;
    }

    const aiMessages = [
      { role: "system", content: systemContent },
      ...historyMessages,
    ];

    // ---- Call AI ----
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const compactMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...historyMessages.slice(-4),
    ];

    const attempts: Array<{
      model: string;
      tag: string;
      messages: Array<{ role: string; content: string }>;
    }> = [
      {
        model: "google/gemini-2.5-flash",
        tag: "primary_with_rag",
        messages: aiMessages,
      },
      {
        model: "google/gemini-2.5-flash-lite",
        tag: "fallback_compact",
        messages: compactMessages,
      },
      {
        model: "google/gemini-2.5-flash",
        tag: "history_reset",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      },
    ];

    let assistantContent = "";
    let lastErrorStatus: number | null = null;
    let lastErrorText = "";

    for (const attempt of attempts) {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: attempt.model,
          messages: attempt.messages,
          stream: false,
          max_tokens: 500,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`AI gateway error [${attempt.tag}] (${attempt.model}):`, aiResponse.status, errText);
        lastErrorStatus = aiResponse.status;
        lastErrorText = errText;
        continue;
      }

      const aiData = await aiResponse.json();
      console.log(
        `AI response [${attempt.tag}] (${attempt.model}) keys:`,
        Object.keys(aiData),
        "choices:",
        aiData.choices?.length
      );

      const rawContent = aiData.choices?.[0]?.message?.content;
      const normalizedContent = typeof rawContent === "string" ? rawContent.trim() : "";

      if (normalizedContent.length > 0) {
        assistantContent = normalizedContent;
        break;
      }

      console.error(
        `AI returned empty content [${attempt.tag}] (${attempt.model}). Full response:`,
        JSON.stringify(aiData).slice(0, 1000)
      );
    }

    if (!assistantContent) {
      if (lastErrorStatus === 429) {
        return new Response(JSON.stringify({ error: "AI rate limited, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (lastErrorStatus === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (lastErrorStatus) {
        console.error("All AI attempts failed. Last error:", lastErrorStatus, lastErrorText);
      }
      assistantContent = "عذراً، مقدرتش أساعدك دلوقتي. حاول تاني.";
    }

    // ---- Layer 3: Enforcement + post-processing ----
    const { content: enforcedContent, safetyFlags, qualityFlags, newQuestion } =
      enforceResponse(assistantContent, lastKojoQuestion, userAskedForExample);
    assistantContent = enforcedContent;

    // Check for duplicate question against last 3 Kojo questions — regenerate once
    const recentKojoQuestions: string[] = [];
    if (lastKojoQuestion) recentKojoQuestions.push(lastKojoQuestion);
    for (const msg of [...historyMessages].reverse()) {
      if (msg.role === "assistant" && recentKojoQuestions.length < 3) {
        const q = extractLastQuestion(msg.content);
        if (q && !recentKojoQuestions.includes(q)) recentKojoQuestions.push(q);
      }
    }

    let regenerated = false;
    const isDuplicate = newQuestion && recentKojoQuestions.some(q => isSimilarQuestion(newQuestion, q));
    if (isDuplicate) {
      qualityFlags.push("question_repeated");
      console.log("Duplicate question detected, regenerating once...");

      // Single regeneration attempt with explicit instruction
      const regenMessages = [
        { role: "system", content: systemContent + "\n\nتنبيه: آخر سؤال كان مكرر. اسأل سؤال مختلف تماماً وانقل للخطوة التالية." },
        ...historyMessages,
      ];

      try {
        const regenResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: regenMessages,
            stream: false,
            max_tokens: 500,
          }),
        });

        if (regenResponse.ok) {
          const regenData = await regenResponse.json();
          const regenContent = regenData.choices?.[0]?.message?.content;
          if (typeof regenContent === "string" && regenContent.trim().length > 0) {
            // Re-enforce the regenerated response
            const regenEnforced = enforceResponse(regenContent.trim(), lastKojoQuestion, userAskedForExample);
            assistantContent = regenEnforced.content;
            // Merge flags
            safetyFlags.push(...regenEnforced.safetyFlags);
            qualityFlags.push(...regenEnforced.qualityFlags);
            regenerated = true;
          }
        }
      } catch (regenErr) {
        console.error("Regeneration failed:", regenErr);
      }
    }

    // Extract final question for state update
    const finalQuestion = extractLastQuestion(assistantContent);

    // ---- Merge flags ----
    const allFlags: Record<string, unknown> = {};
    if (safetyFlags.length > 0) allFlags.safety = safetyFlags;
    if (qualityFlags.length > 0) allFlags.quality = qualityFlags;

    // ---- Save assistant message ----
    const { data: savedMsg } = await serviceClient.from("chatbot_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: assistantContent,
      sources_used: sourcesUsed.length > 0 ? sourcesUsed : null,
      safety_flags: Object.keys(allFlags).length > 0 ? allFlags : null,
    }).select("id").single();

    // ---- Update conversation metadata + state ----
    const updateData: Record<string, unknown> = {
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_kojo_question: finalQuestion ? finalQuestion.slice(0, 200) : null,
    };

    // Auto-title after 2nd message
    const { count: msgCount } = await serviceClient
      .from("chatbot_messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conversationId);

    if (msgCount && msgCount <= 3) {
      const { data: firstMsg } = await serviceClient
        .from("chatbot_messages")
        .select("content")
        .eq("conversation_id", conversationId)
        .eq("role", "user")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (firstMsg) {
        updateData.title = firstMsg.content.slice(0, 50);
      }
    }

    await serviceClient
      .from("chatbot_conversations")
      .update(updateData)
      .eq("id", conversationId);

    // ---- Return response ----
    return new Response(
      JSON.stringify({
        message: assistantContent,
        conversationId,
        messageId: savedMsg?.id || null,
        minute_remaining: rateResult.minute_remaining,
        daily_remaining: rateResult.daily_remaining,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("chat-with-kojo error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
