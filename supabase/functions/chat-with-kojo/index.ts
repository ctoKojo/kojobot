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
const CHUNK_SIZE = 650; // target mid-range of 500-800
const CHUNK_OVERLAP = 100;

const STOPWORDS = new Set([
  "في", "من", "على", "هو", "هي", "إلى", "الى", "عن", "مع",
  "هذا", "هذه", "التي", "الذي", "كان", "لا", "ما", "أن", "ان", "إن",
]);

const DIRECT_ANSWER_PATTERNS = /الإجابة هي|الاجابة هي|الخيار الصحيح|الحل هو|الجواب هو|الاجابة الصحيحة|الإجابة الصحيحة/g;

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
- دايماً اختم ردك بسؤال توجيهي واحد`;

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
// Enforcement layer
// ============================================================
function enforceResponse(content: string): { content: string; safetyFlags: string[] } {
  const flags: string[] = [];

  // 1. Truncate code blocks > 8 lines
  const codeBlockRegex = /```[\s\S]*?```/g;
  let enforced = content.replace(codeBlockRegex, (match) => {
    const lines = match.split("\n");
    if (lines.length > 10) { // 10 = 8 code lines + 2 fence lines
      flags.push("code_truncated");
      const header = lines.slice(0, 5).join("\n");
      const footer = lines.slice(-2).join("\n");
      return `${header}\n// ... (الكود اتقطع عشان تفكر في الباقي بنفسك)\n${footer}`;
    }
    return match;
  });

  // 2. Replace direct answer phrases (in Kojo's response only)
  if (DIRECT_ANSWER_PATTERNS.test(enforced)) {
    flags.push("direct_answer_replaced");
    enforced = enforced.replace(
      DIRECT_ANSWER_PATTERNS,
      "خلينا نفكر سوا 🤔"
    );
    // Add guiding question at end if not already present
    if (!enforced.trim().endsWith("؟")) {
      enforced += "\n\nأنهي اختيار شايفه أقرب وليه؟";
    }
  }

  return { content: enforced, safetyFlags: flags };
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

    // Check expiration
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

    // Service client for privileged operations
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

    const userMessage = message.trim().slice(0, 2000); // cap length

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

    // Get student's groups
    const { data: studentGroups } = await serviceClient
      .from("group_students")
      .select("group_id, groups!inner(id, status, level_id, age_group_id)")
      .eq("student_id", studentId)
      .eq("is_active", true);

    let selectedGroup: { id: string; level_id: string; age_group_id: string } | null = null;

    if (studentGroups && studentGroups.length > 0) {
      // Priority 1: Active group with upcoming session
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

      // Priority 2: Any active group
      if (!selectedGroup) {
        const activeGroup = studentGroups.find((sg: any) => (sg.groups as any).status === "active");
        if (activeGroup) {
          const g = activeGroup.groups as any;
          selectedGroup = { id: g.id, level_id: g.level_id, age_group_id: g.age_group_id };
        }
      }

      // Priority 3: Any group
      if (!selectedGroup) {
        const g = (studentGroups[0] as any).groups as any;
        selectedGroup = { id: g.id, level_id: g.level_id, age_group_id: g.age_group_id };
      }
    }

    // ---- Conversation management ----
    let conversationId = inputConvId;

    if (!conversationId) {
      // Create new conversation
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
      // Verify conversation belongs to student
      const { data: existingConv } = await serviceClient
        .from("chatbot_conversations")
        .select("id, student_id")
        .eq("id", conversationId)
        .single();

      if (!existingConv || existingConv.student_id !== studentId) {
        return new Response(JSON.stringify({ error: "Invalid conversation" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ---- Save student message ----
    await serviceClient.from("chatbot_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: userMessage,
    });

    // ---- Fetch history ----
    const { data: history } = await serviceClient
      .from("chatbot_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY + 1); // +1 for the just-saved message

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

    // ---- Build messages for AI ----
    const systemContent = ragContext
      ? `${SYSTEM_PROMPT}\n\nمحتوى المنهج المتاح:\n${ragContext}`
      : SYSTEM_PROMPT;

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
        model: "openai/gpt-5-mini",
        tag: "fallback_compact",
        messages: compactMessages,
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

    // ---- Enforcement layer ----
    const { content: enforcedContent, safetyFlags } = enforceResponse(assistantContent);
    assistantContent = enforcedContent;

    // ---- Save assistant message ----
    const { data: savedMsg } = await serviceClient.from("chatbot_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: assistantContent,
      sources_used: sourcesUsed.length > 0 ? sourcesUsed : null,
      safety_flags: safetyFlags.length > 0 ? safetyFlags : null,
    }).select("id").single();

    // ---- Update conversation metadata ----
    const updateData: Record<string, unknown> = {
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Auto-title after 2nd message
    const { count: msgCount } = await serviceClient
      .from("chatbot_messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conversationId);

    if (msgCount && msgCount <= 3) {
      // Get first user message for title
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
