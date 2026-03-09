import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, XCircle, AlertTriangle, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PlacementAttempt {
  id: string;
  student_id: string;
  age_group: string;
  attempt_number: number;
  status: string;
  total_score: number | null;
  max_score: number | null;
  percentage: number | null;
  recommended_level: string | null;
  confidence_level: string | null;
  needs_manual_review: boolean;
  weak_skills: any;
  foundation_score: number | null;
  foundation_max: number | null;
  intermediate_score: number | null;
  intermediate_max: number | null;
  advanced_score: number | null;
  advanced_max: number | null;
}

interface Level {
  id: string;
  name: string;
  name_ar: string;
  level_order: number;
}

interface AttemptQuestion {
  question_id: number;
  order_index: number;
  student_answer: string | null;
  is_correct: boolean | null;
  question_text_ar: string;
  options: Record<string, string>;
  correct_answer: string;
  skill: string;
  level: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attempt: PlacementAttempt | null;
  levels: Level[];
  isRTL: boolean;
  onApproveLevel: (attempt: PlacementAttempt, levelId: string) => void;
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
      // Fetch attempt questions
      const { data: aqData } = await (supabase
        .from('placement_exam_attempt_questions' as any)
        .select('question_id, order_index, student_answer, is_correct')
        .eq('attempt_id', attemptId) as any)
        .order('order_index');

      if (!aqData || aqData.length === 0) {
        setQuestions([]);
        return;
      }

      const questionIds = aqData.map((q: any) => q.question_id);

      // Fetch question bank details
      const { data: bankData } = await (supabase
        .from('placement_question_bank' as any)
        .select('id, question_text_ar, options, correct_answer, skill, level') as any)
        .in('id', questionIds);

      const bankMap = new Map((bankData || []).map((q: any) => [q.id, q]));

      const merged: AttemptQuestion[] = aqData.map((aq: any) => {
        const bank: any = bankMap.get(aq.question_id) || {};
        return {
          question_id: aq.question_id,
          order_index: aq.order_index,
          student_answer: aq.student_answer,
          is_correct: aq.is_correct,
          question_text_ar: bank.question_text_ar || '',
          options: bank.options || {},
          correct_answer: bank.correct_answer || '',
          skill: bank.skill || '',
          level: bank.level || '',
        };
      });

      setQuestions(merged);
    } catch (err) {
      console.error('Failed to fetch attempt questions:', err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  if (!attempt) return null;

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'foundation': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'intermediate': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'advanced': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isRTL ? 'تفاصيل الامتحان' : 'Exam Details'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          <div className="space-y-4 pb-4">
            {/* Level breakdown */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Foundation', score: attempt.foundation_score, max: attempt.foundation_max },
                { label: 'Intermediate', score: attempt.intermediate_score, max: attempt.intermediate_max },
                { label: 'Advanced', score: attempt.advanced_score, max: attempt.advanced_max },
              ].map(item => (
                <Card key={item.label}>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-lg font-bold">{item.score}/{item.max}</p>
                    <p className="text-xs">
                      {item.max ? Math.round(((item.score || 0) / item.max) * 100) : 0}%
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Weak skills */}
            {attempt.weak_skills && Array.isArray(attempt.weak_skills) && attempt.weak_skills.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">{isRTL ? 'مهارات ضعيفة' : 'Weak Skills'}</p>
                <div className="flex flex-wrap gap-2">
                  {attempt.weak_skills.map((ws: any, i: number) => (
                    <Badge key={i} variant="destructive">{ws.skill} ({ws.rate}%)</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended level */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <span className="text-sm font-medium">{isRTL ? 'المستوى المقترح' : 'Recommended Level'}</span>
              <Badge className="text-base">{attempt.recommended_level}</Badge>
            </div>

            {attempt.needs_manual_review && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-sm text-amber-800 dark:text-amber-300">
                  {isRTL ? 'يحتاج مراجعة يدوية — الثقة منخفضة أو نتائج غير متسقة' : 'Needs manual review — low confidence or inconsistent results'}
                </span>
              </div>
            )}

            {/* Approve with level selection */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{isRTL ? 'اعتماد المستوى' : 'Assign Level'}</p>
              <div className="flex gap-2">
                {attempt.recommended_level && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const matchLevel = levels.find(l =>
                        l.name.toLowerCase().includes(attempt.recommended_level!.toLowerCase())
                      );
                      if (matchLevel) onApproveLevel(attempt, matchLevel.id);
                    }}
                    disabled={approving}
                  >
                    <CheckCircle className="h-4 w-4 me-1" />
                    {isRTL ? 'موافقة على المقترح' : 'Approve Recommended'}
                  </Button>
                )}
                <Select onValueChange={val => onApproveLevel(attempt, val)} disabled={approving}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={isRTL ? 'مستوى آخر' : 'Override'} />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map(l => (
                      <SelectItem key={l.id} value={l.id}>
                        {isRTL ? l.name_ar : l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Questions Preview */}
            <div className="space-y-2 pt-2 border-t">
              <p className="text-sm font-semibold">
                {isRTL ? `الأسئلة والإجابات (${questions.length})` : `Questions & Answers (${questions.length})`}
              </p>

              {loadingQuestions ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : questions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {isRTL ? 'لا توجد بيانات أسئلة' : 'No question data available'}
                </p>
              ) : (
                <div className="space-y-3">
                  {questions.map((q, idx) => {
                    const options = typeof q.options === 'object' ? q.options : {};
                    const optionEntries = Object.entries(options);

                    return (
                      <Card key={q.question_id} className={`border ${
                        q.is_correct === true
                          ? 'border-green-200 dark:border-green-800'
                          : q.is_correct === false
                          ? 'border-red-200 dark:border-red-800'
                          : 'border-muted'
                      }`}>
                        <CardContent className="pt-3 pb-3 space-y-2">
                          {/* Question header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-mono text-muted-foreground shrink-0">
                                {q.order_index}.
                              </span>
                              {q.is_correct === true ? (
                                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                              ) : q.is_correct === false ? (
                                <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                              ) : (
                                <Minus className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <p className="text-sm font-medium leading-relaxed" dir="rtl" style={{ unicodeBidi: 'plaintext' }}>
                                {q.question_text_ar}
                              </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Badge variant="outline" className={`text-[10px] ${getLevelBadgeColor(q.level)}`}>
                                {q.level}
                              </Badge>
                            </div>
                          </div>

                          {/* Options */}
                          <div className="grid grid-cols-1 gap-1 ms-6">
                            {optionEntries.map(([key, value]) => {
                              const isCorrectAnswer = key === q.correct_answer;
                              const isStudentAnswer = key === q.student_answer;
                              const isWrong = isStudentAnswer && !q.is_correct;

                              return (
                                <div
                                  key={key}
                                  dir="rtl"
                                  className={`text-xs px-2 py-1 rounded flex items-center gap-2 ${
                                    isCorrectAnswer
                                      ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300 font-medium'
                                      : isWrong
                                      ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 line-through'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  <span className="font-mono text-[10px] shrink-0">{key}</span>
                                  <span style={{ unicodeBidi: 'plaintext' }}>{value as string}</span>
                                  {isCorrectAnswer && (
                                    <CheckCircle className="h-3 w-3 text-green-600 shrink-0 ms-auto" />
                                  )}
                                  {isWrong && (
                                    <XCircle className="h-3 w-3 text-red-500 shrink-0 ms-auto" />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Skill tag */}
                          <div className="ms-6">
                            <span className="text-[10px] text-muted-foreground">{q.skill}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
