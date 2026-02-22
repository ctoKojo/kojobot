import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

interface JitsiMeetingProps {
  roomName: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  isModerator: boolean;
  onClose?: () => void;
  onError?: () => void;
}

let scriptLoadPromise: Promise<void> | null = null;

function loadJitsiScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;
  
  if (window.JitsiMeetExternalAPI) {
    scriptLoadPromise = Promise.resolve();
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    
    const timeout = setTimeout(() => {
      scriptLoadPromise = null;
      reject(new Error('Jitsi script load timeout'));
    }, 15000);

    script.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeout);
      scriptLoadPromise = null;
      reject(new Error('Failed to load Jitsi script'));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export function JitsiMeeting({ roomName, displayName, email, avatarUrl, isModerator, onClose, onError }: JitsiMeetingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const { isRTL } = useLanguage();

  useEffect(() => {
    let disposed = false;

    async function initJitsi() {
      try {
        await loadJitsiScript();
        if (disposed || !containerRef.current) return;

        const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
          roomName,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: {
            displayName,
            email: email || '',
          },
          configOverwrite: {
            startWithAudioMuted: !isModerator,
            startWithVideoMuted: !isModerator,
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            hideConferenceSubject: true,
            subject: ' ',
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            SHOW_CHROME_EXTENSION_BANNER: false,
            MOBILE_APP_PROMO: false,
            HIDE_DEEP_LINKING_LOGO: true,
          },
        });

        apiRef.current = api;

        if (avatarUrl) {
          api.executeCommand('avatarUrl', avatarUrl);
        }

        api.addEventListener('videoConferenceJoined', () => {
          if (!disposed) setLoading(false);
        });

        api.addEventListener('readyToClose', () => {
          if (!disposed) onClose?.();
        });

        // Fallback: if not joined after 10s, hide loader anyway
        setTimeout(() => {
          if (!disposed) setLoading(false);
        }, 10000);

      } catch (err) {
        console.error('Jitsi init error:', err);
        if (!disposed) {
          setLoading(false);
          onError?.();
        }
      }
    }

    initJitsi();

    return () => {
      disposed = true;
      if (apiRef.current) {
        try { apiRef.current.dispose(); } catch {}
        apiRef.current = null;
      }
    };
  }, [roomName]);

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {isRTL ? 'جاري تحميل غرفة الفيديو...' : 'Loading video room...'}
            </p>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
