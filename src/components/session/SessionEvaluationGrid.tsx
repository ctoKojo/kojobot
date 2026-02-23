import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Save, CheckCircle, Loader2, Info, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Json } from '@/integrations/supabase/types';

interface RubricLevel {
  value: number;
  label: string;
  label_ar: string;
}

interface Criterion {
  id: string;
  key: string;
  name: string;
  name_ar: string;
  description: string | null;
  description_ar: string | null;
  max_score: number;
  rubric_levels: RubricLevel[];
  display_order: number;
}

interface StudentRow {
  student_id: string;
  student_name: string;
  student_name_ar: string;
  scores: Record<string, number>;
  notes: string;
  feedback_tags: string[];
  saved: boolean;
  saving: boolean;
  existing_id?: string;
  quiz_score?: number | null;
  quiz_max_score?: number | null;
  assignment_score?: number | null;
  assignment_max_score?: number | null;
}

interface Props {
  sessionId: string;
  groupId: string;
  ageGroupId: string;
  students: Array<{
    student_id: string;
    student_name: string;
    student_name_ar: string;
    quiz_score?: number | null;
    quiz_max_score?: number | null;
    assignment_score?: number | null;
    assignment_max_score?: number | null;
  }>;
  attendanceComplete: boolean;
}

const FEEDBACK_TAGS = [
  { en: 'Hardworking', ar: 'مجتهد' },
  { en: 'Needs Focus', ar: 'يحتاج تركيز' },
  { en: 'Creative', ar: 'مبدع' },
  { en: 'Great Teamwork', ar: 'تعاون ممتاز' },
  { en: 'Improving', ar: 'يتحسن' },
  { en: 'Excellent', ar: 'ممتاز' },
  { en: 'Keep It Up', ar: 'استمر' },
];

