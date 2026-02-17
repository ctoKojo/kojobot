import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { showBrowserNotification } from '@/lib/browserNotifications';
import { subscribeToPush } from '@/lib/pushSubscription';

// Notification sound as a short beep using Web Audio API
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

export function useRealtimeMessages(userId: string | undefined, selectedConversation: string | null) {
  const queryClient = useQueryClient();
  const selectedConvRef = useRef(selectedConversation);
  selectedConvRef.current = selectedConversation;

  // Auto-subscribe to push on mount (only if permission already granted)
  useEffect(() => {
    if (userId && 'Notification' in window && Notification.permission === 'granted') {
      subscribeToPush(userId).catch(() => {});
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('smart-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as any;
          // Refresh messages if in the same conversation
          if (msg.conversation_id === selectedConvRef.current) {
            queryClient.invalidateQueries({ queryKey: ['messages', selectedConvRef.current] });
          }
          // Refresh conversations list
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });

          // Play sound + browser notification if message is from someone else
          if (msg.sender_id !== userId) {
            playNotificationSound();
            showBrowserNotification(
              'Kojobot - New Message',
              msg.content?.substring(0, 100) || 'You have a new message',
              '/messages'
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', selectedConvRef.current] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_participants' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

export function useTypingIndicator(userId: string | undefined, conversationId: string | null) {
  const lastSentRef = useRef(0);

  const sendTyping = useCallback(async () => {
    if (!userId || !conversationId) return;
    const now = Date.now();
    if (now - lastSentRef.current < 2000) return;
    lastSentRef.current = now;

    await supabase
      .from('typing_indicators')
      .upsert(
        { user_id: userId, conversation_id: conversationId, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,conversation_id' }
      );
  }, [userId, conversationId]);

  const clearTyping = useCallback(async () => {
    if (!userId || !conversationId) return;
    await supabase
      .from('typing_indicators')
      .delete()
      .eq('user_id', userId)
      .eq('conversation_id', conversationId);
  }, [userId, conversationId]);

  return { sendTyping, clearTyping };
}

export function useRealtimeTyping(conversationId: string | null, userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`typing-${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'typing_indicators', filter: `conversation_id=eq.${conversationId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['typing', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);
}
