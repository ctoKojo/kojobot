import { useState, useEffect, useRef, useCallback } from 'react';
import { formatDateTime } from '@/lib/timeUtils';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logStart, logSubmit, logComplete } from '@/lib/activityLogger';
import { CodeBlock } from '@/components/quiz/CodeBlock';

interface Question {
  id: string;
  question_text: string;
  question_text_ar: string;
  options: unknown;
  correct_answer: string;
  points: number;
  order_index: number;
  image_url?: string | null;
  code_snippet?: string | null;
}

interface QuizAssignment {
  id: string;
  quiz_id: string;
  start_time: string | null;
  due_date: string | null;
  quizzes: {
    id: string;
    title: string;
    title_ar: string;
    description: string | null;
    description_ar: string | null;
    duration_minutes: number;
    passing_score: number;
  };
}

export default function TakeQuiz() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();

  const [assignment, setAssignment] = useState<QuizAssignment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answersRef = useRef<Record<string, string>>({});
  const handleSubmitRef = useRef<() => void>(() => {});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; maxScore: number; percentage: number; passed: boolean } | null>(null);
  const [gradeResults, setGradeResults] = useState<Record<string, { correct: boolean; correctAnswer: string }>>({});
  const [quizStatus, setQuizStatus] = useState<'loading' | 'not_started' | 'expired' | 'available'>('loading');

  useEffect(() => {
    if (assignmentId) fetchQuizData();
  }, [assignmentId]);

  useEffect(() => {
    if (timeLeft > 0 && !submitted) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmitRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, submitted]);

  const fetchQuizData = async () => {
    try {
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('quiz_assignments')
        .select('*, quizzes(*)')
        .eq('id', assignmentId)
        .single();

      if (assignmentError) throw assignmentError;
      setAssignment(assignmentData);
      
      // Calculate quiz status and remaining time based on start_time
      const now = new Date().getTime();
      const duration = assignmentData.quizzes?.duration_minutes || 30;
      const durationMs = duration * 60 * 1000;
      
      if (assignmentData.start_time) {
        const startTime = new Date(assignmentData.start_time).getTime();
        
        // Quiz hasn't started yet
        if (now < startTime) {
          setQuizStatus('not_started');
          setTimeLeft(duration * 60); // Full duration
          setLoading(false);
          return;
        }
        
        // Calculate remaining time from start_time
        const elapsed = now - startTime;
        const remainingMs = durationMs - elapsed;
        
        // Quiz time window has expired
        if (remainingMs <= 0) {
          setQuizStatus('expired');
          setTimeLeft(0);
          setLoading(false);
          return;
        }
        
        // Quiz is available, set remaining time
        setTimeLeft(Math.floor(remainingMs / 1000));
        setQuizStatus('available');
      } else {
        // No start_time set, use full duration
        setTimeLeft(duration * 60);
        setQuizStatus('available');
      }

      // Use secure view that excludes correct_answer - answers are fetched separately after submission
      const { data: questionsData, error: questionsError } = await supabase
        .from('quiz_questions_student_view')
        .select('*')
        .eq('quiz_id', assignmentData.quiz_id)
        .order('order_index');

      if (questionsError) throw questionsError;
      // Add empty correct_answer since view doesn't include it
      const questionsWithPlaceholder = (questionsData || []).map(q => ({
        ...q,
        correct_answer: '' // Will be calculated server-side or fetched after submission
      }));
      setQuestions(questionsWithPlaceholder);
    } catch (error) {
      console.error('Error fetching quiz:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تحميل الكويز' : 'Failed to load quiz',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev) => {
      const updated = { ...prev, [questionId]: answer };
      answersRef.current = updated;
      return updated;
    });
  };

  const handleSubmit = useCallback(async () => {
    if (!user || !assignment || submitting) return;
    setSubmitting(true);

    // Always use ref to get the latest answers (avoids stale closure in timer)
    const currentAnswers = answersRef.current;

    try {
      // Log quiz start if first submission
      await logStart('quiz_submission', assignment.id, { 
        quiz_title: assignment.quizzes.title,
        quiz_id: assignment.quiz_id 
      });

      // Use edge function for secure grading (correct answers are server-side only)
      const { data, error } = await supabase.functions.invoke('grade-quiz', {
        body: {
          quiz_assignment_id: assignment.id,
          answers: currentAnswers
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to grade quiz');
      }

      setResult({
        score: data.score,
        maxScore: data.maxScore,
        percentage: data.percentage,
        passed: data.passed
      });
      setGradeResults(data.results || {});
      setSubmitted(true);

      // Log quiz completion with results
      await logComplete('quiz_submission', assignment.id, { 
        quiz_title: assignment.quizzes.title,
        score: data.score,
        maxScore: data.maxScore,
        percentage: data.percentage,
        passed: data.passed
      });

      toast({
        title: t.common.success,
        description: isRTL ? 'تم تسليم الكويز بنجاح' : 'Quiz submitted successfully',
      });
    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تسليم الكويز' : 'Failed to submit quiz',
      });
    } finally {
      setSubmitting(false);
    }
  }, [user, assignment, submitting, toast, t, isRTL]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // SSOT: using centralized formatDateTime from timeUtils.ts

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'حل الكويز' : 'Take Quiz'}>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t.common.loading}</p>
        </div>
      </DashboardLayout>
    );
  }

  // Show message if quiz hasn't started yet
  if (quizStatus === 'not_started' && assignment?.start_time) {
    return (
      <DashboardLayout title={isRTL ? 'حل الكويز' : 'Take Quiz'}>
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
              <Clock className="w-10 h-10 text-blue-600" />
            </div>
            <CardTitle className="mt-4">
              {isRTL ? 'الكويز لم يبدأ بعد' : 'Quiz Not Started Yet'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? assignment?.quizzes?.title_ar : assignment?.quizzes?.title}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-lg bg-muted text-center">
              <p className="text-sm text-muted-foreground mb-2">
                {isRTL ? 'الكويز يبدأ في:' : 'Quiz starts at:'}
              </p>
              <p className="text-2xl font-bold text-primary">
                {formatDateTime(assignment.start_time, language)}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-sm">
                {isRTL ? 'عُد في الموعد المحدد لبدء الكويز' : 'Come back at the scheduled time to start'}
              </p>
            </div>
            <Button className="w-full" variant="outline" onClick={() => navigate('/my-quizzes')}>
              {isRTL ? 'العودة لقائمة الكويزات' : 'Back to My Quizzes'}
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // Show message if quiz time has expired
  if (quizStatus === 'expired') {
    return (
      <DashboardLayout title={isRTL ? 'حل الكويز' : 'Take Quiz'}>
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <CardTitle className="mt-4">
              {isRTL ? 'انتهى وقت الكويز' : 'Quiz Time Expired'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? assignment?.quizzes?.title_ar : assignment?.quizzes?.title}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-lg bg-red-50 text-center">
              <p className="text-sm text-red-700">
                {isRTL 
                  ? 'للأسف انتهت المدة المحددة لهذا الكويز ولم يعد بإمكانك حله.'
                  : 'Unfortunately, the time window for this quiz has passed and you can no longer take it.'}
              </p>
            </div>
            <Button className="w-full" variant="outline" onClick={() => navigate('/my-quizzes')}>
              {isRTL ? 'العودة لقائمة الكويزات' : 'Back to My Quizzes'}
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (submitted && result) {
    return (
      <DashboardLayout title={isRTL ? 'نتيجة الكويز' : 'Quiz Result'}>
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center ${result.passed ? 'bg-green-100' : 'bg-red-100'}`}>
              {result.passed ? (
                <CheckCircle className="w-10 h-10 text-green-600" />
              ) : (
                <XCircle className="w-10 h-10 text-red-600" />
              )}
            </div>
            <CardTitle className="mt-4">
              {result.passed ? (isRTL ? 'مبروك! نجحت في الكويز' : 'Congratulations! You Passed') : (isRTL ? 'للأسف لم تنجح' : 'Unfortunately, You Did Not Pass')}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? assignment?.quizzes?.title_ar : assignment?.quizzes?.title}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-5xl font-bold">{result.percentage}%</div>
              <p className="text-muted-foreground mt-2">
                {result.score} / {result.maxScore} {isRTL ? 'درجة' : 'points'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="text-2xl font-bold text-green-600">
                  {Object.values(gradeResults).filter(r => r.correct).length}
                </div>
                <p className="text-sm text-green-700">{isRTL ? 'إجابات صحيحة' : 'Correct'}</p>
              </div>
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="text-2xl font-bold text-red-600">
                  {Object.values(gradeResults).filter(r => !r.correct).length}
                </div>
                <p className="text-sm text-red-700">{isRTL ? 'إجابات خاطئة' : 'Wrong'}</p>
              </div>
            </div>

            {/* Show correct answers - using server-provided results */}
            <div className="space-y-4 mt-6">
              <h3 className="font-semibold">{isRTL ? 'مراجعة الإجابات' : 'Review Answers'}</h3>
              {questions.map((q, idx) => {
                // Support both formats
                const optionsData = q.options as any;
                let optionsList: string[] = [];
                
                if (optionsData?.en && Array.isArray(optionsData.en)) {
                  optionsList = language === 'ar' && optionsData.ar ? optionsData.ar : optionsData.en;
                } else if (optionsData?.options && Array.isArray(optionsData.options)) {
                  optionsList = optionsData.options.map((opt: any) => 
                    language === 'ar' ? opt.text_ar : opt.text
                  );
                }
                
                const userAnswerIdx = answers[q.id] ? parseInt(answers[q.id]) : -1;
                const selectedOptionText = optionsList[userAnswerIdx] || null;
                const questionResult = gradeResults[q.id];
                const isCorrect = questionResult?.correct || false;
                const correctAnswerText = questionResult?.correctAnswer || '';
                
                // Server now returns correctIndex directly, or we can parse from correctAnswer
                let correctAnswerIdx = (questionResult as any)?.correctIndex ?? -1;
                if (correctAnswerIdx < 0) {
                  // Fallback: try to parse as index or find by text
                  const parsedIdx = parseInt(correctAnswerText);
                  if (!isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < optionsList.length) {
                    correctAnswerIdx = parsedIdx;
                  } else {
                    correctAnswerIdx = optionsList.findIndex(opt => opt === correctAnswerText);
                  }
                }
                
                return (
                  <div key={q.id} className={`p-4 rounded-lg border ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex items-start gap-2">
                      {isCorrect ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <p className="font-medium" dir="rtl" style={{ unicodeBidi: 'plaintext' }}>{idx + 1}. {language === 'ar' ? q.question_text_ar : q.question_text}</p>
                        <p className="text-sm mt-1">
                          <span className="text-muted-foreground">{isRTL ? 'إجابتك: ' : 'Your answer: '}</span>
                          <span className={isCorrect ? 'text-green-700' : 'text-red-700'}>
                            {selectedOptionText || (isRTL ? 'لم تجب' : 'No answer')}
                          </span>
                        </p>
                        {!isCorrect && correctAnswerIdx >= 0 && optionsList[correctAnswerIdx] && (
                          <p className="text-sm text-green-700 mt-1">
                            {isRTL ? 'الإجابة الصحيحة: ' : 'Correct answer: '}
                            {optionsList[correctAnswerIdx]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button className="w-full kojo-gradient" onClick={() => navigate('/dashboard')}>
              {isRTL ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={language === 'ar' ? assignment?.quizzes?.title_ar : assignment?.quizzes?.title}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Timer & Progress */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-4">
              <Badge variant="outline" className="text-lg px-4 py-2">
                {isRTL ? `سؤال ${currentIndex + 1} من ${questions.length}` : `Question ${currentIndex + 1} of ${questions.length}`}
              </Badge>
              <div className={`flex items-center gap-2 text-lg font-mono ${timeLeft < 60 ? 'text-red-600 animate-pulse' : ''}`}>
                <Clock className="w-5 h-5" />
                {formatTime(timeLeft)}
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        {/* Question */}
        {currentQuestion && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl" dir="rtl" style={{ unicodeBidi: 'plaintext' }}>
                {language === 'ar' ? currentQuestion.question_text_ar : currentQuestion.question_text}
              </CardTitle>
              <Badge variant="secondary">{currentQuestion.points} {isRTL ? 'درجة' : 'points'}</Badge>
              {/* Question Image */}
              {currentQuestion.image_url && (
                <div className="mt-4 rounded-lg overflow-hidden border">
                  <img
                    src={currentQuestion.image_url}
                    alt={`Question ${currentIndex + 1}`}
                    className="w-full max-h-80 object-contain bg-muted"
                  />
                </div>
              )}
              {/* Code Snippet */}
              {currentQuestion.code_snippet && (
                <div className="mt-4">
                  <CodeBlock code={currentQuestion.code_snippet} />
                </div>
              )}
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={answers[currentQuestion.id] || ''}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                className="space-y-3"
              >
                {(() => {
                  // Support both old format { options: [...] } and new format { en: [...], ar: [...] }
                  const optionsData = currentQuestion.options as any;
                  let optionsList: string[] = [];
                  
                  if (optionsData?.en && Array.isArray(optionsData.en)) {
                    // New simplified format
                    optionsList = language === 'ar' && optionsData.ar ? optionsData.ar : optionsData.en;
                  } else if (optionsData?.options && Array.isArray(optionsData.options)) {
                    // Old format with nested objects
                    optionsList = optionsData.options.map((opt: any) => 
                      language === 'ar' ? opt.text_ar : opt.text
                    );
                  }
                  
                  return optionsList.map((optionText, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleAnswerChange(currentQuestion.id, idx.toString())}
                      className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${answers[currentQuestion.id] === idx.toString() ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}
                    >
                      <RadioGroupItem value={idx.toString()} id={`option-${idx}`} className="pointer-events-none" />
                      <span className="flex-1" dir="rtl" style={{ unicodeBidi: 'plaintext' }}>
                        {optionText || `Option ${idx + 1}`}
                      </span>
                      {answers[currentQuestion.id] === idx.toString() && (
                        <span className="text-xs text-primary font-medium">✓</span>
                      )}
                    </div>
                  ));
                })()}
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
          >
            {isRTL ? <ArrowRight className="w-4 h-4 ml-2" /> : <ArrowLeft className="w-4 h-4 mr-2" />}
            {isRTL ? 'السابق' : 'Previous'}
          </Button>

          {currentIndex === questions.length - 1 ? (
            <Button
              className="kojo-gradient"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? t.common.loading : (isRTL ? 'تسليم الكويز' : 'Submit Quiz')}
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            >
              {isRTL ? 'التالي' : 'Next'}
              {isRTL ? <ArrowLeft className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          )}
        </div>

        {/* Question Navigator */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{isRTL ? 'تنقل الأسئلة' : 'Question Navigator'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {questions.map((q, idx) => (
                <Button
                  key={q.id}
                  variant={currentIndex === idx ? 'default' : answers[q.id] ? 'secondary' : 'outline'}
                  size="sm"
                  className={`w-10 h-10 ${answers[q.id] && currentIndex !== idx ? 'bg-green-100 text-green-700 border-green-300' : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                >
                  {idx + 1}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
