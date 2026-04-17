import { useQuery } from '@tanstack/react-query';
import { studentsService } from '../services/studentsService';
import { studentsKeys } from './queryKeys';

/**
 * Full profile payload (parents, payments, attendance, lifecycle).
 * Query key: ['students', userId, 'full']
 */
export function useStudentFullProfile(userId: string | undefined) {
  return useQuery({
    queryKey: studentsKeys.full(userId ?? ''),
    queryFn: () => studentsService.getStudentFullProfile(userId as string),
    enabled: Boolean(userId),
    staleTime: 15_000,
  });
}
