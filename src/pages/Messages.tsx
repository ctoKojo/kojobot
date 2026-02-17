import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ConversationList, ConversationItem } from '@/components/messages/ConversationList';
import { ChatArea } from '@/components/messages/ChatArea';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { subscribeToPush } from '@/lib/pushSubscription';
import { getNotificationPermission } from '@/lib/browserNotifications';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Auto-create conversations between a student and their group instructors.
 * Runs once per session when the student opens the Messages page.
 */
async function ensureStudentInstructorConversations(userId: string) {
  // 1. Get student's active groups and their instructors
  const { data: groupStudents } = await supabase
    .from('group_students')
    .select('group_id')
    .eq('student_id', userId)
    .eq('is_active', true);

  if (!groupStudents?.length) return;

  const groupIds = groupStudents.map(gs => gs.group_id);

  const { data: groups } = await supabase
    .from('groups')
    .select('id, instructor_id')
    .in('id', groupIds)
    .eq('is_active', true)
    .not('instructor_id', 'is', null);

  if (!groups?.length) return;

  const instructorIds = [...new Set(groups.map(g => g.instructor_id!))];

  // 2. Get student's existing conversations
  const { data: myConvs } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);

  const myConvIds = (myConvs || []).map(c => c.conversation_id);

  for (const instructorId of instructorIds) {
    let conversationExists = false;

    if (myConvIds.length) {
      // Check if a 1-on-1 conversation already exists with this instructor
      const { data: theirConvs } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', instructorId)
        .in('conversation_id', myConvIds);

      if (theirConvs?.length) {
        for (const conv of theirConvs) {
          const { count } = await supabase
            .from('conversation_participants')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.conversation_id);
          if (count === 2) {
            conversationExists = true;
            break;
          }
        }
      }
    }

    if (!conversationExists) {
      // Create the conversation
      const convId = crypto.randomUUID();
      const { error: convError } = await supabase
        .from('conversations')
        .insert({ id: convId });

      if (convError) {
        console.error('Failed to auto-create conversation:', convError);
        continue;
      }

      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: convId, user_id: userId },
          { conversation_id: convId, user_id: instructorId },
        ]);

      if (partError) {
        console.error('Failed to add participants:', partError);
      }

      // Add the new conversation ID to our list so subsequent iterations know about it
      myConvIds.push(convId);
    }
  }
}

export default function Messages() {
  const { isRTL } = useLanguage();
  const { user, role } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const autoCreatedRef = useRef(false);
  const [notifPermission, setNotifPermission] = useState<string>(getNotificationPermission());

  // Setup realtime subscriptions
  useRealtimeMessages(user?.id, selectedConversation);

  // Handle enabling push notifications (requires user gesture)
  const handleEnableNotifications = useCallback(async () => {
    if (!user?.id) return;
    const result = await subscribeToPush(user.id);
    if (result) {
      setNotifPermission('granted');
    } else {
      setNotifPermission(getNotificationPermission());
    }
  }, [user?.id]);

  // Auto-create conversations for students with their instructors (once per session)
  useEffect(() => {
    if (!user?.id || role !== 'student' || autoCreatedRef.current) return;
    autoCreatedRef.current = true;

    ensureStudentInstructorConversations(user.id).then(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
  }, [user?.id, role, queryClient]);

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
      {notifPermission !== 'granted' && notifPermission !== 'denied' && notifPermission !== 'unsupported' && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <Bell className="h-5 w-5 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground flex-1">
            {isRTL ? 'فعّل الإشعارات عشان توصلك الرسائل الجديدة حتى لو مش فاتح التطبيق' : 'Enable notifications to get alerted about new messages even when the app is closed'}
          </p>
          <Button size="sm" variant="outline" onClick={handleEnableNotifications}>
            {isRTL ? 'تفعيل' : 'Enable'}
          </Button>
        </div>
      )}
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
