/**
 * Centralized Realtime subscriptions (Layer 2.5).
 *
 * Architecture rule (ARCHITECTURE.md §Realtime Strategy):
 *   • All Supabase realtime channels live HERE.
 *   • Components NEVER call `supabase.channel(...)` directly.
 *   • Subscriptions trigger `queryClient.invalidateQueries(...)` only —
 *     they never mutate React state directly.
 *
 * Each subscriber returns an unsubscribe function. Always call it in cleanup.
 */
// eslint-disable-next-line no-restricted-imports
import { supabase } from '@/integrations/supabase/client';
import type { QueryClient } from '@tanstack/react-query';
import { studentsKeys } from '@/features/students';

/**
 * Subscribe to changes on a single student. Invalidates summary + full caches.
 * Usage:
 *   useEffect(() => subscribeToStudent(userId, queryClient), [userId, queryClient]);
 */
export function subscribeToStudent(userId: string, queryClient: QueryClient): () => void {
  const channel = supabase
    .channel(`student-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${userId}` },
      () => {
        queryClient.invalidateQueries({ queryKey: studentsKeys.detail(userId) });
        queryClient.invalidateQueries({ queryKey: studentsKeys.full(userId) });
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'subscriptions', filter: `student_id=eq.${userId}` },
      () => {
        queryClient.invalidateQueries({ queryKey: studentsKeys.detail(userId) });
        queryClient.invalidateQueries({ queryKey: studentsKeys.full(userId) });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to ANY student-related row changes. Invalidates the list cache only.
 * Use sparingly — keep it on pages that actually display a student list.
 */
export function subscribeToStudentsList(queryClient: QueryClient): () => void {
  const channel = supabase
    .channel('students-list')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      () => {
        queryClient.invalidateQueries({ queryKey: ['students', 'list'] });
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'subscriptions' },
      () => {
        queryClient.invalidateQueries({ queryKey: ['students', 'list'] });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