export function SessionEvaluationGrid({ sessionId, groupId, ageGroupId, students: studentsProp, attendanceComplete }: Props) {
  const { language, isRTL, t } = useLanguage();
  const { user, role } = useAuth();
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const focusRef = useRef<{ row: number; col: number }>({ row: 0, col: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  // Load criteria and existing evaluations
  useEffect(() => {
    loadData();
  }, [sessionId, ageGroupId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch criteria for this age group
      const { data: criteriaData, error: criteriaError } = await supabase
        .from('evaluation_criteria')
        .select('*')
        .eq('age_group_id', ageGroupId)
        .eq('is_active', true)
        .order('display_order');

      if (criteriaError) throw criteriaError;

      const parsedCriteria: Criterion[] = (criteriaData || []).map(c => ({
        ...c,
        rubric_levels: (Array.isArray(c.rubric_levels) ? c.rubric_levels : []) as unknown as RubricLevel[],
      }));
      setCriteria(parsedCriteria);

      // Fetch existing evaluations
      const { data: evalData } = await supabase
        .from('session_evaluations')
        .select('*')
        .eq('session_id', sessionId);

      // Build rows
      const newRows: StudentRow[] = studentsProp.map(s => {
        const existing = evalData?.find(e => e.student_id === s.student_id);
        const scores: Record<string, number> = {};
        
        if (existing?.scores && typeof existing.scores === 'object') {
          Object.entries(existing.scores as Record<string, number>).forEach(([k, v]) => {
            scores[k] = v;
          });
        }

        return {
          student_id: s.student_id,
          student_name: s.student_name,
          student_name_ar: s.student_name_ar,
          scores,
          notes: existing?.notes || '',
          feedback_tags: (existing?.student_feedback_tags as string[]) || [],
          saved: !!existing,
          saving: false,
          existing_id: existing?.id,
          quiz_score: s.quiz_score,
          quiz_max_score: s.quiz_max_score,
          assignment_score: s.assignment_score,
          assignment_max_score: s.assignment_max_score,
        };
      });

      setRows(newRows);
    } catch (err: any) {
      console.error('Error loading evaluation data:', err);
      toast({ title: t.common.error, description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const setScore = useCallback((rowIndex: number, key: string, value: number) => {
    setRows(prev => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        scores: { ...updated[rowIndex].scores, [key]: value },
        saved: false,
      };
      return updated;
    });
  }, []);

  const calcBehaviorTotal = useCallback((scores: Record<string, number>) => {
    return criteria.reduce((sum, c) => sum + (scores[c.key] || 0), 0);
  }, [criteria]);

  const calcMaxBehavior = useMemo(() => {
    return criteria.reduce((sum, c) => sum + c.max_score, 0);
  }, [criteria]);

  const buildSnapshot = useCallback(() => {
    return criteria.map(c => ({
      key: c.key,
      name: c.name,
      name_ar: c.name_ar,
      max_score: c.max_score,
      rubric_levels: c.rubric_levels,
    }));
  }, [criteria]);

  const saveRow = useCallback(async (rowIndex: number) => {
    const row = rows[rowIndex];
    if (!user) return;

    // Check all criteria have scores
    const missingKeys = criteria.filter(c => row.scores[c.key] === undefined);
    if (missingKeys.length > 0) return; // Not complete yet

    setRows(prev => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], saving: true };
      return updated;
    });

    try {
      const snapshot = buildSnapshot();
      const behaviorTotal = calcBehaviorTotal(row.scores);

      const payload = {
        session_id: sessionId,
        student_id: row.student_id,
        evaluated_by: user.id,
        criteria_snapshot: snapshot as unknown as Json,
        scores: row.scores as unknown as Json,
        total_behavior_score: behaviorTotal,
        notes: row.notes || null,
        student_feedback_tags: row.feedback_tags.length > 0 ? row.feedback_tags : null,
      };

      let error: any;
      if (row.existing_id) {
        const { error: updateErr } = await supabase
          .from('session_evaluations')
          .update(payload)
          .eq('id', row.existing_id);
        error = updateErr;
      } else {
        const { data, error: insertErr } = await supabase
          .from('session_evaluations')
          .insert(payload)
          .select('id')
          .single();
        error = insertErr;
        if (data) {
          setRows(prev => {
            const updated = [...prev];
            updated[rowIndex] = { ...updated[rowIndex], existing_id: data.id };
            return updated;
          });
        }
      }

      if (error) throw error;

      setRows(prev => {
        const updated = [...prev];
        updated[rowIndex] = { ...updated[rowIndex], saved: true, saving: false };
        return updated;
      });
    } catch (err: any) {
      console.error('Save error:', err);
      toast({ title: t.common.error, description: err.message, variant: 'destructive' });
      setRows(prev => {
        const updated = [...prev];
        updated[rowIndex] = { ...updated[rowIndex], saving: false };
        return updated;
      });
    }
  }, [rows, user, criteria, sessionId, buildSnapshot, calcBehaviorTotal, t]);

  // Auto-save when all criteria for a row are filled
  useEffect(() => {
    rows.forEach((row, idx) => {
      const allFilled = criteria.every(c => row.scores[c.key] !== undefined);
      if (allFilled && !row.saved && !row.saving) {
        saveRow(idx);
      }
    });
  }, [rows, criteria, saveRow]);

  const handleSaveAll = async () => {
    setSavingAll(true);
    try {
      const promises = rows.map((row, idx) => {
        const allFilled = criteria.every(c => row.scores[c.key] !== undefined);
        if (allFilled && !row.saved) return saveRow(idx);
        return Promise.resolve();
      });
      await Promise.all(promises);
      toast({ title: t.common.success, description: isRTL ? 'تم حفظ كل التقييمات' : 'All evaluations saved' });
    } finally {
      setSavingAll(false);
    }
  };

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    const criterion = criteria[colIdx];
    if (!criterion) return;

    // Number keys to select rubric level
    const numKey = parseInt(e.key);
    if (!isNaN(numKey) && numKey >= 1 && numKey <= criterion.rubric_levels.length) {
      e.preventDefault();
      const level = criterion.rubric_levels[numKey - 1];
      if (level) setScore(rowIdx, criterion.key, level.value);
      // Move to next column
      if (colIdx < criteria.length - 1) {
        focusRef.current = { row: rowIdx, col: colIdx + 1 };
      } else if (rowIdx < rows.length - 1) {
        focusRef.current = { row: rowIdx + 1, col: 0 };
      }
    }

    // Arrow keys
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = (e.key === 'ArrowRight' && !isRTL) || (e.key === 'ArrowLeft' && isRTL) ? 1 : -1;
      const newCol = Math.max(0, Math.min(criteria.length - 1, colIdx + dir));
      focusRef.current = { row: rowIdx, col: newCol };
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const newRow = Math.max(0, Math.min(rows.length - 1, rowIdx + dir));
      focusRef.current = { row: newRow, col: colIdx };
    }
  }, [criteria, rows, isRTL, setScore]);

  if (!attendanceComplete) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6">
          <Info className="h-5 w-5 text-muted-foreground" />
          <p className="text-muted-foreground">{t.evaluation.attendanceNotComplete}</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (criteria.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6">
          <Info className="h-5 w-5 text-muted-foreground" />
          <p className="text-muted-foreground">{isRTL ? 'لا توجد معايير تقييم لهذه الفئة العمرية' : 'No evaluation criteria for this age group'}</p>
        </CardContent>
      </Card>
    );
  }

  const isSmallAge = criteria.length <= 8 && criteria.every(c => c.rubric_levels.length <= 3);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              {t.evaluation.title}
            </CardTitle>
            <CardDescription>{isRTL ? 'اختر درجة لكل معيار لكل طالب' : 'Select a score for each criterion per student'}</CardDescription>
          </div>
          <Button onClick={handleSaveAll} disabled={savingAll || rows.every(r => r.saved)}>
            {savingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {t.evaluation.saveAll}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={gridRef} className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky start-0 bg-background z-10 min-w-[120px]">{isRTL ? 'الطالب' : 'Student'}</TableHead>
                {criteria.map(c => (
                  <TableHead key={c.key} className="text-center min-w-[100px]">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help flex flex-col items-center gap-0.5">
                            <span className="text-xs font-medium">{language === 'ar' ? c.name_ar : c.name}</span>
                            <Badge variant="outline" className="text-[10px]">{c.max_score}</Badge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-medium">{language === 'ar' ? c.name_ar : c.name}</p>
                            {(language === 'ar' ? c.description_ar : c.description) && (
                              <p className="text-xs">{language === 'ar' ? c.description_ar : c.description}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {c.rubric_levels.map(l => (
                                <Badge key={l.value} variant="secondary" className="text-[10px]">
                                  {l.value}: {language === 'ar' ? l.label_ar : l.label}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                ))}
                <TableHead className="text-center min-w-[70px]">{t.evaluation.behaviorScore}</TableHead>
                <TableHead className="text-center min-w-[60px]">{t.evaluation.quizScore}</TableHead>
                <TableHead className="text-center min-w-[60px]">{t.evaluation.assignmentScore}</TableHead>
                <TableHead className="text-center min-w-[60px]">{t.evaluation.total}</TableHead>
                <TableHead className="text-center min-w-[50px]">%</TableHead>
                <TableHead className="text-center min-w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIdx) => {
                const behaviorTotal = calcBehaviorTotal(row.scores);
                const quizS = row.quiz_score ?? 0;
                const assignS = row.assignment_score ?? 0;
                const totalS = behaviorTotal + quizS + assignS;
                const maxQuiz = row.quiz_max_score ?? 0;
                const maxAssign = row.assignment_max_score ?? 0;
                const maxTotal = calcMaxBehavior + maxQuiz + maxAssign;
                const pct = maxTotal > 0 ? Math.round((totalS / maxTotal) * 100) : 0;

                return (
                  <TableRow key={row.student_id}>
                    <TableCell className="sticky start-0 bg-background z-10 font-medium text-sm">
                      {language === 'ar' ? row.student_name_ar : row.student_name}
                    </TableCell>
                    {criteria.map((c, colIdx) => (
                      <TableCell key={c.key} className="p-1">
                        <div
                          className="flex flex-wrap justify-center gap-1"
                          tabIndex={0}
                          onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                          data-row={rowIdx}
                          data-col={colIdx}
                        >
                          {c.rubric_levels.map((level, levelIdx) => {
                            const selected = row.scores[c.key] === level.value;
                            return (
                              <button
                                key={level.value}
                                onClick={() => setScore(rowIdx, c.key, level.value)}
                                className={cn(
                                  'text-[10px] px-1.5 py-0.5 rounded border transition-all font-medium',
                                  selected
                                    ? isSmallAge
                                      ? level.value === 0
                                        ? 'bg-destructive text-destructive-foreground border-destructive'
                                        : level.value === c.max_score
                                          ? 'bg-primary text-primary-foreground border-primary'
                                          : 'bg-secondary text-secondary-foreground border-secondary'
                                      : 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-muted text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
                                )}
                                title={`${levelIdx + 1}: ${language === 'ar' ? level.label_ar : level.label}`}
                              >
                                {level.value}
                              </button>
                            );
                          })}
                        </div>
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-semibold text-sm">
                      {behaviorTotal}/{calcMaxBehavior}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {row.quiz_score != null ? `${row.quiz_score}/${row.quiz_max_score}` : '-'}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {row.assignment_score != null ? `${row.assignment_score}/${row.assignment_max_score}` : '-'}
                    </TableCell>
                    <TableCell className="text-center font-bold text-sm">
                      {totalS}/{maxTotal}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={pct >= 90 ? 'default' : pct >= 70 ? 'secondary' : 'outline'} className="text-[10px]">
                        {pct}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {row.saving ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mx-auto" />
                      ) : row.saved ? (
                        <CheckCircle className="h-3 w-3 text-primary mx-auto" />
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Notes & Tags section for admin/instructor */}
        {(role === 'admin' || role === 'instructor') && rows.length > 0 && (
          <div className="mt-6 space-y-4 border-t pt-4">
            <h4 className="text-sm font-medium">{t.evaluation.notes} & {t.evaluation.feedbackTags}</h4>
            {rows.map((row, rowIdx) => (
              <div key={row.student_id} className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="min-w-[100px] text-sm font-medium">
                  {language === 'ar' ? row.student_name_ar : row.student_name}
                </div>
                <div className="flex-1 space-y-2">
                  <Textarea
                    placeholder={isRTL ? 'ملاحظات داخلية (لا تظهر للطالب)...' : 'Internal notes (not visible to student)...'}
                    value={row.notes}
                    onChange={(e) => {
                      setRows(prev => {
                        const updated = [...prev];
                        updated[rowIdx] = { ...updated[rowIdx], notes: e.target.value, saved: false };
                        return updated;
                      });
                    }}
                    className="text-xs h-16"
                  />
                  <div className="flex flex-wrap gap-1">
                    {FEEDBACK_TAGS.map(tag => {
                      const label = isRTL ? tag.ar : tag.en;
                      const active = row.feedback_tags.includes(tag.en);
                      return (
                        <button
                          key={tag.en}
                          onClick={() => {
                            setRows(prev => {
                              const updated = [...prev];
                              const tags = active
                                ? updated[rowIdx].feedback_tags.filter(t => t !== tag.en)
                                : [...updated[rowIdx].feedback_tags, tag.en];
                              updated[rowIdx] = { ...updated[rowIdx], feedback_tags: tags, saved: false };
                              return updated;
                            });
                          }}
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full border transition-all',
                            active
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
