import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageSquarePlus, Send, ArrowLeft, Check, CheckCheck, WifiOff, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTypingIndicator, useRealtimeTyping } from '@/hooks/useRealtimeMessages';
import { queueMessage, getQueue, flushQueue } from '@/lib/offlineQueue';
import { requestNotificationPermission, getNotificationPermission } from '@/lib/browserNotifications';
import type { ConversationItem } from './ConversationList';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  deleted_at: string | null;
}

interface Props {
  selectedConversation: string | null;
  conversationData: ConversationItem | undefined;
  onBack: () => void;
  isRTL: boolean;
  userId: string | undefined;
}

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const getRoleBadgeSmall = (role: string | undefined, isRTL: boolean) => {
  if (!role) return null;
  const labels: Record<string, { en: string; ar: string }> = {
    admin: { en: 'Admin', ar: 'مشرف' },
    instructor: { en: 'Instructor', ar: 'مدرب' },
    student: { en: 'Student', ar: 'طالب' },
    reception: { en: 'Reception', ar: 'استقبال' },
  };
  const info = labels[role];
  if (!info) return null;
  return (
    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-normal">
      {isRTL ? info.ar : info.en}
    </Badge>
  );
};

function DateSeparator({ date, isRTL }: { date: Date; isRTL: boolean }) {
  let label: string;
  if (isToday(date)) {
    label = isRTL ? 'اليوم' : 'Today';
  } else if (isYesterday(date)) {
    label = isRTL ? 'أمس' : 'Yesterday';
  } else {
    label = format(date, 'dd MMM yyyy', { locale: isRTL ? ar : undefined });
  }
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground font-medium px-2">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function TypingIndicator({ conversationId, userId, isRTL, participants }: {
  conversationId: string;
  userId: string;
  isRTL: boolean;
  participants: Record<string, any>;
}) {
  const { data: typingUsers = [] } = useQuery({
    queryKey: ['typing', conversationId],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 4000).toISOString();
      const { data } = await supabase
        .from('typing_indicators')
        .select('user_id, updated_at')
        .eq('conversation_id', conversationId)
        .neq('user_id', userId)
        .gt('updated_at', cutoff);
      return data || [];
    },
    refetchInterval: 2000,
  });

  useRealtimeTyping(conversationId, userId);

  if (typingUsers.length === 0) return null;

  const typer = participants[typingUsers[0].user_id];
  const name = isRTL ? (typer?.full_name_ar || typer?.full_name || '') : (typer?.full_name || '');

  return (
    <div className="flex items-center gap-2 px-4 py-1">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-muted-foreground">
        {name} {isRTL ? 'يكتب...' : 'is typing...'}
      </span>
    </div>
  );
}

