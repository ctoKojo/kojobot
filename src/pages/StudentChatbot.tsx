import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { KojoChatSidebar } from '@/components/chatbot/KojoChatSidebar';
import { KojoMessage } from '@/components/chatbot/KojoMessage';
import { KojoSuggestions } from '@/components/chatbot/KojoSuggestions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Bot, Send, Menu, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  last_message_at: string;
  status: string;
}

export default function StudentChatbot() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [convLoading, setConvLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('chatbot_conversations')
      .select('id, title, last_message_at, status')
      .eq('student_id', user.id)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false });
    setConversations((data as Conversation[]) || []);
    setConvLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime subscription for conversation updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chatbot-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chatbot_conversations',
          filter: `student_id=eq.${user.id}`,
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConversations]);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chatbot_messages')
        .select('id, role, content')
        .eq('conversation_id', activeConvId)
        .order('created_at', { ascending: true });
      setMessages((data as Message[]) || []);
    };
    fetchMessages();
  }, [activeConvId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || isLoading) return;

    setInput('');
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingContent('');

    // Optimistic: add user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageText,
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/student-chatbot`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId: activeConvId,
            message: messageText,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        if (response.status === 429) {
          toast({
            title: isRTL ? 'تم تجاوز الحد' : 'Rate limit exceeded',
            description: isRTL ? 'استنى شوية وحاول تاني' : 'Please wait and try again',
            variant: 'destructive',
          });
        } else {
          throw new Error(err.error || 'Failed');
        }
        setIsLoading(false);
        setIsStreaming(false);
        return;
      }

      // Read SSE stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let newConvId = activeConvId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.conversationId && !newConvId) {
                newConvId = data.conversationId;
                setActiveConvId(newConvId);
              }

              if (data.content) {
                fullContent += data.content;
                setStreamingContent(fullContent);
              }

              if (data.corrected) {
                fullContent = data.corrected;
                setStreamingContent(fullContent);
              }

              if (data.done) {
                // Add completed assistant message
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: fullContent,
                  },
                ]);
                setStreamingContent('');
                setIsStreaming(false);

                // If new conversation, set active
                if (newConvId && newConvId !== activeConvId) {
                  setActiveConvId(newConvId);
                }
                fetchConversations();
              }
            } catch {
              // skip
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Chatbot error:', error);
      toast({
        title: isRTL ? 'حصل خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setStreamingContent('');
      setIsStreaming(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  const handleDeleteConversation = async (id: string) => {
    await supabase.from('chatbot_conversations').delete().eq('id', id);
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
    fetchConversations();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sidebar = (
    <KojoChatSidebar
      conversations={conversations}
      activeId={activeConvId}
      onSelect={(id) => {
        setActiveConvId(id);
        setSidebarOpen(false);
      }}
      onNew={handleNewConversation}
      onDelete={handleDeleteConversation}
      loading={convLoading}
    />
  );

  const showSuggestions = messages.length === 0 && !isStreaming;

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Desktop sidebar */}
        {!isMobile && (
          <div className="w-72 shrink-0 h-full">
            {sidebar}
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-background">
            {isMobile && (
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side={isRTL ? 'right' : 'left'} className="w-72 p-0">
                  {sidebar}
                </SheetContent>
              </Sheet>
            )}
            <Bot className="w-6 h-6 text-primary" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold">Kojo</h1>
              <p className="text-xs text-muted-foreground truncate">
                {isRTL ? 'مساعدك التعليمي - بيرد من المنهج الحالي فقط' : 'Your learning assistant - responds from current curriculum only'}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
              <Info className="w-3 h-3" />
              {isRTL ? 'المنهج فقط' : 'Curriculum only'}
            </Badge>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-4">
            {showSuggestions ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold">
                    {isRTL ? 'أهلاً! أنا Kojo 👋' : 'Hi! I\'m Kojo 👋'}
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {isRTL
                      ? 'مساعدك التعليمي هنا عشان أساعدك تفهم الدروس وتوصل للحل بنفسك. اسألني أي سؤال!'
                      : 'Your learning assistant here to help you understand lessons and find solutions yourself. Ask me anything!'}
                  </p>
                </div>
                <KojoSuggestions onSend={handleSend} />
              </div>
            ) : (
              <div className="max-w-2xl mx-auto">
                {messages.map((msg) => (
                  <KojoMessage key={msg.id} role={msg.role} content={msg.content} />
                ))}
                {isStreaming && streamingContent && (
                  <KojoMessage role="assistant" content={streamingContent} isStreaming />
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="border-t bg-background p-4">
            <div className="max-w-2xl mx-auto flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRTL ? 'اسأل Kojo عن الدرس...' : 'Ask Kojo about the lesson...'}
                className="min-h-[44px] max-h-[120px] resize-none rounded-xl"
                dir="rtl"
                style={{ unicodeBidi: 'plaintext' }}
                disabled={isLoading}
                rows={1}
              />
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="shrink-0 rounded-xl h-[44px] w-[44px]"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
