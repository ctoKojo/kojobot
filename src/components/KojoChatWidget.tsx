import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Plus, Flag, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { CodeBlock } from '@/components/quiz/CodeBlock';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import kojobotIcon from '@/assets/kojobot-icon-optimized.webp';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

export function KojoChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isNewChat, setIsNewChat] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { session } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();

  // Auto-scroll on new messages
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    });
  }, [messages, isLoading]);

  // Load conversation history when opening with existing conversation
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

  // Load last active conversation on first open
  useEffect(() => {
    if (!isOpen || conversationId || isNewChat || !session?.user?.id) return;

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
  }, [isOpen, conversationId, isNewChat, session?.user?.id, loadConversation]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !session?.access_token) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-kojo`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: userMsg,
            conversationId,
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));

        if (response.status === 429) {
          const retryAfter = errData.retry_after_seconds || 60;
          toast({
            title: isRTL ? 'حد الرسائل' : 'Rate Limited',
            description: isRTL
              ? `حاول تاني بعد ${retryAfter} ثانية`
              : `Try again in ${retryAfter} seconds`,
            variant: 'destructive',
          });
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

      // Stream SSE response token by token
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';
      let assistantMsgId: string | null = null;
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

            // First event: metadata (conversationId, rate limits)
            if (!receivedMeta && parsed.conversationId) {
              receivedMeta = true;
              if (!conversationId && parsed.conversationId) {
                setConversationId(parsed.conversationId);
                setIsNewChat(false);
              }
              continue;
            }

            // Token event
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

            // Done event with messageId
            if (parsed.done) {
              assistantMsgId = parsed.messageId;
              // Update last message with the real ID
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1 && m.role === 'assistant'
                    ? { ...m, id: assistantMsgId || undefined }
                    : m
                )
              );
            }
          } catch {
            // partial JSON, skip
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

  const handleNewConversation = async () => {
    const oldConvId = conversationId;
    setConversationId(null);
    setIsNewChat(true);
    setMessages([]);
    setInput('');

    // Delete old conversation from database
    if (oldConvId) {
      // Delete messages first (FK dependency), then conversation
      await supabase.from('chatbot_messages').delete().eq('conversation_id', oldConvId);
      await supabase.from('chatbot_reports').delete().eq('conversation_id', oldConvId);
      await supabase.from('chatbot_conversations').delete().eq('id', oldConvId);
    }
  };

  const handleReport = async (msg: ChatMessage, idx: number) => {
    if (!msg.id || !conversationId || !session?.user?.id) return;

    // Get previous user message as context
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
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'مقدرناش نبعت البلاغ' : 'Failed to report',
        variant: 'destructive',
      });
    } else {
      toast({
        title: isRTL ? 'تم الإبلاغ' : 'Reported',
        description: isRTL ? 'شكراً، هنراجع الرسالة دي' : 'Thanks, we will review this',
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button - always bottom-right */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg overflow-hidden hover:scale-105 transition-transform animate-pulse pb-safe"
          aria-label="Open Kojo Chat"
        >
          <img src={kojobotIcon} alt="Kojo" className="h-full w-full object-cover" />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-80 h-[28rem] sm:w-96 flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden pb-safe">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 kojo-gradient text-white shrink-0">
            <img src={kojobotIcon} alt="Kojo" className="h-7 w-7 rounded-full" />
            <span className="font-semibold flex-1">Kojo</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={handleNewConversation}
              title={isRTL ? 'محادثة جديدة' : 'New chat'}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-3 py-2" ref={scrollRef as any}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12" dir="rtl">
                <MessageCircle className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm whitespace-pre-line">
                  {isRTL ? 'أهلاً! أنا Kojo، مساعدك التعليمي 🤖\nاسألني أي سؤال عن المنهج!' : 'Hi! I\'m Kojo, your learning assistant 🤖\nAsk me anything about the curriculum!'}
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  dir="rtl"
                  style={{ unicodeBidi: 'plaintext' }}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown
                        rehypePlugins={[rehypeSanitize]}
                        components={{
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="text-primary underline"
                            >
                              {children}
                            </a>
                          ),
                          pre: ({ children }) => (
                            <div className="not-prose">{children}</div>
                          ),
                          code: ({ className, children }) => {
                            const codeString = String(children).replace(/\n$/, '');
                            const isInline = !codeString.includes('\n');

                            if (isInline) {
                              return (
                                <code dir="ltr" className="bg-zinc-800 text-zinc-100 px-1.5 py-0.5 rounded text-xs font-mono">
                                  {codeString}
                                </code>
                              );
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

                  {/* Report button for assistant messages */}
                  {msg.role === 'assistant' && msg.id && (
                    <button
                      onClick={() => handleReport(msg, idx)}
                      className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                      title={isRTL ? 'إبلاغ' : 'Report'}
                    >
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

          {/* Input */}
          <div className="px-3 py-2 border-t border-border shrink-0">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRTL ? 'اكتب سؤالك...' : 'Type your question...'}
                className="min-h-[40px] max-h-[80px] resize-none text-sm"
                style={{ unicodeBidi: 'plaintext' }}
                rows={1}
                dir="rtl"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="shrink-0 h-10 w-10"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
