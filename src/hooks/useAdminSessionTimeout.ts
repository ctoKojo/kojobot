import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const ADMIN_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000; // 2 minutes warning before logout

export function useAdminSessionTimeout() {
  const { role, signOut, user } = useAuth();
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    clearTimers();
    toast({
      title: 'Session Expired',
      description: 'You have been logged out due to inactivity.',
      variant: 'destructive',
    });
    await signOut();
  }, [signOut, toast, clearTimers]);

  const showWarning = useCallback(() => {
    toast({
      title: 'Session Expiring Soon',
      description: 'Your session will expire in 2 minutes due to inactivity. Move your mouse or press a key to stay logged in.',
      duration: 10000,
    });
  }, [toast]);

  const resetTimer = useCallback(() => {
    if (role !== 'admin' || !user) return;

    lastActivityRef.current = Date.now();
    clearTimers();

    // Set warning timer (28 minutes)
    warningRef.current = setTimeout(() => {
      showWarning();
    }, ADMIN_TIMEOUT_MS - WARNING_BEFORE_MS);

    // Set logout timer (30 minutes)
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, ADMIN_TIMEOUT_MS);
  }, [role, user, clearTimers, showWarning, handleLogout]);

  useEffect(() => {
    // Only apply to admins
    if (role !== 'admin' || !user) {
      clearTimers();
      return;
    }

    // Activity events to track
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    // Throttle reset to avoid too many timer resets
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledReset = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
        resetTimer();
      }, 1000); // Throttle to once per second
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, throttledReset, { passive: true });
    });

    // Initial timer start
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledReset);
      });
      if (throttleTimeout) clearTimeout(throttleTimeout);
      clearTimers();
    };
  }, [role, user, resetTimer, clearTimers]);

  return null;
}
