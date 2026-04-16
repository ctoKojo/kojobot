import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, CheckCircle2, XCircle, Clock, CircleDashed, ArrowLeft, ArrowRight, FileText, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { CodeBlock } from '@/components/quiz/CodeBlock';

interface StudentQuizResult {
  student_id: string;
  student_name: string;
  student_name_ar: string;
  submission_id: string | null;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  status: 'not_started' | 'in_progress' | 'submitted' | 'graded';
  submitted_at: string | null;
  answers: Record<string, string> | null;
  grading_status: string | null;
}

interface QuestionDetail {
  id: string;
  question_text: string;
  question_text_ar: string;
  options_en: string[];
  options_ar: string[];
  correct_answer: string | null;
  student_answer: string | null;
  is_correct: boolean;
  points: number;
  image_url: string | null;
  code_snippet: string | null;
  question_type: string;
  model_answer: string | null;
  rubric: { steps: string[]; points_per_step: number } | null;
  // Manual grading fields
  attempt_id?: string;
  manual_score?: number | null;
  manual_feedback?: string | null;
}

interface QuizResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizAssignmentId?: string;
  quizId: string;
  quizTitle: string;
  quizTitleAr: string;
  groupId: string;
  passingScore: number;
  /** When true, fetches students from group_student_progress instead of group_students */
  isFinalExam?: boolean;
  selectedStudentId?: string;
}

