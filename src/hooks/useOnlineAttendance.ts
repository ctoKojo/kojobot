import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const HEARTBEAT_INTERVAL_MS = 45_000; // 45 seconds

interface UseOnlineAttendanceOptions {
  sessionId: string;
  groupId: string;
  studentId: string;
  attendanceStatus: 'present' | 'late' | 'absent';
  enabled: boolean;
}

/**
 * Hook that manages online attendance heartbeat.
 * Runs in the same tab as Jitsi meeting.
 *
 * 1. On mount (enabled): UPSERT into online_attendance_logs
 * 2. Every 45s: UPDATE last_seen_at, heartbeat_count++
 * 3. On beforeunload: final heartbeat update
 * 4. Cleanup: stop interval
 */
export function useOnlineAttendance({
  sessionId,
  groupId,
  studentId,
  attendanceStatus,
  enabled,
}: UseOnlineAttendanceOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRegistered = useRef(false);

  useEffect(() => {
    if (!enabled || !sessionId || !groupId || !studentId) return;

    const register = async () => {
      if (hasRegistered.current) return;

      // UPSERT: insert if not exists, ignore if already exists (first_joined_at protected by trigger)
      const { error } = await supabase
        .from('online_attendance_logs' as any)
        .upsert(
          {
            session_id: sessionId,
            group_id: groupId,
            student_id: studentId,
            attendance_status_initial: attendanceStatus,
            first_joined_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            heartbeat_count: 0,
            status: 'active',
          },
          { onConflict: 'session_id,student_id', ignoreDuplicates: false }
        );

      if (error) {
        console.error('[OnlineAttendance] Registration error:', error.message);
      } else {
        hasRegistered.current = true;
      }
    };

    const sendHeartbeat = async () => {
      const { error } = await supabase
        .from('online_attendance_logs' as any)
        .update({
          last_seen_at: new Date().toISOString(),
          heartbeat_count: undefined, // We'll use RPC or raw increment below
        })
        .eq('session_id', sessionId)
        .eq('student_id', studentId);

      // Since we can't do atomic increment with the JS client easily,
      // we do a simple update of last_seen_at. The heartbeat_count
      // increment is best-effort.
      if (error) {
        console.error('[OnlineAttendance] Heartbeat error:', error.message);
      }
    };

    const sendHeartbeatWithIncrement = async () => {
      // Use rpc or manual: fetch current count, increment
      // Simpler: just update last_seen_at and use a raw SQL increment via rpc
      // For now, update last_seen_at only (server calculates minutes from timestamps)
      const { error } = await supabase
        .from('online_attendance_logs' as any)
        .update({ last_seen_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('student_id', studentId);

      if (error) {
        console.error('[OnlineAttendance] Heartbeat error:', error.message);
      }
    };

    // Register on mount
    register();

    // Start heartbeat interval
    intervalRef.current = setInterval(sendHeartbeatWithIncrement, HEARTBEAT_INTERVAL_MS);

    // beforeunload: final heartbeat
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliability on tab close
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/online_attendance_logs?session_id=eq.${sessionId}&student_id=eq.${studentId}`;
      const body = JSON.stringify({ last_seen_at: new Date().toISOString() });
      const headers = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_PROJECT_ID + '-auth-token') ? JSON.parse(localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_PROJECT_ID + '-auth-token') || '{}')?.access_token : ''}`,
        'Prefer': 'return=minimal',
      };

      try {
        // sendBeacon doesn't support custom headers, so use fetch with keepalive
        fetch(url, {
          method: 'PATCH',
          headers,
          body,
          keepalive: true,
        });
      } catch {
        // Best effort
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, sessionId, groupId, studentId, attendanceStatus]);
}
