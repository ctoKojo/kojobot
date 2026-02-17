/**
 * Browser Notification API helpers.
 * Works when the tab is open but not focused.
 * For full push (browser closed), VAPID keys are needed.
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function showBrowserNotification(title: string, body: string, url?: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return; // Don't show if tab is focused

  const notification = new Notification(title, {
    body,
    icon: '/kojobot-logo-white.png',
    badge: '/kojobot-logo-white.png',
    tag: 'kojobot-message', // Replaces previous notification
  });

  notification.onclick = () => {
    window.focus();
    if (url) window.location.href = url;
    notification.close();
  };

  // Auto-close after 5s
  setTimeout(() => notification.close(), 5000);
}
