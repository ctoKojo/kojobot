import { useState, useEffect, useRef, useCallback } from 'react';
import { formatDateTime } from '@/lib/timeUtils';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, CheckCircle, XCircle, AlertTriangle, FileText, WifiOff } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
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
  question_type?: string;
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

// ── Retry helper with exponential backoff ────────────────────────────
async function retryAsync<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 2000
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

export default function TakeQuiz() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();

  const [assignment, setAssignment] = useState<QuizAssignment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = sessionStorage.getItem(`quiz-${assignmentId}-index`);
    return saved ? Number(saved) : 0;
  });
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    try {
      const saved = sessionStorage.getItem(`quiz-${assignmentId}-answers`);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; maxScore: number; percentage: number | null; passed: boolean; hasOpenEnded?: boolean } | null>(null);
  const [gradeResults, setGradeResults] = useState<Record<string, { correct: boolean; correctAnswer: string; questionType?: string }>>({});
  const [quizStatus, setQuizStatus] = useState<'loading' | 'not_started' | 'expired' | 'available' | 'frozen'>('loading');
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const getStoredAnswers = useCallback((): Record<string, string> => {
    try {
      const saved = sessionStorage.getItem(`quiz-${assignmentId}-answers`);
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }, [assignmentId]);

  // ── Refs for stale-closure protection ──────────────────────────────
  const answersRef = useRef(answers);
  const isSubmittingRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitCoreRef = useRef<(currentAnswers: Record<string, string>) => Promise<void>>();

  // Keep ref in sync
  useEffect(() => { answersRef.current = answers; }, [answers]);

  useEffect(() => {
    if (assignmentId) fetchQuizData();
  }, [assignmentId]);

  // Auto-refresh when quiz is not_started
  useEffect(() => {
    if (quizStatus !== 'not_started' || !assignment?.start_time) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const startTime = new Date(assignment.start_time!).getTime();
      if (now >= startTime) {
        clearInterval(interval);
        fetchQuizData();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [quizStatus, assignment?.start_time]);

  // ── Timer: when it hits 0, auto-submit via ref ─────────────────────
  useEffect(() => {
    if (timeLeft > 0 && !submitted) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // Use ref-based submit to avoid stale closure
            handleSubmitFromRef();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, submitted]);

  // Listen for extra_minutes updates in realtime
  useEffect(() => {
    if (!assignmentId || submitted) return;
    const channel = supabase
      .channel(`quiz-assignment-extend-${assignmentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'quiz_assignments',
        filter: `id=eq.${assignmentId}`,
      }, (payload) => {
        const newExtra = (payload.new as any).extra_minutes || 0;
        const oldExtra = (payload.old as any).extra_minutes || 0;
        const addedMinutes = newExtra - oldExtra;
        if (addedMinutes > 0) {
          setTimeLeft(prev => prev + addedMinutes * 60);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [assignmentId, submitted]);

  const fetchQuizData = async () => {
    try {
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('quiz_assignments')
        .select('*, quizzes(*)')
        .eq('id', assignmentId)
        .single();

      if (assignmentError) throw assignmentError;
      setAssignment(assignmentData);

      // Check frozen group
      if (assignmentData.group_id) {
        const { data: groupData } = await supabase
          .from('groups')
          .select('status')
          .eq('id', assignmentData.group_id)
          .single();
        if (groupData?.status === 'frozen') {
          setQuizStatus('frozen');
          setLoading(false);
          return;
        }
      }

      const now = Date.now();
      const baseDuration = assignmentData.quizzes?.duration_minutes || 30;
      const extraMinutes = (assignmentData as any).extra_minutes || 0;
      const duration = baseDuration + extraMinutes;
      const durationMs = duration * 60 * 1000;

      if (assignmentData.start_time) {
        const startTime = new Date(assignmentData.start_time).getTime();

        if (now < startTime) {
          setQuizStatus('not_started');
          setTimeLeft(duration * 60);
          setLoading(false);
          return;
        }

        const elapsed = now - startTime;
        const remainingMs = durationMs - elapsed;

        if (remainingMs <= 0) {
          // Instead of showing "expired" immediately, try auto-submit
          // The server will decide if it accepts or rejects
          setQuizStatus('expired');
          setTimeLeft(0);
          // Try to auto-submit with whatever we have (server has draft_answers)
          if (!submitted && !isSubmittingRef.current) {
            handleSubmitFromRef();
          }
          setLoading(false);
          return;
        }

        setTimeLeft(Math.floor(remainingMs / 1000));
        setQuizStatus('available');
      } else {
        setTimeLeft(duration * 60);
        setQuizStatus('available');
      }

      const { data: questionsData, error: questionsError } = await supabase
        .from('quiz_questions_student_view')
        .select('*')
        .eq('quiz_id', assignmentData.quiz_id)
        .order('order_index');

      if (questionsError) throw questionsError;
      const questionsWithPlaceholder = (questionsData || []).map(q => ({
        ...q,
        correct_answer: ''
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

  // ── Server-side answer saving (debounced 3s) ───────────────────────
  const saveAnswersToServer = useCallback(async (currentAnswers: Record<string, string>) => {
    if (!assignment || !user || submitted) return false;
    setSavingStatus('saving');
    try {
      const timestampedAnswers: Record<string, { answer: string; t: number }> = {};
      for (const [qid, ans] of Object.entries(currentAnswers)) {
        timestampedAnswers[qid] = { answer: ans, t: Date.now() };
      }

      await supabase.functions.invoke('save-quiz-answer', {
        body: {
          quiz_assignment_id: assignment.id,
          answers: timestampedAnswers,
        },
      });
      setSavingStatus('saved');
      // Reset to idle after 2s
      setTimeout(() => setSavingStatus(prev => prev === 'saved' ? 'idle' : prev), 2000);
      return true;
    } catch (err) {
      console.error('Failed to save answers to server:', err);
      setSavingStatus('error');
      return false;
    }
  }, [assignment?.id, user?.id, submitted]);

  const debouncedSave = useCallback((newAnswers: Record<string, string>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveAnswersToServer(newAnswers);
    }, 3000);
  }, [saveAnswersToServer]);

  // ── Heartbeat: presence only (no answers) ──────────────────────────
  const answeredCount = Object.keys(answers).length;
  useEffect(() => {
    if (!assignment || !user || quizStatus !== 'available' || questions.length === 0) return;

    const upsertProgress = async () => {
      try {
        await supabase
          .from('exam_live_progress')
          .upsert({
            student_id: user.id,
            quiz_assignment_id: assignment.id,
            current_question_index: currentIndex,
            answered_count: answeredCount,
            total_questions: questions.length,
            last_activity_at: new Date().toISOString(),
            status: 'in_progress',
          }, { onConflict: 'student_id,quiz_assignment_id' });
      } catch (e) {
        console.error('Failed to update exam live progress:', e);
      }
    };

    upsertProgress();
    const heartbeat = setInterval(upsertProgress, 15_000);
    return () => clearInterval(heartbeat);
  }, [currentIndex, answeredCount, quizStatus, assignment?.id, user?.id, questions.length]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: answer };
      // sessionStorage as fallback only
      sessionStorage.setItem(`quiz-${assignmentId}-answers`, JSON.stringify(next));
      // Debounced server save (primary)
      debouncedSave(next);
      return next;
    });
  };

  const handleIndexChange = (idx: number) => {
    setCurrentIndex(idx);
    sessionStorage.setItem(`quiz-${assignmentId}-index`, String(idx));
  };

  // ── Submit using ref (for timer/auto-submit to avoid stale closures)
  const handleSubmitFromRef = useCallback(() => {
    if (isSubmittingRef.current) return;
    // Always call the latest version of submitCore via ref
    submitCoreRef.current?.(answersRef.current);
  }, []);

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;
    handleSubmitCore(answers);
  };

  const handleSubmitCore = async (currentAnswers: Record<string, string>) => {
    if (!user || !assignment || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitting(true);

    const storedAnswers = getStoredAnswers();
    const answersForSubmit = Object.keys(currentAnswers).length > 0 ? currentAnswers : storedAnswers;

    // Flush any pending save first
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (Object.keys(answersForSubmit).length > 0) {
      await saveAnswersToServer(answersForSubmit);
    }

    // Update live progress to submitted
    supabase.from('exam_live_progress').upsert({
      student_id: user.id,
      quiz_assignment_id: assignment.id,
      current_question_index: currentIndex,
      answered_count: Object.keys(answersForSubmit).length,
      total_questions: questions.length,
      last_activity_at: new Date().toISOString(),
      status: 'submitted',
    }, { onConflict: 'student_id,quiz_assignment_id' }).then(() => {});

    try {
      await logStart('quiz_submission', assignment.id, {
        quiz_title: assignment.quizzes.title,
        quiz_id: assignment.quiz_id
      });

      // Retry with exponential backoff
      const data = await retryAsync(async () => {
        const { data, error } = await supabase.functions.invoke('grade-quiz', {
          body: {
            quiz_assignment_id: assignment.id,
            answers: answersForSubmit
          }
        });
        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Failed to grade quiz');
        return data;
      }, 3, 2000);

      setResult({
        score: data.score,
        maxScore: data.maxScore,
        percentage: data.percentage,
        passed: data.passed,
        hasOpenEnded: data.hasOpenEnded,
      });
      setGradeResults(data.results || {});
      setSubmitted(true);

      sessionStorage.removeItem(`quiz-${assignmentId}-answers`);
      sessionStorage.removeItem(`quiz-${assignmentId}-index`);

      await logComplete('quiz_submission', assignment.id, {
        quiz_title: assignment.quizzes.title,
        score: data.score,
        maxScore: data.maxScore,
        percentage: data.percentage,
        passed: data.passed,
        usedFallback: data.usedFallback,
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
        description: isRTL
          ? 'فشل في تسليم الكويز. إجاباتك محفوظة على السيرفر. حاول تاني.'
          : 'Failed to submit quiz. Your answers are saved on the server. Please try again.',
      });
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Keep submitCore ref always pointing to latest closure
  useEffect(() => { submitCoreRef.current = handleSubmitCore; });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  // ── Saving indicator component ─────────────────────────────────────
  const SaveIndicator = () => {
    if (savingStatus === 'idle') return null;
    return (
      <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
        savingStatus === 'saving' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
        savingStatus === 'saved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      }`}>
        {savingStatus === 'saving' && <>{isRTL ? 'جاري الحفظ...' : 'Saving...'}</>}
        {savingStatus === 'saved' && <>{isRTL ? '✓ تم الحفظ' : '✓ Saved'}</>}
        {savingStatus === 'error' && <><WifiOff className="w-3 h-3" />{isRTL ? 'فشل الحفظ' : 'Save failed'}</>}
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'حل الكويز' : 'Take Quiz'}>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t.common.loading}</p>
        </div>
      </DashboardLayout>
    );
  }

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

  if (quizStatus === 'frozen') {
    return (
      <DashboardLayout title={isRTL ? 'حل الكويز' : 'Take Quiz'}>
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-sky-100 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-sky-600" />
            </div>
            <CardTitle className="mt-4">
              {isRTL ? 'المجموعة مجمدة' : 'Group is Frozen'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? assignment?.quizzes?.title_ar : assignment?.quizzes?.title}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-lg bg-sky-50 text-center">
              <p className="text-sm text-sky-700">
                {isRTL
                  ? 'مجموعتك مجمدة حالياً ولا يمكنك حل كويزات جديدة. تواصل مع الإدارة لمزيد من المعلومات.'
                  : 'Your group is currently frozen and you cannot take new quizzes. Contact administration for more information.'}
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

  // Show expired with auto-submit attempt info
  if (quizStatus === 'expired' && !submitted && !submitting) {
    return (
      <DashboardLayout title={isRTL ? 'حل الكويز' : 'Take Quiz'}>
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="w-10 h-10 text-amber-600" />
            </div>
            <CardTitle className="mt-4">
              {isRTL ? 'جاري تسليم الإجابات...' : 'Submitting your answers...'}
            </CardTitle>
            <CardDescription>
              {isRTL
                ? 'إجاباتك محفوظة على السيرفر. جاري التسليم التلقائي.'
                : 'Your answers are saved on the server. Auto-submitting now.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {isRTL ? 'حاول التسليم يدوياً' : 'Try Manual Submit'}
            </Button>
            <Button className="w-full" variant="outline" onClick={() => navigate('/my-quizzes')}>
              {isRTL ? 'العودة لقائمة الكويزات' : 'Back to My Quizzes'}
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (submitted && result) {
    const isFinalExam = !assignment?.session_id;

    return (
      <DashboardLayout title={isRTL ? 'نتيجة الكويز' : 'Quiz Result'}>
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            {isFinalExam ? (
              <>
                <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center bg-green-100">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <CardTitle className="mt-4">
                  {isRTL ? 'تم تسليم الامتحان بنجاح' : 'Exam Submitted Successfully'}
                </CardTitle>
                <CardDescription>
                  {isRTL ? 'ستظهر النتيجة النهائية بعد مراجعة المدرب.' : 'Final results will appear after instructor review.'}
                </CardDescription>
              </>
            ) : result.hasOpenEnded ? (
              <>
                <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center bg-amber-100">
                  <Clock className="w-10 h-10 text-amber-600" />
                </div>
                <CardTitle className="mt-4">
                  {isRTL ? 'تم تسليم الامتحان بنجاح' : 'Exam Submitted Successfully'}
                </CardTitle>
                <CardDescription>
                  {isRTL ? 'يحتوي الامتحان على أسئلة تحتاج تصحيح يدوي. ستظهر النتيجة النهائية بعد التصحيح.' : 'This exam contains questions that require manual grading. Final results will appear after grading.'}
                </CardDescription>
              </>
            ) : (
              <>
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
              </>
            )}
            <CardDescription>
              {language === 'ar' ? assignment?.quizzes?.title_ar : assignment?.quizzes?.title}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isFinalExam && (
              <>
                <div className="text-center">
                  {result.percentage !== null ? (
                    <>
                      <div className="text-5xl font-bold">{result.percentage}%</div>
                      <p className="text-muted-foreground mt-2">
                        {result.score} / {result.maxScore} {isRTL ? 'درجة' : 'points'}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-amber-600">
                        {isRTL ? 'في انتظار التصحيح' : 'Pending Grading'}
                      </div>
                      <p className="text-muted-foreground mt-2">
                        {isRTL ? `الأسئلة الاختيارية: ${result.score} درجة` : `MCQ Score: ${result.score} points`}
                      </p>
                    </>
                  )}
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

                {/* Review answers */}
                <div className="space-y-4 mt-6">
                  <h3 className="font-semibold">{isRTL ? 'مراجعة الإجابات' : 'Review Answers'}</h3>
                  {questions.map((q, idx) => {
                    const optionsData = q.options as any;
                    let optionsList: string[] = [];
                    if (optionsData?.en && Array.isArray(optionsData.en)) {
                      optionsList = language === 'ar' && optionsData.ar ? optionsData.ar : optionsData.en;
                    } else if (optionsData?.options && Array.isArray(optionsData.options)) {
                      optionsList = optionsData.options.map((opt: any) => language === 'ar' ? opt.text_ar : opt.text);
                    }
                    const userAnswerIdx = answers[q.id] ? parseInt(answers[q.id]) : -1;
                    const selectedOptionText = optionsList[userAnswerIdx] || null;
                    const questionResult = gradeResults[q.id];
                    const isCorrect = questionResult?.correct || false;
                    const correctAnswerText = questionResult?.correctAnswer || '';
                    let correctAnswerIdx = (questionResult as any)?.correctIndex ?? -1;
                    if (correctAnswerIdx < 0) {
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
              </>
            )}

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
              <div className="flex items-center gap-3">
                <SaveIndicator />
                <div className={`flex items-center gap-2 text-lg font-mono ${timeLeft < 60 ? 'text-red-600 animate-pulse' : ''}`}>
                  <Clock className="w-5 h-5" />
                  {formatTime(timeLeft)}
                </div>
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
              {currentQuestion.image_url && (
                <div className="mt-4 rounded-lg overflow-hidden border">
                  <img src={currentQuestion.image_url} alt={`Question ${currentIndex + 1}`} className="w-full max-h-80 object-contain bg-muted" />
                </div>
              )}
              {currentQuestion.code_snippet && (
                <div className="mt-4">
                  <CodeBlock code={currentQuestion.code_snippet} />
                </div>
              )}
            </CardHeader>
            <CardContent>
              {currentQuestion.question_type === 'open_ended' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <FileText className="w-4 h-4" />
                    {isRTL ? 'اكتب إجابتك بالتفصيل' : 'Write your detailed answer'}
                  </div>
                  <Textarea
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder={isRTL ? 'اكتب إجابتك هنا...' : 'Write your answer here...'}
                    className="min-h-[200px] font-mono text-sm"
                    dir="rtl"
                    style={{ unicodeBidi: 'plaintext' }}
                  />
                </div>
              ) : (
                <RadioGroup
                  value={answers[currentQuestion.id] || ''}
                  onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                  className="space-y-3"
                >
                  {(() => {
                    const optionsData = currentQuestion.options as any;
                    let optionsList: string[] = [];
                    if (optionsData?.en && Array.isArray(optionsData.en)) {
                      optionsList = language === 'ar' && optionsData.ar ? optionsData.ar : optionsData.en;
                    } else if (optionsData?.options && Array.isArray(optionsData.options)) {
                      optionsList = optionsData.options.map((opt: any) => language === 'ar' ? opt.text_ar : opt.text);
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
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => handleIndexChange(Math.max(0, currentIndex - 1))}
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
              onClick={() => handleIndexChange(Math.min(questions.length - 1, currentIndex + 1))}
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
                  onClick={() => handleIndexChange(idx)}
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
