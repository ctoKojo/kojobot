/**
 * Students Service (Layer 2)
 *
 * Pure RPC wrappers. NO business logic. NO React imports. NO state.
 * The ONLY place in the app allowed to import `supabase` for student data.
 *
 * Naming convention (locked in ARCHITECTURE.md):
 *   getStudentsList / getStudent / getStudentFullProfile / updateStudent
 */

// eslint-disable-next-line no-restricted-imports
import { supabase } from '@/integrations/supabase/client';
import type {
  StudentsListParams,
  StudentsListPayload,
  StudentSummaryResult,
  StudentFullProfileResult,
  UpdateStudentInput,
} from '../types';

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  if (data == null) throw new Error('Empty response from RPC');
  return data;
}

export const studentsService = {
  /** RPC: get_students_list — paginated, filtered list */
  async getStudentsList(params: StudentsListParams = {}): Promise<StudentsListPayload> {
    const result = await supabase.rpc('get_students_list', {
      p_filters: (params.filters ?? {}) as never,
      p_limit: params.limit ?? 50,
      p_offset: params.offset ?? 0,
      p_sort_by: params.sort_by ?? 'created_at',
      p_sort_dir: params.sort_dir ?? 'desc',
    });
    return unwrap(result) as unknown as StudentsListPayload;
  },

  /** RPC: get_student_summary — lightweight payload for cards */
  async getStudent(userId: string): Promise<StudentSummaryResult> {
    const result = await supabase.rpc('get_student_summary', { p_user_id: userId });
    return unwrap(result) as unknown as StudentSummaryResult;
  },

  /** RPC: get_student_full_profile — heavy payload for profile page */
  async getStudentFullProfile(userId: string): Promise<StudentFullProfileResult> {
    const result = await supabase.rpc('get_student_full_profile', { p_user_id: userId });
    return unwrap(result) as unknown as StudentFullProfileResult;
  },

  /**
   * Update student profile fields (no business logic — just persistence).
   * Calls the profileService to keep identity-design-lock honored (user_id only).
   */
  async updateStudent({ user_id, ...patch }: UpdateStudentInput): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('user_id', user_id);
    if (error) throw new Error(error.message);
  },
};

export type StudentsService = typeof studentsService;
