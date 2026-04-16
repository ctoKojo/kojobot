import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type LifecycleStatus =
  | 'in_progress'
  | 'awaiting_exam'
  | 'exam_scheduled'
  | 'graded'
  | 'pending_group_assignment'
  | 'unknown';

export type LifecycleOutcome = 'passed' | 'failed' | null;

export interface BranchOption {
  id: string;
  name: string;
  name_ar: string;
}

export interface ExamInfo {
  exam_scheduled_at: string;
  level_name: string;
  level_name_ar: string;
  quiz_assignment_id: string | null;
  start_time: string | null;
  due_date: string | null;
  duration_minutes: number | null;
}

export interface GradeInfo {
  percentage: number | null;
  evaluation_avg: number | null;
  final_exam_score: number | null;
}

export interface StudentLifecycle {
  status: LifecycleStatus;
  outcome: LifecycleOutcome;
  currentLevel: { id: string; name: string; name_ar: string } | null;
  groupId: string | null;
  branches: BranchOption[] | null;
  examInfo: ExamInfo | null;
  grade: GradeInfo | null;
  isPendingGroup: boolean;
  loading: boolean;
  refetch: () => void;
}

export function useStudentLifecycle(studentId: string | undefined): StudentLifecycle {
  const [state, setState] = useState<Omit<StudentLifecycle, 'refetch' | 'loading'>>({
    status: 'unknown',
    outcome: null,
    currentLevel: null,
    groupId: null,
    branches: null,
    examInfo: null,
    grade: null,
    isPendingGroup: false,
  });
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);

    try {
      // Single query: get the latest progress record
      const { data: gsp } = await supabase
        .from('group_student_progress')
        .select('*, levels!group_student_progress_current_level_id_fkey(id, name, name_ar, final_exam_quiz_id)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!gsp) {
        setState(prev => ({ ...prev, status: 'unknown' }));
        setLoading(false);
        return;
      }

      const level = gsp.levels as any;
      const status = (gsp.status as LifecycleStatus) || 'unknown';
      const outcome = (gsp.outcome as LifecycleOutcome) || null;
      const currentLevel = level ? { id: level.id, name: level.name, name_ar: level.name_ar } : null;
      const groupId = gsp.group_id;

      // Parallel fetches based on status
      const gradePromise = supabase
        .from('level_grades')
        .select('percentage, evaluation_avg, final_exam_score')
        .eq('student_id', studentId)
        .eq('group_id', gsp.group_id)
        .eq('level_id', gsp.current_level_id)
        .maybeSingle()
        .then(r => r);

      let branchPromise: PromiseLike<any> = Promise.resolve({ data: null });
      if (outcome === 'passed' && status === 'graded') {
        branchPromise = supabase
          .from('levels')
          .select('id, name, name_ar')
          .eq('parent_level_id', gsp.current_level_id)
          .eq('is_active', true)
          .then(r => r);
      }

      let examPromise: PromiseLike<any> = Promise.resolve({ data: null });
      if (status === 'exam_scheduled' && gsp.exam_scheduled_at && level?.final_exam_quiz_id) {
        examPromise = supabase
          .from('quiz_assignments')
          .select('id, start_time, due_date')
          .eq('quiz_id', level.final_exam_quiz_id)
          .eq('student_id', studentId)
          .eq('is_active', true)
          .maybeSingle()
          .then(r => r);
      }

      const [gradeRes, branchRes, examRes] = await Promise.all([gradePromise, branchPromise, examPromise]);

      const grade: GradeInfo | null = gradeRes.data
        ? {
            percentage: gradeRes.data.percentage,
            evaluation_avg: gradeRes.data.evaluation_avg,
            final_exam_score: gradeRes.data.final_exam_score,
          }
        : null;

      const branchData = branchRes.data as any[] | null;
      const branches: BranchOption[] | null =
        branchData && branchData.length > 1
          ? branchData.map((b: any) => ({ id: b.id, name: b.name, name_ar: b.name_ar }))
          : null;

      let examInfo: ExamInfo | null = null;
      if (status === 'exam_scheduled' && gsp.exam_scheduled_at) {
        const qa = examRes.data;
        let durationMinutes: number | null = null;
        if (qa?.start_time && qa?.due_date) {
          durationMinutes = Math.round(
            (new Date(qa.due_date).getTime() - new Date(qa.start_time).getTime()) / 60000
          );
        }
        examInfo = {
          exam_scheduled_at: gsp.exam_scheduled_at,
          level_name: level?.name || '',
          level_name_ar: level?.name_ar || '',
          quiz_assignment_id: qa?.id || null,
          start_time: qa?.start_time || null,
          due_date: qa?.due_date || null,
          duration_minutes: durationMinutes,
        };
      }

      setState({
        status,
        outcome,
        currentLevel,
        groupId,
        branches,
        examInfo,
        grade,
        isPendingGroup: status === 'pending_group_assignment',
      });
    } catch (err) {
      console.error('useStudentLifecycle error:', err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime subscription on group_student_progress
  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel(`lifecycle-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_student_progress',
          filter: `student_id=eq.${studentId}`,
        },
        () => {
          fetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, fetch]);

  return { ...state, loading, refetch: fetch };
}
