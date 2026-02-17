import { supabase } from '@/integrations/supabase/client';

const QUEUE_KEY = 'kojobot-offline-message-queue';

interface QueuedMessage {
  id: string;
  conversationId: string;
  content: string;
  senderId: string;
  timestamp: number;
}

export function queueMessage(conversationId: string, content: string, senderId: string): QueuedMessage {
  const msg: QueuedMessage = {
    id: crypto.randomUUID(),
    conversationId,
    content,
    senderId,
    timestamp: Date.now(),
  };
  const queue = getQueue();
  queue.push(msg);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return msg;
}

export function getQueue(): QueuedMessage[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export async function flushQueue(): Promise<number> {
  const queue = getQueue();
  if (!queue.length) return 0;

  const failed: QueuedMessage[] = [];
  let sent = 0;

  for (const msg of queue) {
    const { error } = await supabase.from('messages').insert({
      conversation_id: msg.conversationId,
      sender_id: msg.senderId,
      content: msg.content,
    });
    if (error) {
      failed.push(msg);
    } else {
      sent++;
    }
  }

  localStorage.setItem(QUEUE_KEY, JSON.stringify(failed));
  return sent;
}

export function setupOfflineSync() {
  window.addEventListener('online', async () => {
    const sent = await flushQueue();
    if (sent > 0) {
      console.log(`[OfflineQueue] Synced ${sent} queued messages`);
    }
  });
}
