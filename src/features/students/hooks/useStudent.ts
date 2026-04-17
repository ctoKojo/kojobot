import { useQuery } from '@tanstack/react-query';
import { studentsService } from '../services/studentsService';
import { studentsKeys } from './queryKeys';

/**
 * Single student summary (cards, widgets, dashboards).
 * Query key: ['students', userId]
 */
export function useStudent(userId: string | undefined) {
  return useQuery({
    queryKey: studentsKeys.detail(userId ?? ''),
    queryFn: () => studentsService.getStudent(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}
