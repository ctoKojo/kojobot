import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Constants
const MAX_MESSAGES_PER_MINUTE = 6;
const MAX_MESSAGES_PER_DAY = 120;
const CONTEXT_WINDOW_SIZE = 10;
const MAX_CHUNKS = 7;
const CHUNK_SIZE = 1500;
const MAX_CODE_LINES = 8;
const SUMMARY_INTERVAL = 20;

const KOJO_SYSTEM_PROMPT = `اسمك Kojo، مساعد تعليمي في أكاديمية Kojobot.
شخصيتك هادية، مشجعة، وتوجيهية.
بتتكلم عربي بسيط (عامية مصرية) مع مصطلحات برمجة بالإنجليزي.
بتسأل أسئلة وتدي hints، مش حلول.

قواعد صارمة:
- لا تعطي حل نهائي أبداً لأي سؤال أو تمرين أو واجب
- ممنوع كود كامل أكتر من 3 سطور - hints وخطوات عامة فقط
- ممنوع تظهر الخيار الصحيح صراحة لأي سؤال اختيار من متعدد
- ممنوع إجابة رقمية نهائية في مسائل
- لو الطالب طلب حل مباشر، ارفض بلطف ووجهه بخطوة صغيرة
- لو السؤال خارج المنهج، قول "ده خارج المنهج الحالي" واقترح موضوع قريب من المنهج
- لو المعلومة مش موجودة في المصادر المتاحة، قول "مش موجود في المنهج الحالي" - لا تخمن أبداً
- لو السؤال حساس أو الطالب متعطل تماماً، ذكّره إنك مساعد تعليمي مش بديل للمدرب واطلب منه يرفق الجزئية اللي وقف عندها أو الخطأ اللي ظهرله

هيكل الرد الثابت (4-8 سطور):
1. فهم سريع للمفهوم
2. سؤال أو اتنين توجيهيين
3. تجربة صغيرة يقيس بيها نفسه

دايماً آخر الرد سؤال واحد عملي محدد للطالب.
مسموح: خطوات عامة، أسئلة إرشادية، تجارب صغيرة.`;

const SUMMARY_PROMPT = `لخص المحادثة التالية كسياق تعليمي في 3-5 سطور:
- ايه المفاهيم اللي اتشرحت
- ايه اللي الطالب فهمه
- ايه اللي لسه واقف فيه
ممنوع تحط أي حلول أو أكواد في الملخص.`;

// ===== Helper Functions =====

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "ايه", "هو", "هي", "دي", "ده", "اللي", "في", "من", "على", "عن",
    "يعني", "ازاي", "ليه", "كيف", "ما", "لو", "مش", "عايز", "محتاج",
    "the", "is", "a", "an", "in", "of", "to", "and", "or", "how", "what",
    "why", "can", "do", "does", "i", "my", "me",
  ]);
  const words = text
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
  return [...new Set(words)];
}

function chunkText(text: string): string[] {
  if (!text || text.length <= CHUNK_SIZE) return text ? [text] : [];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE;
  }
  return chunks;
}

function scoreChunk(chunk: string, keywords: string[]): number {
  const lower = chunk.toLowerCase();
  return keywords.reduce((score, kw) => {
    const idx = lower.indexOf(kw);
    return idx >= 0 ? score + 1 : score;
  }, 0);
}

