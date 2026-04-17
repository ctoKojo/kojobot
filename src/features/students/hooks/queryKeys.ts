/**
 * Stable query keys for the Students entity.
 * Locked in ARCHITECTURE.md — do not deviate.
 */
import type { StudentsListParams } from '../types';

export const studentsKeys = {
  all: ['students'] as const,
  list: (params: StudentsListParams = {}) =>
    ['students', 'list', params] as const,
  detail: (userId: string) => ['students', userId] as const,
  full: (userId: string) => ['students', userId, 'full'] as const,
};
