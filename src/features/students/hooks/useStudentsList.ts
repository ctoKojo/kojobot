import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { studentsService } from '../services/studentsService';
import { studentsKeys } from './queryKeys';
import type { StudentsListParams } from '../types';

/**
 * Paginated, filtered students list.
 *
 * Query key: ['students', 'list', params]
 * Cache: 30s, keepPreviousData enabled for smooth pagination.
 */
export function useStudentsList(params: StudentsListParams = {}) {
  return useQuery({
    queryKey: studentsKeys.list(params),
    queryFn: () => studentsService.getStudentsList(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
