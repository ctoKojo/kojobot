import { useState, useEffect } from 'react';
import { Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/lib/timeUtils';
import { cn } from '@/lib/utils';

interface StudentQuizPreviewDialogProps {
  submissionId: string;
  quizTitle: string;
  quizTitleAr: string;
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: string;
}

interface QuizQuestion {
  id: string;
  question_text: string;
  question_text_ar: string;
  question_type: string;
  options: unknown;
  correct_answer: string;
  points: number;
  order_index: number;
  image_url?: string | null;
}

// Answers can be either object format { questionId: answer } or array format [{ questionId, answer }]
type AnswersData = Record<string, string | number> | Array<{ questionId: string; answer: string }>;

export function StudentQuizPreviewDialog({
  submissionId,
  quizTitle,
  quizTitleAr,
  score,
  maxScore,
  percentage,
  submittedAt,
}: StudentQuizPreviewDialogProps) {
  const { isRTL, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswersData>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSubmissionDetails();
    }
  }, [open, submissionId]);

  const fetchSubmissionDetails = async () => {
    setLoading(true);
    try {
      // Fetch the submission with answers
      const { data: submission, error: subError } = await supabase
        .from('quiz_submissions')
        .select('answers, quiz_assignment_id')
        .eq('id', submissionId)
        .single();

      if (subError) throw subError;

      // Get quiz_id from assignment
      const { data: assignment, error: assignError } = await supabase
        .from('quiz_assignments')
        .select('quiz_id')
        .eq('id', submission.quiz_assignment_id)
        .single();

      if (assignError) throw assignError;

      // Fetch questions with correct answers
      const { data: questionsData, error: qError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', assignment.quiz_id)
        .order('order_index');

      if (qError) throw qError;

      setQuestions((questionsData || []) as QuizQuestion[]);
      setAnswers((submission.answers as AnswersData) || {});
    } catch (error) {
      console.error('Error fetching submission details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStudentAnswer = (questionId: string): string => {
    // Handle object format { questionId: answer }
    if (answers && typeof answers === 'object' && !Array.isArray(answers)) {
      const answer = answers[questionId];
      return answer !== undefined ? String(answer) : '';
    }
    // Handle array format [{ questionId, answer }]
    if (Array.isArray(answers)) {
      const found = answers.find(a => a.questionId === questionId);
      return found?.answer || '';
    }
    return '';
  };

  const isCorrect = (question: QuizQuestion) => {
    const studentAnswer = getStudentAnswer(question.id);
    return studentAnswer.toLowerCase().trim() === question.correct_answer.toLowerCase().trim();
  };

  const getOptions = (question: QuizQuestion) => {
    if (!question.options) return { en: [], ar: [] };
    
    // Handle new format { en: [], ar: [] }
    if (typeof question.options === 'object' && 'en' in question.options) {
      return question.options as { en: string[]; ar: string[] };
    }
    
    // Handle old format (array of strings)
    if (Array.isArray(question.options)) {
      return { en: question.options, ar: question.options };
    }
    
    return { en: [], ar: [] };
  };

  // SSOT: using centralized formatDateTime from timeUtils.ts with Cairo timezone

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Eye className="h-4 w-4" />
          {isRTL ? 'عرض التفاصيل' : 'View Details'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {language === 'ar' ? quizTitleAr : quizTitle}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-3">
            <Badge 
              variant={percentage >= 60 ? 'default' : 'destructive'}
              className={percentage >= 60 ? 'bg-green-600' : ''}
            >
              {score} / {maxScore} ({percentage}%)
            </Badge>
            <span className="flex items-center gap-1 text-sm">
              <Clock className="h-3 w-3" />
              {formatDateTime(submittedAt, language, 'Africa/Cairo')}
            </span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              {isRTL ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((question, index) => {
                const studentAnswer = getStudentAnswer(question.id);
                const correct = isCorrect(question);
                const options = getOptions(question);
                const displayOptions = language === 'ar' ? options.ar : options.en;

                return (
                  <div
                    key={question.id}
                    className={cn(
                      'p-4 rounded-lg border',
                      correct ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <h4 className="font-medium">
                        <span className="text-muted-foreground">{index + 1}. </span>
                        {language === 'ar' ? question.question_text_ar : question.question_text}
                      </h4>
                      <div className="flex items-center gap-2 shrink-0">
                        {correct ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <Badge variant="outline">
                          {correct ? question.points : 0} / {question.points}
                        </Badge>
                      </div>
                    </div>

                    {question.image_url && (
                      <img
                        src={question.image_url}
                        alt="Question"
                        className="max-h-40 rounded-lg mb-3 object-contain"
                      />
                    )}

                    {question.question_type === 'multiple_choice' && displayOptions.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {displayOptions.map((option, optIndex) => {
                          const optionLetter = String.fromCharCode(65 + optIndex); // A, B, C, D
                          const isStudentAnswer = studentAnswer === optionLetter;
                          const isCorrectAnswer = question.correct_answer === optionLetter;

                          return (
                            <div
                              key={optIndex}
                              className={cn(
                                'p-2 rounded border text-sm',
                                isCorrectAnswer && 'border-green-500 bg-green-100',
                                isStudentAnswer && !isCorrectAnswer && 'border-red-500 bg-red-100',
                                !isStudentAnswer && !isCorrectAnswer && 'border-muted bg-muted/30'
                              )}
                            >
                              <span className="font-medium mr-2">{optionLetter}.</span>
                              {option}
                              {isCorrectAnswer && (
                                <CheckCircle className="inline-block h-4 w-4 text-green-600 ml-2" />
                              )}
                              {isStudentAnswer && !isCorrectAnswer && (
                                <XCircle className="inline-block h-4 w-4 text-red-600 ml-2" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {question.question_type === 'true_false' && (
                      <div className="space-y-2 mb-3">
                        {['True', 'False'].map((option) => {
                          const isStudentAnswer = studentAnswer.toLowerCase() === option.toLowerCase();
                          const isCorrectAnswer = question.correct_answer.toLowerCase() === option.toLowerCase();
                          const displayOption = language === 'ar' 
                            ? (option === 'True' ? 'صح' : 'خطأ')
                            : option;

                          return (
                            <div
                              key={option}
                              className={cn(
                                'p-2 rounded border text-sm',
                                isCorrectAnswer && 'border-green-500 bg-green-100',
                                isStudentAnswer && !isCorrectAnswer && 'border-red-500 bg-red-100',
                                !isStudentAnswer && !isCorrectAnswer && 'border-muted bg-muted/30'
                              )}
                            >
                              {displayOption}
                              {isCorrectAnswer && (
                                <CheckCircle className="inline-block h-4 w-4 text-green-600 ml-2" />
                              )}
                              {isStudentAnswer && !isCorrectAnswer && (
                                <XCircle className="inline-block h-4 w-4 text-red-600 ml-2" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!correct && (
                      <div className="mt-2 pt-2 border-t border-dashed">
                        <p className="text-sm">
                          <span className="text-muted-foreground">
                            {isRTL ? 'إجابتك: ' : 'Your answer: '}
                          </span>
                          <span className="text-red-600 font-medium">
                            {studentAnswer || (isRTL ? 'لم تجب' : 'No answer')}
                          </span>
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">
                            {isRTL ? 'الإجابة الصحيحة: ' : 'Correct answer: '}
                          </span>
                          <span className="text-green-600 font-medium">
                            {question.correct_answer}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
