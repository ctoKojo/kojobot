import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, CheckCircle2, XCircle, Clock, CircleDashed, ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';

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
}

interface QuestionDetail {
  id: string;
  question_text: string;
  question_text_ar: string;
  options: string[];
  correct_answer: string;
  student_answer: string | null;
  is_correct: boolean;
  points: number;
  image_url: string | null;
}

interface QuizResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizAssignmentId: string;
  quizId: string;
  quizTitle: string;
  quizTitleAr: string;
  groupId: string;
  passingScore: number;
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
}: QuizResultsDialogProps) {
  const { isRTL, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<StudentQuizResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentQuizResult | null>(null);
  const [questionDetails, setQuestionDetails] = useState<QuestionDetail[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);

  useEffect(() => {
    if (open && quizAssignmentId) {
      fetchResults();
    }
  }, [open, quizAssignmentId]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      // Fetch all students in the group
      const { data: groupStudents } = await supabase
        .from('group_students')
        .select('student_id')
        .eq('group_id', groupId)
        .eq('is_active', true);

      const studentIds = groupStudents?.map(gs => gs.student_id) || [];

      // Fetch student profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ar')
        .in('user_id', studentIds);

      // Fetch quiz submissions
      const { data: submissions } = await supabase
        .from('quiz_submissions')
        .select('id, student_id, score, max_score, percentage, status, submitted_at, answers')
        .eq('quiz_assignment_id', quizAssignmentId);

      // Combine data
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
        };
      });

      setResults(combinedResults);
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

    try {
      // Fetch quiz questions
      const { data: questions } = await supabase
        .from('quiz_questions')
        .select('id, question_text, question_text_ar, options, correct_answer, points, image_url')
        .eq('quiz_id', quizId)
        .order('order_index', { ascending: true });

      if (questions) {
        const details: QuestionDetail[] = questions.map(q => {
          const studentAnswer = student.answers?.[q.id] || null;
          const options = Array.isArray(q.options) ? q.options as string[] : [];
          
          return {
            id: q.id,
            question_text: q.question_text,
            question_text_ar: q.question_text_ar,
            options,
            correct_answer: q.correct_answer,
            student_answer: studentAnswer,
            is_correct: studentAnswer === q.correct_answer,
            points: q.points,
            image_url: q.image_url,
          };
        });

        setQuestionDetails(details);
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

  const goBack = () => {
    setSelectedStudent(null);
    setQuestionDetails([]);
  };

  // Stats
  const completedCount = results.filter(r => r.status === 'submitted' || r.status === 'graded').length;
  const inProgressCount = results.filter(r => r.status === 'in_progress').length;
  const passedCount = results.filter(r => (r.percentage || 0) >= passingScore).length;
  const avgPercentage = results.filter(r => r.percentage !== null).length > 0
    ? results.filter(r => r.percentage !== null).reduce((sum, r) => sum + (r.percentage || 0), 0) / results.filter(r => r.percentage !== null).length
    : 0;

  const getStatusIcon = (status: string) => {
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

  const getStatusText = (status: string) => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
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
                  ? (isRTL ? `الدرجة: ${selectedStudent.score}/${selectedStudent.max_score} (${selectedStudent.percentage?.toFixed(0)}%)` : `Score: ${selectedStudent.score}/${selectedStudent.max_score} (${selectedStudent.percentage?.toFixed(0)}%)`)
                  : (isRTL ? 'عرض حالة ونتائج كل طالب' : 'View status and results for each student')
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!selectedStudent ? (
          <>
            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-3 py-3 border-b">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{completedCount}/{results.length}</div>
                <div className="text-xs text-muted-foreground">{isRTL ? 'مكتمل' : 'Completed'}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{inProgressCount}</div>
                <div className="text-xs text-muted-foreground">{isRTL ? 'جاري' : 'In Progress'}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{avgPercentage.toFixed(0)}%</div>
                <div className="text-xs text-muted-foreground">{isRTL ? 'المتوسط' : 'Average'}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{passedCount}</div>
                <div className="text-xs text-muted-foreground">{isRTL ? 'ناجحين' : 'Passed'}</div>
              </div>
            </div>

            {/* Results Table */}
            <ScrollArea className="flex-1 min-h-0">
              {loading ? (
                <div className="space-y-3 p-4">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
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
                            {getStatusIcon(student.status)}
                            <span className="text-sm">{getStatusText(student.status)}</span>
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
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {student.answers ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => fetchStudentAnswers(student)}
                              className="h-8"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {isRTL ? 'معاينة' : 'Preview'}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </>
        ) : (
          /* Student Answers View */
          <ScrollArea className="flex-1 min-h-0">
            {loadingAnswers ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4 p-4">
                {questionDetails.map((question, index) => (
                  <div
                    key={question.id}
                    className={`p-4 rounded-lg border ${question.is_correct ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-muted-foreground">
                          {isRTL ? `سؤال ${index + 1}` : `Question ${index + 1}`}
                          <span className="mx-2">•</span>
                          {question.points} {isRTL ? 'نقطة' : 'points'}
                        </span>
                        <p className="font-medium mt-1">
                          {language === 'ar' ? question.question_text_ar : question.question_text}
                        </p>
                      </div>
                      {question.is_correct ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                      )}
                    </div>

                    {question.image_url && (
                      <img
                        src={question.image_url}
                        alt="Question"
                        className="max-h-32 rounded-lg mb-3"
                      />
                    )}

                    <div className="space-y-2">
                      {question.options.map((option, optIndex) => {
                        const isCorrect = option === question.correct_answer;
                        const isStudentAnswer = option === question.student_answer;

                        return (
                          <div
                            key={optIndex}
                            className={`p-2 rounded-md text-sm ${
                              isCorrect
                                ? 'bg-green-100 dark:bg-green-900/30 border border-green-300'
                                : isStudentAnswer
                                  ? 'bg-red-100 dark:bg-red-900/30 border border-red-300'
                                  : 'bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                              {isStudentAnswer && !isCorrect && <XCircle className="h-4 w-4 text-red-600" />}
                              <span>{option}</span>
                              {isCorrect && (
                                <Badge variant="outline" className="ml-auto text-xs text-green-600 border-green-300">
                                  {isRTL ? 'الإجابة الصحيحة' : 'Correct Answer'}
                                </Badge>
                              )}
                              {isStudentAnswer && !isCorrect && (
                                <Badge variant="outline" className="ml-auto text-xs text-red-600 border-red-300">
                                  {isRTL ? 'إجابة الطالب' : 'Student Answer'}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {!question.student_answer && (
                        <div className="p-2 rounded-md text-sm bg-muted/50 text-muted-foreground italic">
                          {isRTL ? 'لم يجب الطالب على هذا السؤال' : 'Student did not answer this question'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