export function ChatArea({ selectedConversation, conversationData, onBack, isRTL, userId }: Props) {
  const [messageText, setMessageText] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { sendTyping, clearTyping } = useTypingIndicator(userId, selectedConversation);

  // Track online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushQueue().then(sent => {
        if (sent > 0) {
          toast.success(isRTL ? `تم إرسال ${sent} رسائل مؤجلة` : `Sent ${sent} queued messages`);
          setOptimisticMessages([]);
          queryClient.invalidateQueries({ queryKey: ['messages'] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isRTL, queryClient]);

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ['messages', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: true });
      return (data || []) as Message[];
    },
    enabled: !!selectedConversation,
  });

  // Combine real + optimistic messages
  const allMessages = [
    ...messages,
    ...optimisticMessages.filter(om => !messages.find(m => m.id === om.id)),
  ];

  // Mark as read
  useEffect(() => {
    if (selectedConversation && userId) {
      supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', selectedConversation)
        .eq('user_id', userId)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
        });
    }
  }, [selectedConversation, messages.length]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  // Send message
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!selectedConversation || !messageText.trim() || !userId) return;
      const content = messageText.trim();

      if (!isOnline) {
        // Queue for offline sending
        const queued = queueMessage(selectedConversation, content, userId);
        setOptimisticMessages(prev => [...prev, {
          id: queued.id,
          conversation_id: selectedConversation,
          sender_id: userId,
          content,
          created_at: new Date().toISOString(),
          is_read: false,
          deleted_at: null,
        }]);
        setMessageText('');
        return;
      }

      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation,
        sender_id: userId,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessageText('');
      clearTyping();
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: () => toast.error(isRTL ? 'فشل إرسال الرسالة' : 'Failed to send message'),
  });

  const participantProfiles = Object.fromEntries(
    (conversationData?.participants || []).map(p => [p.user_id, p])
  );

  // Read receipts
  const getReadStatus = (msg: Message) => {
    if (msg.sender_id !== userId) return null;
    const otherParticipant = conversationData?.participants.find(p => p.user_id !== userId);
    if (!otherParticipant?.last_read_at) return 'sent';
    return new Date(otherParticipant.last_read_at) >= new Date(msg.created_at) ? 'read' : 'sent';
  };

  // Notification permission
  const notifPerm = getNotificationPermission();

  if (!selectedConversation || !conversationData) {
    return (
      <Card className={cn('flex-1 flex flex-col', !selectedConversation && 'hidden md:flex')}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquarePlus className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{isRTL ? 'اختر محادثة أو ابدأ واحدة جديدة' : 'Select a conversation or start a new one'}</p>
          </div>
        </div>
      </Card>
    );
  }

  const other = conversationData.participants.find(p => p.user_id !== userId) || conversationData.participants[0];

  return (
    <Card className={cn('flex-1 flex flex-col', !selectedConversation && 'hidden md:flex')}>
      {/* Header */}
      <CardHeader className="pb-3 border-b flex-row items-center gap-3 space-y-0">
        <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
          <ArrowLeft className={cn('h-5 w-5', isRTL && 'rotate-180')} />
        </Button>
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={other.avatar_url || ''} />
          <AvatarFallback className="text-xs">{getInitials(other.full_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base truncate">
              {isRTL ? (other.full_name_ar || other.full_name) : other.full_name}
            </CardTitle>
            {getRoleBadgeSmall(other.role, isRTL)}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isOnline && (
            <Badge variant="destructive" className="text-[10px] gap-1">
              <WifiOff className="h-3 w-3" />
              {isRTL ? 'غير متصل' : 'Offline'}
            </Badge>
          )}
          {notifPerm === 'default' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={async () => {
                await requestNotificationPermission();
                queryClient.invalidateQueries();
              }}
              title={isRTL ? 'تفعيل الإشعارات' : 'Enable notifications'}
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-destructive/10 text-destructive text-xs text-center py-1.5 px-4">
          {isRTL ? 'أنت غير متصل. الرسائل سيتم إرسالها عند عودة الاتصال.' : "You're offline. Messages will be sent when you reconnect."}
        </div>
      )}

      {/* Messages */}
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full p-4">
          <div className="space-y-1">
            {allMessages.map((msg, idx) => {
              const isMine = msg.sender_id === userId;
              const sender = participantProfiles[msg.sender_id];
              const prevMsg = allMessages[idx - 1];
              const showDateSep = !prevMsg || !isSameDay(new Date(msg.created_at), new Date(prevMsg.created_at));
              const readStatus = getReadStatus(msg);
              const isQueued = optimisticMessages.some(om => om.id === msg.id);
              const senderName = isRTL
                ? (sender?.full_name_ar || sender?.full_name || (isRTL ? 'مجهول' : 'Unknown'))
                : (sender?.full_name || 'Unknown');

              // Show sender name if different from previous message sender
              const showSenderName = !isMine && (!prevMsg || prevMsg.sender_id !== msg.sender_id || showDateSep);

              return (
                <React.Fragment key={msg.id}>
                  {showDateSep && <DateSeparator date={new Date(msg.created_at)} isRTL={isRTL} />}
                  <div className={cn('flex gap-2', isMine ? 'justify-end' : 'justify-start')}>
                    {!isMine && (
                      <Avatar className="h-7 w-7 shrink-0 mt-1">
                        <AvatarImage src={sender?.avatar_url || ''} />
                        <AvatarFallback className="text-[10px]">{getInitials(sender?.full_name || '?')}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="max-w-[70%]">
                      {showSenderName && (
                        <div className="flex items-center gap-1.5 mb-0.5 px-1">
                          <span className="text-xs font-medium text-muted-foreground">{senderName}</span>
                          {getRoleBadgeSmall(sender?.role, isRTL)}
                        </div>
                      )}
                      <div className={cn(
                        'rounded-2xl px-4 py-2',
                        isMine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm',
                        isQueued && 'opacity-60'
                      )}>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <div className={cn(
                          'flex items-center gap-1 mt-1',
                          isMine ? 'justify-end' : 'justify-start'
                        )}>
                          <span className={cn(
                            'text-[10px]',
                            isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          )}>
                            {isQueued
                              ? (isRTL ? 'في الانتظار...' : 'Queued...')
                              : format(new Date(msg.created_at), 'hh:mm a', { locale: isRTL ? ar : undefined })
                            }
                          </span>
                          {isMine && !isQueued && readStatus === 'read' && (
                            <CheckCheck className="h-3.5 w-3.5 text-primary-foreground" />
                          )}
                          {isMine && !isQueued && readStatus === 'sent' && (
                            <Check className="h-3.5 w-3.5 text-primary-foreground/50" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing indicator */}
          {userId && (
            <TypingIndicator
              conversationId={selectedConversation}
              userId={userId}
              isRTL={isRTL}
              participants={participantProfiles}
            />
          )}
        </ScrollArea>
      </CardContent>

      {/* Input */}
      <div className="p-4 border-t">
        <form
          className="flex gap-2"
          onSubmit={e => {
            e.preventDefault();
            sendMessage.mutate();
          }}
        >
          <Input
            value={messageText}
            onChange={e => {
              setMessageText(e.target.value);
              if (isOnline) sendTyping();
            }}
            placeholder={isRTL ? 'اكتب رسالة...' : 'Type a message...'}
            className="flex-1"
            autoFocus
          />
          <Button type="submit" size="icon" disabled={!messageText.trim() || sendMessage.isPending}>
            <Send className={cn('h-4 w-4', isRTL && 'rotate-180')} />
          </Button>
        </form>
      </div>
    </Card>
  );
}