export function QuizResultsDialog({
  open,
  onOpenChange,
  quizAssignmentId,
  quizId,
  quizTitle,
  quizTitleAr,
  groupId,
  passingScore,
  isFinalExam = false,
  selectedStudentId,
}: QuizResultsDialogProps) {
  const { isRTL, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<StudentQuizResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentQuizResult | null>(null);
  const [questionDetails, setQuestionDetails] = useState<QuestionDetail[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);
  const [manualGrades, setManualGrades] = useState<Record<string, { score: number; feedback: string }>>({});

  useEffect(() => {
    const canFetch = isFinalExam ? Boolean(quizId && groupId) : Boolean(quizAssignmentId);

    if (open && canFetch) {
      fetchResults();
    }
  }, [open, quizAssignmentId, quizId, groupId, isFinalExam, selectedStudentId]);

  useEffect(() => {
    if (!open) {
      setResults([]);
      setSelectedStudent(null);
      setQuestionDetails([]);
      setManualGrades({});
      setLoading(true);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !selectedStudentId || loading || selectedStudent) return;

    const targetStudent = results.find(
      (result) => result.student_id === selectedStudentId && Boolean(result.answers)
    );

    if (targetStudent) {
      void fetchStudentAnswers(targetStudent);
    }
  }, [open, selectedStudentId, loading, results, selectedStudent]);

  const fetchResults = async () => {
    setLoading(true);
    setSelectedStudent(null);
    setQuestionDetails([]);
    setManualGrades({});

    try {
      let studentIds: string[] = [];

      if (isFinalExam) {
        // For final exams: get students from group_student_progress (they may be is_active=false in group_students)
        const { data: progressStudents } = await supabase
          .from('group_student_progress')
          .select('student_id')
          .eq('group_id', groupId)
          .in('status', ['exam_scheduled', 'graded']);

        const progressStudentIds = progressStudents?.map(gs => gs.student_id) || [];
        studentIds = selectedStudentId
          ? progressStudentIds.filter(studentId => studentId === selectedStudentId)
          : progressStudentIds;

        if (selectedStudentId && studentIds.length === 0) {
          studentIds = [selectedStudentId];
        }
      } else {
        const { data: groupStudents } = await supabase
          .from('group_students')
          .select('student_id')
          .eq('group_id', groupId)
          .eq('is_active', true);
        studentIds = groupStudents?.map(gs => gs.student_id) || [];
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ar')
        .in('user_id', studentIds);

      let submissions: any[] = [];
      if (isFinalExam) {
        // For final exams: each student has their own quiz_assignment, fetch by quiz_id + group
        const { data: assignments } = await supabase
          .from('quiz_assignments')
          .select('id, student_id')
          .eq('quiz_id', quizId)
          .eq('group_id', groupId)
          .in('student_id', studentIds);
        const assignmentIds = assignments?.map(a => a.id) || [];
        if (assignmentIds.length > 0) {
          const { data: subs } = await supabase
            .from('quiz_submissions')
            .select('id, student_id, score, max_score, percentage, status, submitted_at, answers, grading_status')
            .in('quiz_assignment_id', assignmentIds);
          submissions = subs || [];
        }
      } else {
        const { data: subs } = await supabase
          .from('quiz_submissions')
          .select('id, student_id, score, max_score, percentage, status, submitted_at, answers, grading_status')
          .eq('quiz_assignment_id', quizAssignmentId);
        submissions = subs || [];
      }

      const combinedResults: StudentQuizResult[] = studentIds.map(studentId => {
        const profile = profiles?.find(p => p.user_id === studentId);
        const submission = submissions?.find(s => s.student_id === studentId);

        let status: 'not_started' | 'in_progress' | 'submitted' | 'graded' = 'not_started';
        if (submission) {
          status = submission.status as typeof status;
        }

        return {
          student_id: studentId,
          student_name: profile?.full_name || 'Unknown',
          student_name_ar: profile?.full_name_ar || profile?.full_name || 'غير معروف',
          submission_id: submission?.id || null,
          score: submission?.score || null,
          max_score: submission?.max_score || null,
          percentage: submission?.percentage || null,
          status,
          submitted_at: submission?.submitted_at || null,
          answers: submission?.answers as Record<string, string> || null,
          grading_status: (submission as any)?.grading_status || null,
        };
      });

      setResults(
        selectedStudentId
          ? combinedResults.sort((a, b) => Number(b.student_id === selectedStudentId) - Number(a.student_id === selectedStudentId))
          : combinedResults
      );
    } catch (error) {
      console.error('Error fetching quiz results:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحميل النتائج' : 'Failed to load results',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentAnswers = async (student: StudentQuizResult) => {
    if (!student.answers) return;

    setLoadingAnswers(true);
    setSelectedStudent(student);
    setManualGrades({});

    try {
      const { data: questions } = await supabase
        .from('quiz_questions')
        .select('id, question_text, question_text_ar, options, correct_answer, points, image_url, code_snippet, question_type, model_answer, rubric')
        .eq('quiz_id', quizId)
        .order('order_index', { ascending: true });

      // Fetch existing attempts for this submission
      let attempts: any[] = [];
      if (student.submission_id) {
        const { data: attemptData } = await supabase
          .from('quiz_question_attempts')
          .select('id, question_id, score, feedback, grading_status')
          .eq('submission_id', student.submission_id);
        attempts = attemptData || [];
      }

      if (questions) {
        const initialGrades: Record<string, { score: number; feedback: string }> = {};
        
        const details: QuestionDetail[] = questions.map(q => {
          const studentAnswer = student.answers?.[q.id] || null;
          
          // Parse options - handle both {en: [], ar: []} and plain array formats
          let optionsEn: string[] = [];
          let optionsAr: string[] = [];
          if (q.options && typeof q.options === 'object' && !Array.isArray(q.options) && 'en' in (q.options as any)) {
            const opts = q.options as { en: string[]; ar: string[] };
            optionsEn = opts.en || [];
            optionsAr = opts.ar || opts.en || [];
          } else if (Array.isArray(q.options)) {
            optionsEn = q.options as string[];
            optionsAr = q.options as string[];
          }
          
          const attempt = attempts.find(a => a.question_id === q.id);
          const questionType = q.question_type || 'multiple_choice';

          // For open_ended, initialize manual grades
          if (questionType === 'open_ended') {
            initialGrades[q.id] = {
              score: attempt?.score ?? 0,
              feedback: attempt?.feedback ?? '',
            };
          }

          // Determine correctness - handle letter answers (A, B, C, D)
          let isCorrect = false;
          if (questionType === 'multiple_choice') {
            isCorrect = studentAnswer === q.correct_answer;
          } else if (questionType === 'true_false') {
            isCorrect = studentAnswer?.toLowerCase?.()?.trim() === q.correct_answer?.toLowerCase?.()?.trim();
          }

          return {
            id: q.id,
            question_text: q.question_text,
            question_text_ar: q.question_text_ar,
            options_en: optionsEn,
            options_ar: optionsAr,
            correct_answer: q.correct_answer,
            student_answer: studentAnswer,
            is_correct: isCorrect,
            points: q.points,
            image_url: q.image_url,
            code_snippet: (q as any).code_snippet || null,
            question_type: questionType,
            model_answer: (q as any).model_answer || null,
            rubric: (q as any).rubric || null,
            attempt_id: attempt?.id,
            manual_score: attempt?.score,
            manual_feedback: attempt?.feedback,
          };
        });

        setQuestionDetails(details);
        setManualGrades(initialGrades);
      }
    } catch (error) {
      console.error('Error fetching student answers:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحميل الإجابات' : 'Failed to load answers',
        variant: 'destructive',
      });
    } finally {
      setLoadingAnswers(false);
    }
  };

  const handleSaveManualGrades = async () => {
    if (!selectedStudent?.submission_id) return;
    setSavingGrades(true);

    try {
      // Update each open_ended attempt
      for (const [questionId, grade] of Object.entries(manualGrades)) {
        const detail = questionDetails.find(q => q.id === questionId);
        if (!detail || detail.question_type !== 'open_ended') continue;

        if (detail.attempt_id) {
          await supabase
            .from('quiz_question_attempts')
            .update({
              score: grade.score,
              feedback: grade.feedback || null,
              grading_status: 'graded',
              graded_at: new Date().toISOString(),
            })
            .eq('id', detail.attempt_id);
        }
      }

      // Calculate new total score
      const mcqScore = questionDetails
        .filter(q => q.question_type !== 'open_ended' && q.is_correct)
        .reduce((sum, q) => sum + q.points, 0);
      const manualScore = Object.entries(manualGrades).reduce((sum, [, g]) => sum + (g.score || 0), 0);
      const totalScore = mcqScore + manualScore;
      const totalMaxScore = questionDetails.reduce((sum, q) => sum + q.points, 0);
      const newPercentage = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

      // Update submission
      await supabase
        .from('quiz_submissions')
        .update({
          score: totalScore,
          percentage: newPercentage,
          grading_status: 'fully_graded',
          manual_score: manualScore,
        })
        .eq('id', selectedStudent.submission_id);

      toast({
        title: isRTL ? 'تم الحفظ' : 'Saved',
        description: isRTL ? `الدرجة النهائية: ${totalScore}/${totalMaxScore} (${newPercentage}%)` : `Final score: ${totalScore}/${totalMaxScore} (${newPercentage}%)`,
      });

      // Refresh results
      await fetchResults();
      goBack();
    } catch (error) {
      console.error('Error saving manual grades:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في حفظ الدرجات' : 'Failed to save grades',
        variant: 'destructive',
      });
    } finally {
      setSavingGrades(false);
    }
  };

  const goBack = () => {
    setSelectedStudent(null);
    setQuestionDetails([]);
    setManualGrades({});
  };

  // Stats
  const completedCount = results.filter(r => r.status === 'submitted' || r.status === 'graded').length;
  const inProgressCount = results.filter(r => r.status === 'in_progress').length;
  const passedCount = results.filter(r => (r.percentage || 0) >= passingScore).length;
  const needsGradingCount = results.filter(r => r.grading_status === 'needs_manual_grading').length;
  const avgPercentage = results.filter(r => r.percentage !== null).length > 0
    ? results.filter(r => r.percentage !== null).reduce((sum, r) => sum + (r.percentage || 0), 0) / results.filter(r => r.percentage !== null).length
    : 0;

  const getStatusIcon = (status: string, gradingStatus?: string | null) => {
    if (gradingStatus === 'needs_manual_grading') {
      return <FileText className="h-4 w-4 text-amber-500" />;
    }
    switch (status) {
      case 'graded':
      case 'submitted':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string, gradingStatus?: string | null) => {
    if (gradingStatus === 'needs_manual_grading') {
      return isRTL ? 'يحتاج تصحيح' : 'Needs Grading';
    }
    switch (status) {
      case 'graded':
      case 'submitted':
        return isRTL ? 'مكتمل' : 'Completed';
      case 'in_progress':
        return isRTL ? 'جاري' : 'In Progress';
      default:
        return isRTL ? 'لم يبدأ' : 'Not Started';
    }
  };

  const hasOpenEndedQuestions = questionDetails.some(q => q.question_type === 'open_ended');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full p-3 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {selectedStudent && (
              <Button variant="ghost" size="icon" onClick={goBack} className="h-8 w-8">
                {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
              </Button>
            )}
            <div>
              <DialogTitle>
                {selectedStudent
                  ? (isRTL ? `إجابات ${selectedStudent.student_name_ar}` : `${selectedStudent.student_name}'s Answers`)
                  : (isRTL ? `نتائج كويز: ${quizTitleAr}` : `Quiz Results: ${quizTitle}`)
                }
              </DialogTitle>
              <DialogDescription>
                {selectedStudent
                  ? (isRTL ? `الدرجة: ${selectedStudent.score}/${selectedStudent.max_score} (${selectedStudent.percentage?.toFixed(0) ?? '---'}%)` : `Score: ${selectedStudent.score}/${selectedStudent.max_score} (${selectedStudent.percentage?.toFixed(0) ?? '---'}%)`)
                  : (isRTL ? 'عرض حالة ونتائج كل طالب' : 'View status and results for each student')
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!selectedStudent ? (
          <>
            {/* Stats Bar */}
            <div className={`grid grid-cols-2 gap-2 sm:gap-3 py-3 border-b ${needsGradingCount > 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-green-600">{completedCount}/{results.length}</div>
                <div className="text-xs text-muted-foreground">{isRTL ? 'مكتمل' : 'Completed'}</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-yellow-600">{inProgressCount}</div>
                <div className="text-xs text-muted-foreground">{isRTL ? 'جاري' : 'In Progress'}</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-blue-600">{avgPercentage.toFixed(0)}%</div>
                <div className="text-xs text-muted-foreground">{isRTL ? 'المتوسط' : 'Average'}</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-primary">{passedCount}</div>
                <div className="text-xs text-muted-foreground">{isRTL ? 'ناجحين' : 'Passed'}</div>
              </div>
              {needsGradingCount > 0 && (
                <div className="text-center col-span-2 sm:col-span-1">
                  <div className="text-lg sm:text-2xl font-bold text-amber-600">{needsGradingCount}</div>
                  <div className="text-xs text-muted-foreground">{isRTL ? 'يحتاج تصحيح' : 'Needs Grading'}</div>
                </div>
              )}
            </div>

            {/* Results Table */}
            {loading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <>
                {/* Mobile: Card layout */}
                <div className="sm:hidden space-y-2">
                  {results.map(student => (
                    <div key={student.student_id} className="p-3 rounded-lg border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {language === 'ar' ? student.student_name_ar : student.student_name}
                        </span>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(student.status, student.grading_status)}
                          <span className="text-xs text-muted-foreground">{getStatusText(student.status, student.grading_status)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {student.score !== null && (
                            <span className="text-sm">{student.score}/{student.max_score}</span>
                          )}
                          {student.percentage !== null ? (
                            <Badge className={(student.percentage >= passingScore) ? 'bg-green-500' : 'bg-red-500'}>
                              {student.percentage.toFixed(0)}%
                            </Badge>
                          ) : student.grading_status === 'needs_manual_grading' ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              {isRTL ? 'معلق' : 'Pending'}
                            </Badge>
                          ) : null}
                        </div>
                        {student.answers && (
                          <Button
                            variant={student.grading_status === 'needs_manual_grading' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => fetchStudentAnswers(student)}
                            className="h-7 text-xs"
                          >
                            {student.grading_status === 'needs_manual_grading' ? (
                              <><FileText className="h-3 w-3 mr-1" />{isRTL ? 'تصحيح' : 'Grade'}</>
                            ) : (
                              <><Eye className="h-3 w-3 mr-1" />{isRTL ? 'معاينة' : 'Preview'}</>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: Table layout */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'الدرجة' : 'Score'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'النسبة' : 'Percentage'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'الإجراءات' : 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map(student => (
                        <TableRow key={student.student_id}>
                          <TableCell className="font-medium">
                            {language === 'ar' ? student.student_name_ar : student.student_name}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {getStatusIcon(student.status, student.grading_status)}
                              <span className="text-sm">{getStatusText(student.status, student.grading_status)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {student.score !== null ? (
                              <span>{student.score}/{student.max_score}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {student.percentage !== null ? (
                              <Badge className={(student.percentage >= passingScore) ? 'bg-green-500' : 'bg-red-500'}>
                                {student.percentage.toFixed(0)}%
                              </Badge>
                            ) : student.grading_status === 'needs_manual_grading' ? (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                {isRTL ? 'معلق' : 'Pending'}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {student.answers ? (
                              <Button
                                variant={student.grading_status === 'needs_manual_grading' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => fetchStudentAnswers(student)}
                                className="h-8"
                              >
                                {student.grading_status === 'needs_manual_grading' ? (
                                  <><FileText className="h-4 w-4 mr-1" />{isRTL ? 'تصحيح' : 'Grade'}</>
                                ) : (
                                  <><Eye className="h-4 w-4 mr-1" />{isRTL ? 'معاينة' : 'Preview'}</>
                                )}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </>
        ) : (
          /* Student Answers View */
          loadingAnswers ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {questionDetails.map((question, index) => (
                <div
                  key={question.id}
                  className={`p-4 rounded-lg border ${
                    question.question_type === 'open_ended'
                      ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
                      : question.is_correct
                        ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
                        : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-muted-foreground">
                        {isRTL ? `سؤال ${index + 1}` : `Question ${index + 1}`}
                        <span className="mx-2">•</span>
                        {question.points} {isRTL ? 'نقطة' : 'points'}
                        {question.question_type === 'open_ended' && (
                          <Badge variant="outline" className="ml-2 text-xs text-amber-600 border-amber-300">
                            {isRTL ? 'إجابة مفتوحة' : 'Open-Ended'}
                          </Badge>
                        )}
                      </span>
                      <p className="font-medium mt-1" dir="rtl" style={{ unicodeBidi: 'plaintext' }}>
                        {language === 'ar' ? question.question_text_ar : question.question_text}
                      </p>
                    </div>
                    {question.question_type !== 'open_ended' && (
                      question.is_correct ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                      )
                    )}
                  </div>

                  {question.image_url && (
                    <img src={question.image_url} alt="Question" className="max-h-32 rounded-lg mb-3" />
                  )}

                  {question.code_snippet && (
                    <CodeBlock code={question.code_snippet} className="mb-3" />
                  )}

                  {question.question_type === 'open_ended' ? (
                    /* Open-Ended Grading UI */
                    <div className="space-y-3">
                      {/* Student Answer */}
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">{isRTL ? 'إجابة الطالب:' : "Student's Answer:"}</Label>
                        <div className="p-3 rounded-md bg-background border font-mono text-sm whitespace-pre-wrap" dir="rtl" style={{ unicodeBidi: 'plaintext' }}>
                          {question.student_answer || (isRTL ? 'لم يجب' : 'No answer')}
                        </div>
                      </div>

                      {/* Model Answer */}
                      {question.model_answer && (
                        <div className="space-y-1">
                          <Label className="text-sm font-medium text-green-700">{isRTL ? 'الإجابة النموذجية:' : 'Model Answer:'}</Label>
                          <div className="p-3 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 font-mono text-sm whitespace-pre-wrap" dir="rtl" style={{ unicodeBidi: 'plaintext' }}>
                            {question.model_answer}
                          </div>
                        </div>
                      )}

                      {/* Rubric */}
                      {question.rubric?.steps && question.rubric.steps.length > 0 && (
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">{isRTL ? 'معايير التصحيح:' : 'Rubric:'}</Label>
                          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                            {question.rubric.steps.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Manual Grade Input */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 sm:gap-3 pt-2 border-t">
                        <div className="space-y-1">
                          <Label className="text-xs">{isRTL ? 'الدرجة' : 'Score'}</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={question.points}
                              value={manualGrades[question.id]?.score ?? 0}
                              onChange={(e) => setManualGrades(prev => ({
                                ...prev,
                                [question.id]: { ...prev[question.id], score: Math.min(parseInt(e.target.value) || 0, question.points) }
                              }))}
                              className="w-20 h-8"
                            />
                            <span className="text-xs text-muted-foreground">/ {question.points}</span>
                          </div>
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">{isRTL ? 'ملاحظات' : 'Feedback'}</Label>
                          <Input
                            value={manualGrades[question.id]?.feedback ?? ''}
                            onChange={(e) => setManualGrades(prev => ({
                              ...prev,
                              [question.id]: { ...prev[question.id], feedback: e.target.value }
                            }))}
                            placeholder={isRTL ? 'ملاحظات للطالب...' : 'Feedback for student...'}
                            className="h-8"
                            dir="rtl"
                            style={{ unicodeBidi: 'plaintext' }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* MCQ / True-False Options Display */
                    <div className="space-y-2">
                      {question.question_type === 'true_false' ? (
                        ['True', 'False'].map((option) => {
                          const isCorrectAnswer = question.correct_answer?.toLowerCase?.() === option.toLowerCase();
                          const isStudentAnswer = question.student_answer?.toLowerCase?.() === option.toLowerCase();
                          const displayOption = language === 'ar' ? (option === 'True' ? 'صح' : 'خطأ') : option;

                          return (
                            <div
                              key={option}
                              className={`p-2.5 rounded-md text-sm ${
                                isCorrectAnswer && isStudentAnswer
                                  ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-400'
                                  : isCorrectAnswer
                                    ? 'bg-green-100 dark:bg-green-900/30 border border-green-300'
                                    : isStudentAnswer
                                      ? 'bg-red-100 dark:bg-red-900/30 border-2 border-red-400'
                                      : 'bg-muted/50 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  {isCorrectAnswer && <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />}
                                  {isStudentAnswer && !isCorrectAnswer && <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />}
                                  <span>{displayOption}</span>
                                </div>
                                <div className="flex gap-1">
                                  {isStudentAnswer && (
                                    <Badge variant="outline" className={`text-xs ${isCorrectAnswer ? 'text-green-600 border-green-300' : 'text-red-600 border-red-300'}`}>
                                      {isRTL ? 'اختيار الطالب' : 'Student Pick'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        /* Multiple Choice */
                        (() => {
                          const displayOptions = language === 'ar' ? question.options_ar : question.options_en;
                          return displayOptions.map((option, optIndex) => {
                            const optionLetter = String.fromCharCode(65 + optIndex); // A, B, C, D
                            // Support both letter-based answers and full-text answers
                            const isCorrectAnswer = question.correct_answer === optionLetter || question.correct_answer === option;
                            const isStudentAnswer = question.student_answer === optionLetter || question.student_answer === option;

                            return (
                              <div
                                key={optIndex}
                                className={`p-2.5 rounded-md text-sm ${
                                  isCorrectAnswer && isStudentAnswer
                                    ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-400'
                                    : isCorrectAnswer
                                      ? 'bg-green-100 dark:bg-green-900/30 border border-green-300'
                                      : isStudentAnswer
                                        ? 'bg-red-100 dark:bg-red-900/30 border-2 border-red-400'
                                        : 'bg-muted/50 border border-transparent'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                                    {isCorrectAnswer && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                    {isStudentAnswer && !isCorrectAnswer && <XCircle className="h-4 w-4 text-red-600" />}
                                    {!isCorrectAnswer && !isStudentAnswer && <span className="w-4 h-4 inline-block" />}
                                    <span className="font-medium text-muted-foreground">{optionLetter}.</span>
                                  </div>
                                  <span className="flex-1 break-words" dir="rtl" style={{ unicodeBidi: 'plaintext' }}>{option}</span>
                                  <div className="flex flex-wrap gap-1 flex-shrink-0">
                                    {isStudentAnswer && (
                                      <Badge variant="outline" className={`text-xs whitespace-nowrap ${isCorrectAnswer ? 'text-green-600 border-green-300' : 'text-red-600 border-red-300'}`}>
                                        {isRTL ? 'اختيار الطالب' : 'Student Pick'}
                                      </Badge>
                                    )}
                                    {isCorrectAnswer && !isStudentAnswer && (
                                      <Badge variant="outline" className="text-xs text-green-600 border-green-300 whitespace-nowrap">
                                        {isRTL ? 'الإجابة الصحيحة' : 'Correct'}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()
                      )}
                      {!question.student_answer && (
                        <div className="p-2.5 rounded-md text-sm bg-muted/50 text-muted-foreground italic border border-dashed">
                          {isRTL ? 'لم يجب الطالب على هذا السؤال' : 'Student did not answer this question'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Save Manual Grades Button */}
              {hasOpenEndedQuestions && (
                <Button
                  className="w-full"
                  onClick={handleSaveManualGrades}
                  disabled={savingGrades}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingGrades
                    ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                    : (isRTL ? 'حفظ التصحيح اليدوي' : 'Save Manual Grades')}
                </Button>
              )}
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
