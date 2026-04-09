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
import { Progress } from '@/components/ui/progress';
import { Save, CheckCircle, Loader2, Info, Star, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { StarRating } from './StarRating';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
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
  saveError: boolean;
  isDirty: boolean;
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

// Helper to build tooltip labels from rubric levels for StarRating
function buildStarLabels(criterion: Criterion, lang: string) {
  return criterion.rubric_levels
    .filter(l => l.value > 0)
    .map(l => ({ value: l.value, label: lang === 'ar' ? l.label_ar : l.label }));
}

function getPercentColor(pct: number) {
  if (pct >= 85) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 70) return 'text-lime-600 dark:text-lime-400';
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-destructive';
}

// ======================= Student Card Component =======================
function StudentEvalCard({
  row,
  rowIdx,
  criteria,
  calcMaxBehavior,
  calcBehaviorTotal,
  setScore,
  setRows,
  language,
  isRTL,
  canManage,
}: {
  row: StudentRow;
  rowIdx: number;
  criteria: Criterion[];
  calcMaxBehavior: number;
  calcBehaviorTotal: (scores: Record<string, number>) => number;
  setScore: (rowIdx: number, key: string, value: number) => void;
  setRows: React.Dispatch<React.SetStateAction<StudentRow[]>>;
  language: string;
  isRTL: boolean;
  canManage: boolean;
}) {
  const behaviorTotal = calcBehaviorTotal(row.scores);
  const quizS = row.quiz_score ?? 0;
  const assignS = row.assignment_score ?? 0;
  const totalS = behaviorTotal + quizS + assignS;
  const maxQuiz = row.quiz_max_score ?? 0;
  const maxAssign = row.assignment_max_score ?? 0;
  const maxTotal = calcMaxBehavior + maxQuiz + maxAssign;
  const pct = maxTotal > 0 ? Math.round((totalS / maxTotal) * 100) : 0;

  // Progress: how many criteria have been scored
  const filledCount = criteria.filter(c => row.scores[c.key] !== undefined).length;
  const progressPct = criteria.length > 0 ? Math.round((filledCount / criteria.length) * 100) : 0;

  return (
    <Card className="border shadow-sm">
      {/* Header: Name + Progress + Save status */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">
              {language === 'ar' ? row.student_name_ar : row.student_name}
            </span>
            {row.saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
            ) : row.saved ? (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : null}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <Progress value={progressPct} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {filledCount}/{criteria.length}
            </span>
          </div>
        </div>
      </div>

      {/* Criteria Grid */}
      <div className="px-4 py-2 space-y-2">
        {criteria.map((c, colIdx) => {
          const selectedValue = row.scores[c.key];
          const isEven = colIdx % 2 === 0;
          return (
            <div
              key={c.key}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg transition-colors',
                isEven ? 'bg-muted/40' : ''
              )}
            >
              {/* Criterion label */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs font-medium min-w-[80px] sm:min-w-[100px] cursor-help truncate">
                      {language === 'ar' ? c.name_ar : c.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-medium text-sm">{language === 'ar' ? c.name_ar : c.name}</p>
                    {(language === 'ar' ? c.description_ar : c.description) && (
                      <p className="text-xs mt-1">{language === 'ar' ? c.description_ar : c.description}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Star Rating */}
              <div className="flex-1 flex justify-center">
                <StarRating
                  value={selectedValue}
                  maxScore={c.max_score}
                  onChange={(v) => setScore(rowIdx, c.key, v)}
                  labels={buildStarLabels(c, language)}
                  size="md"
                />
              </div>

              {/* Score for this criterion */}
              <span className={cn(
                'text-xs font-bold min-w-[40px] text-end',
                selectedValue !== undefined ? 'text-foreground' : 'text-muted-foreground/50'
              )}>
                {selectedValue !== undefined ? `${selectedValue}/${c.max_score}` : `-/${c.max_score}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Notes & Tags (integrated, admin/instructor only) */}
      {canManage && (
        <div className="px-4 py-2 space-y-2 border-t border-border/50">
          <Textarea
            placeholder={isRTL ? 'ملاحظات داخلية (لا تظهر للطالب)...' : 'Internal notes (not visible to student)...'}
            value={row.notes}
            onChange={(e) => {
              setRows(prev => {
                const updated = [...prev];
                updated[rowIdx] = { ...updated[rowIdx], notes: e.target.value, saved: false, isDirty: true };
                return updated;
              });
            }}
            className="text-xs min-h-[48px] resize-none"
          />
          <div className="flex flex-wrap gap-1.5">
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
                      updated[rowIdx] = { ...updated[rowIdx], feedback_tags: tags, saved: false, isDirty: true };
                      return updated;
                    });
                  }}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-all',
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
      )}

      {/* Summary Footer */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 border-t bg-muted/30 rounded-b-lg text-xs">
        <span>
          <span className="text-muted-foreground">{isRTL ? 'السلوك' : 'Behavior'}:</span>{' '}
          <span className="font-semibold">{behaviorTotal}/{calcMaxBehavior}</span>
        </span>
        {row.quiz_score != null && (
          <span>
            <span className="text-muted-foreground">{isRTL ? 'كويز' : 'Quiz'}:</span>{' '}
            <span className="font-semibold">{row.quiz_score}/{row.quiz_max_score}</span>
          </span>
        )}
        {row.assignment_score != null && (
          <span>
            <span className="text-muted-foreground">{isRTL ? 'واجب' : 'HW'}:</span>{' '}
            <span className="font-semibold">{row.assignment_score}/{row.assignment_max_score}</span>
          </span>
        )}
        {(row.quiz_score != null || row.assignment_score != null) ? (
          <span className="ms-auto">
            <span className="text-muted-foreground">{isRTL ? 'الإجمالي' : 'Total'}:</span>{' '}
            <span className="font-bold">{totalS}/{maxTotal}</span>{' '}
            <span className={cn('font-bold', getPercentColor(pct))}>({pct}%)</span>
          </span>
        ) : (
          <span className="ms-auto">
            <span className={cn('font-bold', getPercentColor(pct))}>({pct}%)</span>
          </span>
        )}
      </div>
    </Card>
  );
}

// ======================= Main Component =======================
export function SessionEvaluationGrid({ sessionId, groupId, ageGroupId, students: studentsProp, attendanceComplete }: Props) {
  const { language, isRTL, t } = useLanguage();
  const { user, role } = useAuth();
  const isMobile = useIsMobile();
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const focusRef = useRef<{ row: number; col: number }>({ row: 0, col: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  // Default view based on screen size
  useEffect(() => {
    setViewMode(isMobile ? 'cards' : 'table');
  }, [isMobile]);

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
        rubric_levels: (Array.isArray(c.rubric_levels) ? c.rubric_levels : []).map((l: any) => ({
          value: l.value ?? l.score ?? 0,
          label: l.label ?? '',
          label_ar: l.label_ar ?? '',
        })) as RubricLevel[],
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
          saveError: false,
          isDirty: false,
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
        saveError: false,
        isDirty: true,
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

    // Verify student has attendance record before inserting evaluation
    if (!row.existing_id) {
      const { data: attRecord } = await supabase
        .from('attendance')
        .select('id')
        .eq('session_id', sessionId)
        .eq('student_id', row.student_id)
        .maybeSingle();
      if (!attRecord) {
        console.warn(`Skipping evaluation save for student ${row.student_id}: no attendance record`);
        return;
      }
    }

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
        updated[rowIndex] = { ...updated[rowIndex], saved: true, saving: false, isDirty: false };
        return updated;
      });
    } catch (err: any) {
      console.error('Save error:', err);
      toast({ title: t.common.error, description: err.message, variant: 'destructive' });
      setRows(prev => {
        const updated = [...prev];
        updated[rowIndex] = { ...updated[rowIndex], saving: false, saveError: true };
        return updated;
      });
    }
  }, [rows, user, criteria, sessionId, buildSnapshot, calcBehaviorTotal, t]);

  // Auto-save when all criteria for a row are filled
  useEffect(() => {
    rows.forEach((row, idx) => {
      const allFilled = criteria.every(c => row.scores[c.key] !== undefined);
      if (allFilled && !row.saved && !row.saving && !row.saveError) {
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

  const canManage = role === 'admin' || role === 'instructor';

  // ===== Early returns =====
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              {t.evaluation.title}
            </CardTitle>
            <CardDescription>{isRTL ? 'اختر درجة لكل معيار لكل طالب' : 'Select a score for each criterion per student'}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('cards')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'cards' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                )}
                title={isRTL ? 'عرض البطاقات' : 'Card View'}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                )}
                title={isRTL ? 'عرض الجدول' : 'Table View'}
              >
                <TableIcon className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={handleSaveAll} disabled={savingAll} size="sm">
              {savingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="hidden sm:inline ms-1">{t.evaluation.saveAll}</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === 'cards' ? (
          /* ===== CARD VIEW ===== */
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {rows.map((row, rowIdx) => (
              <StudentEvalCard
                key={row.student_id}
                row={row}
                rowIdx={rowIdx}
                criteria={criteria}
                calcMaxBehavior={calcMaxBehavior}
                calcBehaviorTotal={calcBehaviorTotal}
                setScore={setScore}
                setRows={setRows}
                language={language}
                isRTL={isRTL}
                canManage={canManage}
              />
            ))}
          </div>
        ) : (
          /* ===== TABLE VIEW (improved) ===== */
          <div ref={gridRef} className="overflow-x-auto">
            <table className="w-full caption-bottom text-sm">
              <thead>
                <tr className="border-b">
                  <th className="sticky start-0 bg-background z-10 min-w-[120px] h-12 px-3 text-start font-medium text-muted-foreground">
                    {isRTL ? 'الطالب' : 'Student'}
                  </th>
                  {criteria.map(c => (
                    <th key={c.key} className="text-center min-w-[100px] h-12 px-2 font-medium text-muted-foreground">
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
                    </th>
                  ))}
                  <th className="text-center min-w-[70px] h-12 px-2 font-medium text-muted-foreground">{t.evaluation.behaviorScore}</th>
                  <th className="text-center min-w-[60px] h-12 px-2 font-medium text-muted-foreground">{t.evaluation.quizScore}</th>
                  <th className="text-center min-w-[60px] h-12 px-2 font-medium text-muted-foreground">{t.evaluation.assignmentScore}</th>
                  <th className="text-center min-w-[60px] h-12 px-2 font-medium text-muted-foreground">{t.evaluation.total}</th>
                  <th className="text-center min-w-[50px] h-12 px-2 font-medium text-muted-foreground">%</th>
                  <th className="text-center min-w-[40px] h-12 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => {
                  const behaviorTotal = calcBehaviorTotal(row.scores);
                  const quizS = row.quiz_score ?? 0;
                  const assignS = row.assignment_score ?? 0;
                  const totalS = behaviorTotal + quizS + assignS;
                  const maxQuiz = row.quiz_max_score ?? 0;
                  const maxAssign = row.assignment_max_score ?? 0;
                  const maxTotal = calcMaxBehavior + maxQuiz + maxAssign;
                  const pct = maxTotal > 0 ? Math.round((totalS / maxTotal) * 100) : 0;
                  const isEvenRow = rowIdx % 2 === 0;

                  return (
                    <tr
                      key={row.student_id}
                      className={cn(
                        'border-b transition-colors hover:bg-muted/50',
                        isEvenRow && 'bg-muted/20'
                      )}
                    >
                      <td className="sticky start-0 bg-background z-10 font-medium text-sm p-3">
                        {language === 'ar' ? row.student_name_ar : row.student_name}
                      </td>
                      {criteria.map((c, colIdx) => (
                        <td key={c.key} className="p-1.5">
                          <div
                            className="flex justify-center"
                            tabIndex={0}
                            onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                            data-row={rowIdx}
                            data-col={colIdx}
                          >
                            <StarRating
                              value={row.scores[c.key]}
                              maxScore={c.max_score}
                              onChange={(v) => setScore(rowIdx, c.key, v)}
                              labels={buildStarLabels(c, language)}
                              size="sm"
                            />
                          </div>
                        </td>
                      ))}
                      <td className="text-center font-semibold text-sm p-2">{behaviorTotal}/{calcMaxBehavior}</td>
                      <td className="text-center text-sm text-muted-foreground p-2">
                        {row.quiz_score != null ? `${row.quiz_score}/${row.quiz_max_score}` : '-'}
                      </td>
                      <td className="text-center text-sm text-muted-foreground p-2">
                        {row.assignment_score != null ? `${row.assignment_score}/${row.assignment_max_score}` : '-'}
                      </td>
                      <td className="text-center font-bold text-sm p-2">{totalS}/{maxTotal}</td>
                      <td className="text-center p-2">
                        <Badge variant={pct >= 90 ? 'default' : pct >= 70 ? 'secondary' : 'outline'} className="text-xs">
                          {pct}%
                        </Badge>
                      </td>
                      <td className="text-center p-2">
                        {row.saving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mx-auto" />
                        ) : row.saved ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Notes & Tags for table view */}
            {canManage && rows.length > 0 && (
              <div className="mt-6 space-y-3 border-t pt-4">
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
                            updated[rowIdx] = { ...updated[rowIdx], notes: e.target.value, saved: false, isDirty: true };
                            return updated;
                          });
                        }}
                        className="text-xs h-16"
                      />
                      <div className="flex flex-wrap gap-1.5">
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
                                  updated[rowIdx] = { ...updated[rowIdx], feedback_tags: tags, saved: false, isDirty: true };
                                  return updated;
                                });
                              }}
                              className={cn(
                                'text-xs px-2.5 py-1 rounded-full border transition-all',
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
