import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ConversationList, ConversationItem } from '@/components/messages/ConversationList';
import { ChatArea } from '@/components/messages/ChatArea';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';

export default function Messages() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Setup realtime subscriptions
  useRealtimeMessages(user?.id, selectedConversation);

  // Fetch conversations
  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      if (!user) return [];

      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (!participations?.length) return [];

      const convIds = participations.map(p => p.conversation_id);
      const readMap = Object.fromEntries(participations.map(p => [p.conversation_id, p.last_read_at]));

      const { data: convs } = await supabase
        .from('conversations')
        .select('id, last_message_at')
        .in('id', convIds)
        .order('last_message_at', { ascending: false });

      if (!convs?.length) return [];

      const { data: allParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id, last_read_at')
        .in('conversation_id', convIds);

      const allUserIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];
      
      // Use SECURITY DEFINER function to bypass RLS for profile fetching
      const { data: profiles } = await supabase
        .rpc('get_conversation_participant_profiles', { p_user_ids: allUserIds });

      // Get roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', allUserIds);

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));
      const roleMap = Object.fromEntries((roles || []).map(r => [r.user_id, r.role]));

      const results: ConversationItem[] = [];
      for (const conv of convs) {
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, sender_id, created_at')
          .eq('conversation_id', conv.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

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
            role: roleMap[p.user_id],
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
  });

  const selectedConvData = conversations.find(c => c.id === selectedConversation);

  return (
    <DashboardLayout title={isRTL ? 'الرسائل' : 'Messages'}>
      <div className="flex h-[calc(100vh-8rem)] gap-4">
        <ConversationList
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelect={setSelectedConversation}
          isLoading={loadingConversations}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isRTL={isRTL}
          userId={user?.id}
        />
        <ChatArea
          selectedConversation={selectedConversation}
          conversationData={selectedConvData}
          onBack={() => setSelectedConversation(null)}
          isRTL={isRTL}
          userId={user?.id}
        />
      </div>
    </DashboardLayout>
  );
}
