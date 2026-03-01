import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCairoNow } from "../_shared/cairoTime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_HISTORY = 20;

const SYSTEM_PROMPT = `انت Kojo، صاحب الطالب اللي بيساعده يفهم البرمجة.
بتتكلم عامية مصرية بسيطة جداً.

# قواعدك:
- كل إجابة لازم يكون فيها مثال واقعي من حياة الطالب (زي ألعاب، مدرسة، أكل)
- المصطلحات التقنية سيبها إنجليزي (variable, loop, function, if)
- لو الطالب سأل سؤال كبير، قسمه لأجزاء صغيرة وجاوب على الأول بس
- متكررش نفسك ومتقولش "يعني مثلاً" أو "تخيل معايا" كتير
- لو مش فاهم السؤال، اسأله يوضح

# مثال على أسلوبك:
سؤال: "ايه الـ variable؟"
إجابة: "الـ variable زي الدرج اللي بتحط فيه حاجة. بتديله اسم وبتحط جواه قيمة:
\`x = 5\`
كده x بقى فيه الرقم 5. تقدر تغيره بعدين عادي."`;

// Age-based prompt rules
function getAgePromptRules(minAge: number, maxAge: number): string {
  if (maxAge <= 9) {
    return `\n\n# الفئة العمرية: 6-9
- الحد الأقصى لردك: 4 سطور
- سؤال واحد سهل في نهاية الرد
- أمثلة حياتية بسيطة (ألعاب، حيوانات، أكل)
- خلي الكلام بسيط جداً`;
  }
  if (maxAge <= 13) {
    return `\n\n# الفئة العمرية: 10-13
- الحد الأقصى لردك: 6 سطور
- اشرح خطوة بخطوة
- مثال كود صغير لو مناسب
- شجعه يجرب بنفسه`;
  }
  return `\n\n# الفئة العمرية: 14-18
- الحد الأقصى لردك: 10 سطور
- تشخيص خطأ واقتراح approach
- بدون حلول جاهزة - خليه يفكر
- ممكن تسأله أسئلة debugging`;
}

// Context prompt injection
function getContextPrompt(meta?: { contextType?: string; contextTitle?: string }): string {
  if (!meta) return "";
  const { contextType, contextTitle } = meta;
  if (contextType !== "map" && contextType !== "quest") return "";
  const typeLabel = contextType === "map" ? "الخريطة (Map)" : "مهمة (Quest)";
  let prompt = `\nالطالب حالياً في ${typeLabel}.`;
  if (contextTitle) {
    prompt += `\nالموضوع: ${contextTitle.slice(0, 80)}.`;
  }
  prompt += `\nركز إجابتك على الموضوع ده.\n`;
  return prompt;
}

