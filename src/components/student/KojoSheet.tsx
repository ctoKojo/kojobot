import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, Send, Plus, Flag, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { CodeBlock } from '@/components/quiz/CodeBlock';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import kojobotIcon from '@/assets/kojobot-icon-optimized.webp';

// ─── Types ───────────────────────────────────────────────────
export interface KojoContextMeta {
  contextType: 'map' | 'quest';
  contextTitle?: string;
  contextId?: string;
}

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

interface KojoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextMeta?: KojoContextMeta;
  /** Age bracket string for placeholder personalisation */
  ageBracket?: '6-9' | '10-13' | '14-18';
}

// ─── Helpers ─────────────────────────────────────────────────
function sanitizeMeta(meta?: KojoContextMeta): KojoContextMeta | undefined {
  if (!meta) return undefined;
  if (meta.contextType !== 'map' && meta.contextType !== 'quest') return undefined;
  return {
    contextType: meta.contextType,
    contextTitle: meta.contextTitle?.slice(0, 80),
    contextId: meta.contextId?.slice(0, 80),
  };
}

function contextKey(meta?: KojoContextMeta): string {
  if (!meta) return '_default';
  const id = meta.contextId || 'none';
  return `${meta.contextType}_${id}`;
}

function getPlaceholder(meta?: KojoContextMeta, ageBracket?: string, isRTL?: boolean): string {
  const title = meta?.contextTitle;

  if (ageBracket === '6-9') {
    if (title) return isRTL ? `اسأل Kojo عن ${title} 🤖` : `Ask Kojo about ${title} 🤖`;
    return isRTL ? 'اسأل Kojo عن الدرس ده 🤖' : 'Ask Kojo about this lesson 🤖';
  }
  if (ageBracket === '10-13') {
    if (title) return isRTL ? `اسأل Kojo يديك hint عن ${title}` : `Ask Kojo for a hint about ${title}`;
    return isRTL ? 'اسأل Kojo يديك hint' : 'Ask Kojo for a hint';
  }
  // 14-18 or default
  if (title) return isRTL ? `اسأل Kojo عن approach أو debug لـ ${title}` : `Ask Kojo about approach or debug for ${title}`;
  return isRTL ? 'اسأل Kojo عن approach أو debug' : 'Ask Kojo about approach or debug';
}