function enforceResponse(text: string): { cleaned: string; flags: string[] } {
  const flags: string[] = [];

  // Check for code blocks > MAX_CODE_LINES
  const codeBlockRegex = /```[\s\S]*?```/g;
  let cleaned = text.replace(codeBlockRegex, (match) => {
    const lines = match.split("\n");
    if (lines.length - 2 > MAX_CODE_LINES) {
      flags.push("code_block_truncated");
      return "```\n// Kojo بيديك hint بس مش كود كامل 😊\n// جرب تكتب الكود بنفسك خطوة خطوة\n```";
    }
    return match;
  });

  // Check for inline code that looks like a full solution
  const inlineCodeLines = (cleaned.match(/`[^`]+`/g) || []).join("\n").split("\n");
  if (inlineCodeLines.length > MAX_CODE_LINES) {
    flags.push("inline_code_excessive");
  }

  // Check for direct MCQ answers like "الإجابة الصحيحة" or "الخيار الصحيح"
  const directAnswerPatterns = [
    /الإجابة الصحيحة\s*(هي|:)/,
    /الخيار الصحيح\s*(هو|:)/,
    /correct answer\s*(is|:)/i,
    /الجواب\s*(هو|:)/,
  ];
  for (const pattern of directAnswerPatterns) {
    if (pattern.test(cleaned)) {
      flags.push("direct_answer_detected");
      cleaned = cleaned.replace(pattern, "فكر في الإجابة... 🤔");
    }
  }

  return { cleaned, flags };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // ===== Auth =====
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Service client for admin operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // ===== Role check =====
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (roleData?.role !== "student") {
      return new Response(JSON.stringify({ error: "Only students can use Kojo" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Rate limiting =====
    const minuteKey = `chatbot:${userId}:min`;
    const minuteCheck = checkRateLimit(minuteKey, {
      maxRequests: MAX_MESSAGES_PER_MINUTE,
      windowMs: 60_000,
    });
    if (!minuteCheck.allowed) {
      return rateLimitResponse(minuteCheck, corsHeaders);
    }

    const dayKey = `chatbot:${userId}:day`;
    const dayCheck = checkRateLimit(dayKey, {
      maxRequests: MAX_MESSAGES_PER_DAY,
      windowMs: 86_400_000,
    });
    if (!dayCheck.allowed) {
      return rateLimitResponse(dayCheck, corsHeaders);
    }

    // ===== Parse body =====
    const { conversationId, message } = await req.json();
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmedMessage = message.trim().slice(0, 2000);

    // ===== Get student context =====
    const { data: groupData } = await serviceClient
      .from("group_students")
      .select("group_id, groups(level_id, age_group_id)")
      .eq("student_id", userId)
      .eq("is_active", true)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const levelId = (groupData?.groups as any)?.level_id;
    const ageGroupId = (groupData?.groups as any)?.age_group_id;

    // ===== Handle conversation =====
    let convId = conversationId;
    let isNewConversation = false;

    if (convId) {
      // Verify ownership
      const { data: conv } = await serviceClient
        .from("chatbot_conversations")
        .select("id, student_id")
        .eq("id", convId)
        .single();

      if (!conv || conv.student_id !== userId) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Create new conversation with snapshot
      const { data: newConv, error: convError } = await serviceClient
        .from("chatbot_conversations")
        .insert({
          student_id: userId,
          title: trimmedMessage.slice(0, 100),
          level_id: levelId,
          age_group_id: ageGroupId,
        })
        .select("id")
        .single();

      if (convError || !newConv) {
        console.error("Error creating conversation:", convError);
        return new Response(JSON.stringify({ error: "Failed to create conversation" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      convId = newConv.id;
      isNewConversation = true;
    }

    // ===== Save user message =====
    await serviceClient.from("chatbot_messages").insert({
      conversation_id: convId,
      role: "user",
      content: trimmedMessage,
    });

    // ===== Fetch conversation history (window) =====
    const { data: convData } = await serviceClient
      .from("chatbot_conversations")
      .select("summary, level_id, age_group_id")
      .eq("id", convId)
      .single();

    const effectiveLevelId = convData?.level_id || levelId;
    const effectiveAgeGroupId = convData?.age_group_id || ageGroupId;

    const { data: history } = await serviceClient
      .from("chatbot_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    const allMessages = history || [];
    const windowMessages = allMessages.slice(-CONTEXT_WINDOW_SIZE);

    // ===== RAG: Fetch relevant curriculum content =====
    let contextChunks: string[] = [];
    let sourcesUsed: { session_number: number; title_ar: string }[] = [];

    if (effectiveLevelId && effectiveAgeGroupId) {
      const { data: sessions } = await serviceClient
        .from("curriculum_sessions")
        .select("session_number, title_ar, description_ar, student_pdf_text")
        .eq("level_id", effectiveLevelId)
        .eq("age_group_id", effectiveAgeGroupId)
        .eq("is_active", true)
        .order("version", { ascending: false });

      if (sessions && sessions.length > 0) {
        // Deduplicate by session_number (latest version first)
        const seen = new Set<number>();
        const uniqueSessions = sessions.filter((s) => {
          if (seen.has(s.session_number)) return false;
          seen.add(s.session_number);
          return true;
        });

        const keywords = extractKeywords(trimmedMessage);

        // Build chunks from all sessions and score them
        const allChunks: { text: string; score: number; sessionNum: number; titleAr: string }[] = [];

        for (const session of uniqueSessions) {
          const textSources = [session.description_ar, session.student_pdf_text].filter(Boolean);
          const combinedText = textSources.join("\n\n");

          if (!combinedText) continue;

          const chunks = chunkText(combinedText);
          for (const chunk of chunks) {
            const score = scoreChunk(chunk, keywords);
            allChunks.push({
              text: chunk,
              score,
              sessionNum: session.session_number,
              titleAr: session.title_ar,
            });
          }
        }

        // Sort by score and take top chunks
        allChunks.sort((a, b) => b.score - a.score);
        const topChunks = allChunks.slice(0, MAX_CHUNKS).filter((c) => c.score > 0);

        // If no keyword match, take first few chunks from curriculum
        if (topChunks.length === 0) {
          const fallback = allChunks.slice(0, 3);
          contextChunks = fallback.map((c) => c.text);
          sourcesUsed = [...new Map(fallback.map((c) => [c.sessionNum, { session_number: c.sessionNum, title_ar: c.titleAr }])).values()];
        } else {
          contextChunks = topChunks.map((c) => c.text);
          sourcesUsed = [...new Map(topChunks.map((c) => [c.sessionNum, { session_number: c.sessionNum, title_ar: c.titleAr }])).values()];
        }
      }
    }

    // ===== Build AI messages =====
    const systemContent = [
      KOJO_SYSTEM_PROMPT,
      contextChunks.length > 0
        ? `\n\nمحتوى المنهج المتاح (استخدم ده فقط كمرجع):\n${contextChunks.join("\n---\n")}`
        : "\n\nملاحظة: مفيش محتوى منهج متاح حالياً للطالب ده.",
    ].join("");

    const aiMessages: { role: string; content: string }[] = [
      { role: "system", content: systemContent },
    ];

    // Add summary if exists
    if (convData?.summary) {
      aiMessages.push({
        role: "system",
        content: `ملخص المحادثة السابقة:\n${convData.summary}`,
      });
    }

    // Add conversation window
    for (const msg of windowMessages) {
      aiMessages.push({ role: msg.role, content: msg.content });
    }

    // ===== Call AI via Lovable Gateway =====
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: true,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Stream response =====
    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        const reader = aiResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    fullResponse += content;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content, conversationId: convId })}\n\n`));
                  }
                } catch {
                  // skip malformed chunks
                }
              }
            }
          }

          // ===== Enforcement layer =====
          const { cleaned, flags } = enforceResponse(fullResponse);
          const safetyFlags = flags.length > 0 ? flags : null;

          // If enforcement changed the response, send the corrected version
          if (cleaned !== fullResponse) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ corrected: cleaned, conversationId: convId })}\n\n`)
            );
            fullResponse = cleaned;
          }

          // ===== Save assistant message =====
          const tokensEstimate = Math.ceil(fullResponse.length / 4);
          await serviceClient.from("chatbot_messages").insert({
            conversation_id: convId,
            role: "assistant",
            content: fullResponse,
            tokens_estimate: tokensEstimate,
            sources_used: sourcesUsed.length > 0 ? sourcesUsed : null,
            safety_flags: safetyFlags,
          });

          // ===== Update conversation =====
          await serviceClient
            .from("chatbot_conversations")
            .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", convId);

          // ===== Auto-update title after 3 messages =====
          if (allMessages.length === 2) {
            // This is the 3rd message (user's 2nd), update title
            try {
              const titleResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-lite",
                  messages: [
                    { role: "system", content: "اكتب عنوان قصير (3-6 كلمات) بالعربي للمحادثة التالية. ارجع العنوان فقط بدون اي حاجة تانية." },
                    ...windowMessages.slice(0, 4).map(m => ({ role: m.role, content: m.content })),
                  ],
                  max_tokens: 50,
                  temperature: 0.5,
                }),
              });
              if (titleResponse.ok) {
                const titleData = await titleResponse.json();
                const newTitle = titleData.choices?.[0]?.message?.content?.trim().slice(0, 100);
                if (newTitle) {
                  await serviceClient.from("chatbot_conversations").update({ title: newTitle }).eq("id", convId);
                }
              }
            } catch (e) {
              console.error("Title generation failed:", e);
            }
          }

          // ===== Summary every SUMMARY_INTERVAL messages =====
          if (allMessages.length > 0 && allMessages.length % SUMMARY_INTERVAL === 0) {
            try {
              const summaryResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-lite",
                  messages: [
                    { role: "system", content: SUMMARY_PROMPT },
                    ...allMessages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
                  ],
                  max_tokens: 300,
                  temperature: 0.3,
                }),
              });
              if (summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                const summary = summaryData.choices?.[0]?.message?.content?.trim();
                if (summary) {
                  await serviceClient.from("chatbot_conversations").update({ summary }).eq("id", convId);
                }
              }
            } catch (e) {
              console.error("Summary generation failed:", e);
            }
          }

          // Send done signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`));
          controller.close();

          const duration = Date.now() - startTime;
          console.log(`Kojo: user=${userId} conv=${convId} tokens≈${Math.ceil(fullResponse.length / 4)} sources=${sourcesUsed.length} flags=${safetyFlags ? JSON.stringify(safetyFlags) : 'none'} duration=${duration}ms`);
        } catch (err) {
          console.error("Stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chatbot error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
