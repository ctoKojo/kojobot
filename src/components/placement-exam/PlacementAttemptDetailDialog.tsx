import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, AlertTriangle, Minus, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/* ── V2 Attempt shape ── */
interface V2Attempt {
  id: string;
  student_id: string;
  attempt_number: number;
  status: string;
  section_a_score: number | null;
  section_a_max: number | null;
  section_a_passed: boolean | null;
  section_b_score: number | null;
  section_b_max: number | null;
  section_b_passed: boolean | null;
  section_c_software_score: number | null;
  section_c_software_max: number | null;
  section_c_hardware_score: number | null;
  section_c_hardware_max: number | null;
  recommended_track: string | null;
  recommended_level_id: string | null;
  approved_level_id: string | null;
  confidence_level: string | null;
  needs_manual_review: boolean | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

interface Level {
  id: string;
  name: string;
  name_ar: string;
  level_order: number;
  track: string | null;
}

interface AttemptQuestion {
  id: string;
  question_id: number;
  order_index: number;
  section: string;
  section_skill: string;
  student_answer: string | null;
  is_correct: boolean | null;
  // from placement_v2_questions join
  question_text_ar: string;
  options: Record<string, string>;
  correct_answer: string;
  track_category: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attempt: V2Attempt | null;
  levels: Level[];
  isRTL: boolean;
  onApproveLevel: (attempt: V2Attempt, levelId: string) => void;
  approving: boolean;
}

export function PlacementAttemptDetailDialog({
  open, onOpenChange, attempt, levels, isRTL, onApproveLevel, approving,
}: Props) {
  const [questions, setQuestions] = useState<AttemptQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  useEffect(() => {
    if (open && attempt) {
      fetchQuestions(attempt.id);
    } else {
      setQuestions([]);
    }
  }, [open, attempt?.id]);

  const fetchQuestions = async (attemptId: string) => {
    setLoadingQuestions(true);
    try {
      const { data: aqData } = await supabase
        .from('placement_v2_attempt_questions')
        .select('id, question_id, order_index, section, section_skill, student_answer, is_correct')
        .eq('attempt_id', attemptId)
        .order('order_index');

      if (!aqData || aqData.length === 0) { setQuestions([]); return; }

      const questionIds = aqData.map(q => q.question_id);
      const { data: bankData } = await supabase
        .from('placement_v2_questions')
        .select('id, question_text_ar, options, correct_answer, track_category')
        .in('id', questionIds);

      const bankMap = new Map((bankData || []).map((q: any) => [q.id, q]));

      setQuestions(aqData.map((aq: any) => {
        const bank: any = bankMap.get(aq.question_id) || {};
        return {
          ...aq,
          question_text_ar: bank.question_text_ar || '',
          options: (typeof bank.options === 'object' ? bank.options : {}) as Record<string, string>,
          correct_answer: bank.correct_answer || '',
          track_category: bank.track_category || null,
        };
      }));
    } catch (err) {
      console.error('Failed to fetch v2 attempt questions:', err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  if (!attempt) return null;

  const pct = (s: number | null, m: number | null) => {
    if (s == null || !m) return '—';
    return `${s}/${m} (${Math.round((s / m) * 100)}%)`;
  };

  const isBalanced = attempt.recommended_track === 'balanced';
  const isReviewed = attempt.status === 'reviewed';

  // Group questions by section
  const sectionA = questions.filter(q => q.section === 'section_a');
  const sectionB = questions.filter(q => q.section === 'section_b');
  const sectionC = questions.filter(q => q.section === 'section_c');

  const renderQuestion = (q: AttemptQuestion, idx: number) => {
    const opts = typeof q.options === 'object' ? q.options : {};
    return (
      <Card key={q.id} className={`border ${
        q.is_correct === true ? 'border-green-200 dark:border-green-800'
        : q.is_correct === false ? 'border-red-200 dark:border-red-800'
        : 'border-muted'
      }`}>
        <CardContent className="pt-3 pb-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-mono text-muted-foreground shrink-0">{idx + 1}.</span>
              {q.is_correct === true ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                : q.is_correct === false ? <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                : <Minus className="h-4 w-4 text-muted-foreground shrink-0" />}
              <p className="text-sm font-medium leading-relaxed" dir="rtl" style={{ unicodeBidi: 'plaintext' }}>
                {q.question_text_ar}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">{q.section_skill}</Badge>
          </div>

          <div className="grid grid-cols-1 gap-1 ms-6">
            {Object.entries(opts).map(([key, value]) => {
              const isCorrect = key === q.correct_answer;
              const isStudent = key === q.student_answer;
              const isWrong = isStudent && !q.is_correct;
              return (
                <div key={key} dir="rtl" className={`text-xs px-2 py-1 rounded flex items-center gap-2 ${
                  isCorrect ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300 font-medium'
                  : isWrong ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 line-through'
                  : 'text-muted-foreground'
                }`}>
                  <span className="font-mono text-[10px] shrink-0">{key}</span>
                  <span style={{ unicodeBidi: 'plaintext' }}>{value as string}</span>
                  {isCorrect && <CheckCircle className="h-3 w-3 text-green-600 shrink-0 ms-auto" />}
                  {isWrong && <XCircle className="h-3 w-3 text-red-500 shrink-0 ms-auto" />}
                </div>
              );
            })}
          </div>

          {q.track_category && (
            <div className="ms-6">
              <Badge variant="outline" className="text-[10px]">{q.track_category}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderSectionBlock = (title: string, qs: AttemptQuestion[]) => {
    if (qs.length === 0) return null;
    const correct = qs.filter(q => q.is_correct).length;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm">{title}</h4>
          <Badge variant="outline">{correct}/{qs.length}</Badge>
        </div>
        <div className="space-y-2">{qs.map((q, i) => renderQuestion(q, i))}</div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isRTL ? 'تفاصيل الامتحان' : 'Exam Details'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          <div className="space-y-4 pb-4">
            {/* Section scores */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Section A</p>
                  <p className={`text-lg font-bold ${attempt.section_a_passed ? 'text-green-600' : 'text-red-600'}`}>
                    {pct(attempt.section_a_score, attempt.section_a_max)}
                  </p>
                  <Badge variant={attempt.section_a_passed ? 'default' : 'destructive'} className="text-xs mt-1">
                    {attempt.section_a_passed ? (isRTL ? 'نجح' : 'Passed') : (isRTL ? 'رسب' : 'Failed')}
                  </Badge>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Section B</p>
                  <p className={`text-lg font-bold ${attempt.section_b_passed ? 'text-green-600' : 'text-red-600'}`}>
                    {pct(attempt.section_b_score, attempt.section_b_max)}
                  </p>
                  <Badge variant={attempt.section_b_passed ? 'default' : 'destructive'} className="text-xs mt-1">
                    {attempt.section_b_passed ? (isRTL ? 'نجح' : 'Passed') : (isRTL ? 'رسب' : 'Failed')}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Section C scores */}
            {(attempt.section_c_software_max || attempt.section_c_hardware_max) && (
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-muted-foreground">Section C — Software</p>
                    <p className="text-lg font-bold">{pct(attempt.section_c_software_score, attempt.section_c_software_max)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-muted-foreground">Section C — Hardware</p>
                    <p className="text-lg font-bold">{pct(attempt.section_c_hardware_score, attempt.section_c_hardware_max)}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Track + Confidence */}
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <span className="text-sm text-muted-foreground">{isRTL ? 'المسار المقترح' : 'Recommended Track'}:</span>
              <Badge variant={isBalanced ? 'destructive' : 'default'} className="capitalize">
                {attempt.recommended_track || '—'}
              </Badge>
              <span className="text-sm text-muted-foreground ms-auto">{isRTL ? 'الثقة' : 'Confidence'}:</span>
              {(() => {
                const v: Record<string, 'default' | 'secondary' | 'destructive'> = { high: 'default', medium: 'secondary', low: 'destructive' };
                return <Badge variant={v[attempt.confidence_level || ''] || 'secondary'} className="capitalize">{attempt.confidence_level || '—'}</Badge>;
              })()}
            </div>

            {/* Balanced warning */}
            {isBalanced && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-sm text-amber-800 dark:text-amber-300">
                  {isRTL
                    ? 'النتائج متوازنة — لم يتم تحديد مسار تلقائياً. يرجى المراجعة اليدوية واختيار المستوى.'
                    : 'Results are balanced — no track was auto-assigned. Please review manually and assign a level.'}
                </span>
              </div>
            )}

            {attempt.needs_manual_review && !isBalanced && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-sm text-amber-800 dark:text-amber-300">
                  {isRTL ? 'يحتاج مراجعة يدوية — مستوى ثقة منخفض أو نتائج غير متسقة' : 'Needs manual review — low confidence or inconsistent results'}
                </span>
              </div>
            )}

            {/* Approval section */}
            {!isReviewed ? (
              <div className="space-y-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
                <p className="text-sm font-medium">{isRTL ? 'اعتماد المستوى' : 'Approve Level'}</p>
                <div className="flex gap-2 flex-wrap">
                  {attempt.recommended_level_id && (
                    <Button
                      size="sm"
                      onClick={() => onApproveLevel(attempt, attempt.recommended_level_id!)}
                      disabled={approving}
                    >
                      <CheckCircle className="h-4 w-4 me-1" />
                      {isRTL ? 'موافقة على المقترح' : 'Approve Recommended'}
                    </Button>
                  )}
                  <Select onValueChange={val => onApproveLevel(attempt, val)} disabled={approving}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder={isRTL ? 'اختر مستوى آخر' : 'Override level'} />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map(l => (
                        <SelectItem key={l.id} value={l.id}>
                          {isRTL ? l.name_ar : l.name} {l.track ? `(${l.track})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                <span className="text-sm text-green-800 dark:text-green-300">
                  {isRTL ? 'تم اعتماد المستوى' : 'Level approved'}
                  {attempt.approved_level_id && (() => {
                    const lvl = levels.find(l => l.id === attempt.approved_level_id);
                    return lvl ? ` — ${isRTL ? lvl.name_ar : lvl.name}` : '';
                  })()}
                </span>
              </div>
            )}

            {/* Questions grouped by section */}
            <div className="space-y-4 pt-2 border-t">
              <p className="text-sm font-semibold">
                {isRTL ? `الأسئلة والإجابات (${questions.length})` : `Questions & Answers (${questions.length})`}
              </p>

              {loadingQuestions ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : questions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {isRTL ? 'لا توجد بيانات أسئلة' : 'No question data available'}
                </p>
              ) : (
                <div className="space-y-6">
                  {renderSectionBlock('Section A', sectionA)}
                  {renderSectionBlock('Section B', sectionB)}
                  {renderSectionBlock('Section C', sectionC)}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