// ─── Component ───────────────────────────────────────────────
export function KojoSheet({ open, onOpenChange, contextMeta, ageBracket }: KojoSheetProps) {
  // Per-context conversation tracking
  const [convMap, setConvMap] = useState<Record<string, string | null>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevContextKeyRef = useRef<string>('');

  const { session } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const safeMeta = useMemo(() => sanitizeMeta(contextMeta), [contextMeta]);
  const ctxKey = useMemo(() => contextKey(safeMeta), [safeMeta]);
  const conversationId = convMap[ctxKey] ?? null;

  const setConversationId = useCallback((id: string | null) => {
    setConvMap((prev) => ({ ...prev, [ctxKey]: id }));
  }, [ctxKey]);

  // ── Rate limit countdown ─────────────────────────────────
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const t = setInterval(() => setRateLimitSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [rateLimitSeconds]);

  // ── Context switch: load conversation history ─────────────
  useEffect(() => {
    if (!open) return;
    if (ctxKey === prevContextKeyRef.current) return;
    prevContextKeyRef.current = ctxKey;

    const existingConvId = convMap[ctxKey];
    if (existingConvId) {
      loadConversation(existingConvId);
    } else {
      setMessages([]);
    }
  }, [open, ctxKey]);

  // ── Auto-scroll ──────────────────────────────────────────
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) viewport.scrollTop = viewport.scrollHeight;
      }
    });
  }, [messages, isLoading]);

  // ── Load conversation ────────────────────────────────────
  const loadConversation = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('chatbot_messages')
      .select('id, role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })));
    }
  }, []);

  // ── Load last conversation for this context on first open ─
  useEffect(() => {
    if (!open || conversationId || !session?.user?.id) return;

    const loadLast = async () => {
      const { data } = await supabase
        .from('chatbot_conversations')
        .select('id')
        .eq('student_id', session.user.id)
        .eq('status', 'active')
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setConversationId(data.id);
        loadConversation(data.id);
      }
    };
    loadLast();
  }, [open, conversationId, session?.user?.id, setConversationId, loadConversation]);

  // ── Send message ─────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || isLoading || rateLimitSeconds > 0 || !session?.access_token) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);

    try {
      const body: Record<string, unknown> = {
        message: userMsg,
        conversationId,
      };
      if (safeMeta) body.meta = safeMeta;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-kojo`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          const retryAfter = errData.retry_after_seconds || 60;
          setRateLimitSeconds(retryAfter);
          return;
        }
        if (response.status === 402) {
          toast({
            title: isRTL ? 'خطأ' : 'Error',
            description: isRTL ? 'الخدمة غير متاحة حالياً' : 'Service unavailable',
            variant: 'destructive',
          });
          return;
        }
        throw new Error(errData.error || 'Request failed');
      }

      // Stream SSE
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';
      let receivedMeta = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ') || line.trim() === '') continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);

            if (!receivedMeta && parsed.conversationId) {
              receivedMeta = true;
              if (!conversationId && parsed.conversationId) {
                setConversationId(parsed.conversationId);
              }
              continue;
            }

            if (parsed.token) {
              assistantContent += parsed.token;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && !last.id) {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }

            if (parsed.done) {
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1 && m.role === 'assistant'
                    ? { ...m, id: parsed.messageId || undefined }
                    : m
                )
              );
            }
          } catch {
            // partial JSON
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Chat error:', err);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'حصل خطأ، حاول تاني' : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // ── New conversation ─────────────────────────────────────
  const handleNewConversation = async () => {
    const oldConvId = conversationId;
    setConversationId(null);
    setMessages([]);
    setInput('');

    if (oldConvId) {
      await supabase.from('chatbot_messages').delete().eq('conversation_id', oldConvId);
      await supabase.from('chatbot_reports').delete().eq('conversation_id', oldConvId);
      await supabase.from('chatbot_conversations').delete().eq('id', oldConvId);
    }
  };

  // ── Report ───────────────────────────────────────────────
  const handleReport = async (msg: ChatMessage, idx: number) => {
    if (!msg.id || !conversationId || !session?.user?.id) return;

    const prevMsg = idx > 0 ? messages[idx - 1] : null;
    const contextMessages = [
      prevMsg ? { role: prevMsg.role, content: prevMsg.content } : null,
      { role: msg.role, content: msg.content },
    ].filter(Boolean);

    const { error } = await supabase.from('chatbot_reports').insert({
      student_id: session.user.id,
      conversation_id: conversationId,
      reported_message_id: msg.id,
      context_messages: contextMessages,
    });

    if (error) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'مقدرناش نبعت البلاغ' : 'Failed to report', variant: 'destructive' });
    } else {
      toast({ title: isRTL ? 'تم الإبلاغ' : 'Reported', description: isRTL ? 'شكراً، هنراجع الرسالة دي' : 'Thanks, we will review this' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const placeholder = getPlaceholder(safeMeta, ageBracket, isRTL);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={`flex flex-col ${isMobile ? 'max-h-[85vh]' : 'max-h-[600px] max-w-[420px] mx-auto'}`}
      >
        {/* Header */}
        <DrawerHeader className="flex flex-row items-center gap-2 px-4 py-3 kojo-gradient text-white rounded-t-[10px] shrink-0">
          <img src={kojobotIcon} alt="Kojo" className="h-7 w-7 rounded-full" />
          <DrawerTitle className="font-semibold flex-1 text-white">Kojo</DrawerTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={handleNewConversation} title={isRTL ? 'محادثة جديدة' : 'New chat'}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </DrawerHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 px-3 py-2 min-h-0" ref={scrollRef as any}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12" dir="rtl">
              <MessageCircle className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm whitespace-pre-line">
                {isRTL ? 'أهلاً! أنا Kojo، مساعدك التعليمي 🤖\nاسألني أي سؤال عن المنهج!' : "Hi! I'm Kojo, your learning assistant 🤖\nAsk me anything about the curriculum!"}
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                dir="rtl"
                style={{ unicodeBidi: 'plaintext' }}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown
                      rehypePlugins={[rehypeSanitize]}
                      components={{
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">{children}</a>
                        ),
                        pre: ({ children }) => <div className="not-prose">{children}</div>,
                        code: ({ children }) => {
                          const codeString = String(children).replace(/\n$/, '');
                          const isInline = !codeString.includes('\n') && codeString.length <= 60;
                          if (isInline) {
                            return <code dir="ltr" className="bg-zinc-800 text-zinc-100 px-1.5 py-0.5 rounded text-xs font-mono">{codeString}</code>;
                          }
                          return <CodeBlock code={codeString} className="my-2 text-xs" />;
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}

                {msg.role === 'assistant' && msg.id && (
                  <button onClick={() => handleReport(msg, idx)} className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors" title={isRTL ? 'إبلاغ' : 'Report'}>
                    <Flag className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start mb-3">
              <div className="bg-muted rounded-xl px-4 py-3 flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Rate limit banner */}
        {rateLimitSeconds > 0 && (
          <div className="mx-3 mb-1 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs text-center font-medium" dir={isRTL ? 'rtl' : 'ltr'}>
            {isRTL ? `حاول بعد ${rateLimitSeconds} ثانية ⏳` : `Try again in ${rateLimitSeconds}s ⏳`}
          </div>
        )}

        {/* Input */}
        <div className="px-3 py-2 border-t border-border shrink-0 pb-safe">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="min-h-[40px] max-h-[80px] resize-none text-sm"
              style={{ unicodeBidi: 'plaintext' }}
              rows={1}
              dir="rtl"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isLoading || rateLimitSeconds > 0}
              className="shrink-0 h-10 w-10"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
