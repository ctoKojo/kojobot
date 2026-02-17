import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MessageSquarePlus, Send, Search, ArrowLeft, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ConversationItem {
  id: string;
  last_message_at: string;
  participants: { user_id: string; full_name: string; full_name_ar: string | null; avatar_url: string | null; last_read_at: string }[];
  last_message?: { content: string; sender_id: string; created_at: string };
  unread_count: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export default function Messages() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      if (!user) return [];
      
      // Get user's conversation IDs
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (!participations?.length) return [];

      const convIds = participations.map(p => p.conversation_id);
      const readMap = Object.fromEntries(participations.map(p => [p.conversation_id, p.last_read_at]));

      // Get conversations
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, last_message_at')
        .in('id', convIds)
        .order('last_message_at', { ascending: false });

      if (!convs?.length) return [];

      // Get all participants for these conversations
      const { data: allParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id, last_read_at')
        .in('conversation_id', convIds);

      // Get profiles for all participant user IDs
      const allUserIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ar, avatar_url')
        .in('user_id', allUserIds);

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

      // Get last message for each conversation
      const results: ConversationItem[] = [];
      for (const conv of convs) {
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, sender_id, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Count unread
        const myReadAt = readMap[conv.id] || '1970-01-01';
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', user.id)
          .gt('created_at', myReadAt);

        const participants = (allParticipants || [])
          .filter(p => p.conversation_id === conv.id)
          .map(p => ({
            user_id: p.user_id,
            last_read_at: p.last_read_at || '',
            ...(profileMap[p.user_id] || { full_name: 'Unknown', full_name_ar: null, avatar_url: null }),
          }));

        results.push({
          id: conv.id,
          last_message_at: conv.last_message_at || conv.id,
          participants,
          last_message: lastMsg || undefined,
          unread_count: count || 0,
        });
      }

      return results;
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  // Fetch messages for selected conversation
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
    refetchInterval: 3000,
  });

  // Mark as read when viewing
  useEffect(() => {
    if (selectedConversation && user) {
      supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', selectedConversation)
        .eq('user_id', user.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        });
    }
  }, [selectedConversation, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Search users for new conversation
  const { data: searchResults = [] } = useQuery({
    queryKey: ['user-search', userSearch],
    queryFn: async () => {
      if (!userSearch || userSearch.length < 2) return [];
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ar, avatar_url')
        .or(`full_name.ilike.%${userSearch}%,full_name_ar.ilike.%${userSearch}%`)
        .neq('user_id', user?.id || '')
        .limit(10);
      return data || [];
    },
    enabled: userSearch.length >= 2,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!selectedConversation || !messageText.trim() || !user) return;
      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation,
        sender_id: user.id,
        content: messageText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: () => toast.error(isRTL ? 'فشل إرسال الرسالة' : 'Failed to send message'),
  });

  // Start new conversation
  const startConversation = async (targetUserId: string) => {
    if (!user) return;

    // Check if conversation already exists between these two users
    const { data: myConvs } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (myConvs?.length) {
      const { data: theirConvs } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', targetUserId)
        .in('conversation_id', myConvs.map(c => c.conversation_id));

      if (theirConvs?.length) {
        // Check it's a 2-person conversation
        for (const conv of theirConvs) {
          const { count } = await supabase
            .from('conversation_participants')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.conversation_id);
          if (count === 2) {
            setSelectedConversation(conv.conversation_id);
            setShowNewDialog(false);
            setUserSearch('');
            return;
          }
        }
      }
    }

    // Create new conversation with client-generated ID to avoid SELECT policy issue
    const convId = crypto.randomUUID();
    const { error: convError } = await supabase
      .from('conversations')
      .insert({ id: convId });

    if (convError) {
      toast.error(isRTL ? 'فشل إنشاء المحادثة' : 'Failed to create conversation');
      return;
    }

    // Add participants
    const { error: partError } = await supabase.from('conversation_participants').insert([
      { conversation_id: convId, user_id: user.id },
      { conversation_id: convId, user_id: targetUserId },
    ]);

    if (partError) {
      toast.error(isRTL ? 'فشل إضافة المشاركين' : 'Failed to add participants');
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    setSelectedConversation(convId);
    setShowNewDialog(false);
    setUserSearch('');
  };

  const getOtherParticipant = (conv: ConversationItem) => {
    return conv.participants.find(p => p.user_id !== user?.id) || conv.participants[0];
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const selectedConvData = conversations.find(c => c.id === selectedConversation);
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const other = getOtherParticipant(conv);
    return other.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (other.full_name_ar || '').includes(searchQuery);
  });

  const participantProfiles = Object.fromEntries(
    (selectedConvData?.participants || []).map(p => [p.user_id, p])
  );

  return (
    <DashboardLayout title={isRTL ? 'الرسائل' : 'Messages'}>
      <div className="flex h-[calc(100vh-8rem)] gap-4">
        {/* Conversations List */}
        <Card className={cn(
          'flex flex-col w-full md:w-80 shrink-0',
          selectedConversation && 'hidden md:flex'
        )}>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{isRTL ? 'المحادثات' : 'Conversations'}</CardTitle>
              <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost"><MessageSquarePlus className="h-5 w-5" /></Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{isRTL ? 'محادثة جديدة' : 'New Conversation'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={isRTL ? 'ابحث عن مستخدم...' : 'Search for a user...'}
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <ScrollArea className="h-64">
                      <div className="space-y-1">
                        {searchResults.map(u => (
                          <button
                            key={u.user_id}
                            className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-accent transition-colors text-start"
                            onClick={() => startConversation(u.user_id)}
                          >
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={u.avatar_url || ''} />
                              <AvatarFallback className="text-xs">{getInitials(u.full_name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{isRTL ? (u.full_name_ar || u.full_name) : u.full_name}</p>
                            </div>
                          </button>
                        ))}
                        {userSearch.length >= 2 && searchResults.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {isRTL ? 'لا توجد نتائج' : 'No results found'}
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isRTL ? 'بحث...' : 'Search...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              {loadingConversations ? (
                <p className="text-sm text-muted-foreground text-center py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">{isRTL ? 'لا توجد محادثات بعد' : 'No conversations yet'}</p>
                  <Button variant="link" size="sm" onClick={() => setShowNewDialog(true)}>
                    {isRTL ? 'ابدأ محادثة جديدة' : 'Start a new conversation'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-0.5 px-2 pb-2">
                  {filteredConversations.map(conv => {
                    const other = getOtherParticipant(conv);
                    const isSelected = selectedConversation === conv.id;
                    return (
                      <button
                        key={conv.id}
                        className={cn(
                          'flex items-center gap-3 w-full p-3 rounded-lg transition-colors text-start',
                          isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                        )}
                        onClick={() => setSelectedConversation(conv.id)}
                      >
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={other.avatar_url || ''} />
                          <AvatarFallback className="text-xs">{getInitials(other.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">
                              {isRTL ? (other.full_name_ar || other.full_name) : other.full_name}
                            </p>
                            {conv.unread_count > 0 && (
                              <Badge variant="default" className="text-xs h-5 w-5 p-0 flex items-center justify-center rounded-full shrink-0">
                                {conv.unread_count}
                              </Badge>
                            )}
                          </div>
                          {conv.last_message && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {conv.last_message.content}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className={cn(
          'flex-1 flex flex-col',
          !selectedConversation && 'hidden md:flex'
        )}>
          {selectedConversation && selectedConvData ? (
            <>
              {/* Chat Header */}
              <CardHeader className="pb-3 border-b flex-row items-center gap-3 space-y-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden shrink-0"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ArrowLeft className={cn('h-5 w-5', isRTL && 'rotate-180')} />
                </Button>
                {(() => {
                  const other = getOtherParticipant(selectedConvData);
                  return (
                    <>
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={other.avatar_url || ''} />
                        <AvatarFallback className="text-xs">{getInitials(other.full_name)}</AvatarFallback>
                      </Avatar>
                      <CardTitle className="text-base">
                        {isRTL ? (other.full_name_ar || other.full_name) : other.full_name}
                      </CardTitle>
                    </>
                  );
                })()}
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-3">
                    {messages.map(msg => {
                      const isMine = msg.sender_id === user?.id;
                      const sender = participantProfiles[msg.sender_id];
                      return (
                        <div key={msg.id} className={cn('flex gap-2', isMine ? 'justify-end' : 'justify-start')}>
                          {!isMine && (
                            <Avatar className="h-7 w-7 shrink-0 mt-1">
                              <AvatarImage src={sender?.avatar_url || ''} />
                              <AvatarFallback className="text-[10px]">{getInitials(sender?.full_name || '?')}</AvatarFallback>
                            </Avatar>
                          )}
                          <div className={cn(
                            'max-w-[70%] rounded-2xl px-4 py-2',
                            isMine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'
                          )}>
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            <p className={cn(
                              'text-[10px] mt-1',
                              isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            )}>
                              {format(new Date(msg.created_at), 'hh:mm a', { locale: isRTL ? ar : undefined })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
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
                    onChange={e => setMessageText(e.target.value)}
                    placeholder={isRTL ? 'اكتب رسالة...' : 'Type a message...'}
                    className="flex-1"
                    autoFocus
                  />
                  <Button type="submit" size="icon" disabled={!messageText.trim() || sendMessage.isPending}>
                    <Send className={cn('h-4 w-4', isRTL && 'rotate-180')} />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquarePlus className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">{isRTL ? 'اختر محادثة أو ابدأ واحدة جديدة' : 'Select a conversation or start a new one'}</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
