import { supabase } from '@/integrations/supabase/client';

/**
 * Full Web Push subscription flow.
 * 1. Request notification permission
 * 2. Get VAPID public key from system_settings
 * 3. Subscribe via PushManager
 * 4. Store subscription in push_subscriptions table
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push not supported in this browser');
      return false;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    // Get VAPID public key
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'vapid_public_key')
      .single();

    if (!setting?.value) {
      console.warn('VAPID public key not configured. Admin needs to generate VAPID keys first.');
      return false;
    }

    const vapidPublicKey = JSON.parse(setting.value as string);

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;
    const pushManager = (registration as any).pushManager;

    if (!pushManager) {
      console.warn('PushManager not available');
      return false;
    }

    // Check for existing subscription
    let subscription = await pushManager.getSubscription();

    if (!subscription) {
      subscription = await pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const { endpoint, keys } = subscription.toJSON();

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      console.error('Invalid push subscription');
      return false;
    }

    // Store in database
    await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      { onConflict: 'user_id,endpoint' }
    );

    console.log('Push subscription registered successfully');
    return true;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return false;
  }
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;

    const registration = await navigator.serviceWorker.ready;
    const pushManager = (registration as any).pushManager;
    const subscription = pushManager ? await pushManager.getSubscription() : null;

    if (subscription) {
      const { endpoint } = subscription.toJSON();
      await subscription.unsubscribe();

      if (endpoint) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', endpoint);
      }
    }
  } catch (err) {
    console.error('Push unsubscribe failed:', err);
  }
}

/**
 * Send push notification via edge function.
 */
export async function sendPushToUser(recipientUserId: string, title: string, body: string, url?: string) {
  try {
    await supabase.functions.invoke('send-push', {
      body: { recipientUserId, title, body, url },
    });
  } catch (err) {
    console.error('Failed to send push:', err);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, char => char.charCodeAt(0));
}
