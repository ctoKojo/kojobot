import { useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsService } from '../services/studentsService';
import { studentsKeys } from './queryKeys';
import type { UpdateStudentInput } from '../types';

/**
 * Update a student profile.
 *
 * Invalidation contract (ARCHITECTURE.md §Invalidation Rules):
 *   • ['students', userId]         — single entity
 *   • ['students', userId, 'full'] — full profile
 *   • ['students', 'list']         — every list/filter combination
 *
 * NEVER invalidate the global ['students'] root — that would nuke unrelated caches.
 */
export function useUpdateStudent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateStudentInput) => studentsService.updateStudent(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: studentsKeys.detail(variables.user_id) });
      qc.invalidateQueries({ queryKey: studentsKeys.full(variables.user_id) });
      qc.invalidateQueries({ queryKey: ['students', 'list'] });
    },
  });
}