// ============================================================
// Auth
// ============================================================
function getClaims(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

// ============================================================
// RAG helpers
// ============================================================
const STOPWORDS = new Set([
  "في", "من", "على", "هو", "هي", "إلى", "الى", "عن", "مع",
  "هذا", "هذه", "التي", "الذي", "كان", "لا", "ما", "أن", "ان", "إن",
]);

function normalizeToken(w: string): string {
  return w.replace(/[أإآٱ]/g, "ا").replace(/[ؤ]/g, "و").replace(/[ئ]/g, "ي").replace(/[ة]/g, "ه").replace(/[ى]/g, "ي");
}

function tokenize(text: string): string[] {
  return text
    .split(/[\s\u200B-\u200D\uFEFF.,;:!?()[\]{}"'`\-_/\\|@#$%^&*+=<>~]+/)
    .map((w) => normalizeToken(w.trim()))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function getRelevantContent(query: string, sessions: Array<{ id: string; student_pdf_text: string | null }>): { context: string; sources: Array<{ session_id: string; chunk_index: number }> } {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return { context: "", sources: [] };

  const chunks: Array<{ text: string; sessionId: string; idx: number; score: number }> = [];

  for (const s of sessions) {
    if (!s.student_pdf_text) continue;
    let start = 0;
    let ci = 0;
    while (start < s.student_pdf_text.length) {
      const end = Math.min(start + 650, s.student_pdf_text.length);
      const text = s.student_pdf_text.slice(start, end);
      const tokens = tokenize(text);
      let score = 0;
      for (const t of tokens) if (queryTokens.has(t)) score++;
      if (score > 0) chunks.push({ text, sessionId: s.id, idx: ci, score });
      start = end - 100;
      if (start >= s.student_pdf_text.length) break;
      ci++;
    }
  }

  chunks.sort((a, b) => b.score - a.score);
  const selected = chunks.slice(0, 8);
  let total = 0;
  const final = selected.filter((c) => { total += c.text.length; return total <= 4000; });

  return {
    context: final.map((c) => c.text).join("\n---\n"),
    sources: final.map((c) => ({ session_id: c.sessionId, chunk_index: c.idx })),
  };
}

// ============================================================
// Main
// ============================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const claims = getClaims(token);
    if (!claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const exp = claims.exp as number | undefined;
    if (!exp || exp < Math.floor(Date.now() / 1000)) {
      return new Response(JSON.stringify({ error: "Token expired" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentId = claims.sub as string;
    if (!studentId) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    // Student role check + fetch name
    const [{ data: roleData }, { data: profileData }] = await Promise.all([
      db.from("user_roles").select("role").eq("user_id", studentId).single(),
      db.from("profiles").select("full_name, full_name_ar").eq("user_id", studentId).single(),
    ]);
    if (!roleData || roleData.role !== "student") {
      return new Response(JSON.stringify({ error: "Students only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const studentName = profileData?.full_name_ar || profileData?.full_name || "";

    // Parse body
    const { message, conversationId: inputConvId, meta: rawMeta } = await req.json();
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userMessage = message.trim().slice(0, 2000);

    // Validate meta
    let validMeta: { contextType: string; contextTitle?: string; contextId?: string } | undefined;
    if (rawMeta && typeof rawMeta === "object") {
      const ct = rawMeta.contextType;
      if (ct === "map" || ct === "quest") {
        validMeta = {
          contextType: ct,
          contextTitle: typeof rawMeta.contextTitle === "string" ? rawMeta.contextTitle.slice(0, 80) : undefined,
          contextId: typeof rawMeta.contextId === "string" ? rawMeta.contextId.slice(0, 80) : undefined,
        };
      }
    }

    // Rate limit
    const { data: rateResult, error: rateError } = await db.rpc("check_and_increment_chatbot_rate", { p_student_id: studentId });
    if (rateError) {
      console.error("Rate limit error:", rateError);
      return new Response(JSON.stringify({ error: "Rate limit check failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!rateResult.allowed) {
      return new Response(JSON.stringify({
        error: "rate_limited",
        retry_after_seconds: rateResult.retry_after_seconds,
        minute_remaining: rateResult.minute_remaining,
        daily_remaining: rateResult.daily_remaining,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find student's active group
    const cairo = getCairoNow();
    const { data: studentGroups } = await db
      .from("group_students")
      .select("group_id, groups!inner(id, status, level_id, age_group_id)")
      .eq("student_id", studentId)
      .eq("is_active", true);

    let selectedGroup: { id: string; level_id: string; age_group_id: string } | null = null;
    if (studentGroups && studentGroups.length > 0) {
      const active = studentGroups.find((sg: any) => (sg.groups as any).status === "active");
      const pick = active || studentGroups[0];
      const g = (pick as any).groups as any;
      selectedGroup = { id: g.id, level_id: g.level_id, age_group_id: g.age_group_id };
    }

    // Fetch age group for prompt tuning
    let agePromptRules = "";
    if (selectedGroup?.age_group_id) {
      const { data: ageGroup } = await db
        .from("age_groups")
        .select("min_age, max_age")
        .eq("id", selectedGroup.age_group_id)
        .single();
      if (ageGroup) {
        agePromptRules = getAgePromptRules(ageGroup.min_age, ageGroup.max_age);
      }
    }

    // Conversation
    let conversationId = inputConvId;
    if (!conversationId) {
      const { data: newConv, error: convError } = await db
        .from("chatbot_conversations")
        .insert({
          student_id: studentId,
          level_id: selectedGroup?.level_id || null,
          age_group_id: selectedGroup?.age_group_id || null,
        })
        .select("id")
        .single();

      if (convError) {
        console.error("Conv creation error:", convError);
        return new Response(JSON.stringify({ error: "Failed to create conversation" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      conversationId = newConv.id;
    } else {
      const { data: existingConv } = await db
        .from("chatbot_conversations")
        .select("id, student_id")
        .eq("id", conversationId)
        .single();

      if (!existingConv || existingConv.student_id !== studentId) {
        return new Response(JSON.stringify({ error: "Invalid conversation" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Save user message
    await db.from("chatbot_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: userMessage,
    });

    // Fetch history
    const { data: history } = await db
      .from("chatbot_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY + 1);

    const historyMessages = (history || []).slice(-MAX_HISTORY).map((m: any) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

    // RAG
    let ragContext = "";
    let sourcesUsed: Array<{ session_id: string; chunk_index: number }> = [];

    if (selectedGroup?.level_id && selectedGroup?.age_group_id) {
      const { data: currSessions } = await db
        .from("curriculum_sessions")
        .select("id, student_pdf_text")
        .eq("level_id", selectedGroup.level_id)
        .eq("age_group_id", selectedGroup.age_group_id)
        .eq("is_active", true)
        .not("student_pdf_text", "is", null);

      if (currSessions && currSessions.length > 0) {
        const result = getRelevantContent(userMessage, currSessions);
        ragContext = result.context;
        sourcesUsed = result.sources;
      }
    }

    // Build messages - inject context + age rules before main prompt
    const contextPrompt = getContextPrompt(validMeta);
    const nameLine = studentName ? `\n\nاسم الطالب اللي بتكلمه: ${studentName}. نادِيه باسمه أحياناً عشان يحس إنك صاحبه.` : "";
    const systemContent = [
      contextPrompt,
      SYSTEM_PROMPT,
      agePromptRules,
      nameLine,
      ragContext ? `\n\nمحتوى المنهج:\n${ragContext}` : "",
    ].filter(Boolean).join("");

    const aiMessages = [
      { role: "system", content: systemContent },
      ...historyMessages,
    ];

    // Determine max tokens based on age group
    let maxTokens = 400;
    if (agePromptRules.includes("6-9")) maxTokens = 250;
    else if (agePromptRules.includes("10-13")) maxTokens = 350;

    // Call AI with streaming
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const models = [
      { model: "google/gemini-2.5-flash", maxTokens },
      { model: "openai/gpt-5-mini", maxTokens },
    ];

    let aiResponse: Response | null = null;
    let lastErrorStatus: number | null = null;

    for (const { model, maxTokens: mt } of models) {
      const isOpenAI = model.startsWith("openai/");

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: aiMessages,
          stream: true,
          ...(isOpenAI ? { max_completion_tokens: mt } : { max_tokens: mt }),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`AI error (${model}):`, res.status, errText);
        lastErrorStatus = res.status;
        continue;
      }

      aiResponse = res;
      break;
    }

    if (!aiResponse) {
      if (lastErrorStatus === 429) {
        return new Response(JSON.stringify({ error: "AI rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (lastErrorStatus === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the response through to client, collecting full text for DB save
    const reader = aiResponse.body!.getReader();
    const decoder = new TextDecoder();
    let fullAssistantContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        // Send metadata as first SSE event
        const meta = JSON.stringify({ conversationId, minute_remaining: rateResult.minute_remaining, daily_remaining: rateResult.daily_remaining });
        controller.enqueue(new TextEncoder().encode(`data: ${meta}\n\n`));

        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, newlineIndex);
              buffer = buffer.slice(newlineIndex + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ") || line.trim() === "") continue;

              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (typeof content === "string" && content.length > 0) {
                  fullAssistantContent += content;
                  // Forward as SSE token event
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: content })}\n\n`));
                }
              } catch {
                // partial JSON, skip
              }
            }
          }
        } catch (e) {
          console.error("Stream read error:", e);
        }

        // Save assistant message to DB
        if (!fullAssistantContent) {
          fullAssistantContent = "عذراً، مقدرتش أساعدك دلوقتي. حاول تاني.";
        }

        const { data: savedMsg } = await db.from("chatbot_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: fullAssistantContent,
          sources_used: sourcesUsed.length > 0 ? sourcesUsed : null,
        }).select("id").single();

        // Update conversation
        const updateData: Record<string, unknown> = {
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { count: msgCount } = await db
          .from("chatbot_messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conversationId);

        if (msgCount && msgCount <= 3) {
          const { data: firstMsg } = await db
            .from("chatbot_messages")
            .select("content")
            .eq("conversation_id", conversationId)
            .eq("role", "user")
            .order("created_at", { ascending: true })
            .limit(1)
            .single();
          if (firstMsg) updateData.title = firstMsg.content.slice(0, 50);
        }

        await db.from("chatbot_conversations").update(updateData).eq("id", conversationId);

        // Send done event with message ID
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true, messageId: savedMsg?.id || null })}\n\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });

  } catch (err) {
    console.error("chat-with-kojo error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
