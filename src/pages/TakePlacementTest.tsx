import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, CheckCircle, Play } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CodeBlock } from '@/components/quiz/CodeBlock';

interface ExamQuestion {
  order: number;
  question_id: number;
  question_text_ar: string;
  options: string[];
  skill: string;
  code_snippet: string | null;
  image_url: string | null;
}

type ExamPhase = 'loading' | 'ready' | 'in_progress' | 'submitting' | 'submitted' | 'error';

export default function TakePlacementTest() {
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();

  const [phase, setPhase] = useState<ExamPhase>('loading');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState('');

  // Check for existing in_progress attempt on mount
  useEffect(() => {
    if (!user) return;
    checkExistingAttempt();
  }, [user]);

  const checkExistingAttempt = async () => {
    try {
      const { data } = await supabase
        .from('placement_exam_student_view' as any)
        .select('id, status')
        .eq('student_id', user!.id)
        .eq('status', 'in_progress')
        .maybeSingle();

      if (data) {
        // Resume — re-draw will return the existing attempt
        setPhase('ready');
      } else {
        setPhase('ready');
      }
    } catch {
      setPhase('ready');
    }
  };

  const startExam = useCallback(async () => {
    setPhase('loading');
    try {
      const { data, error } = await supabase.functions.invoke('draw-placement-exam');

      if (error) {
        const body = typeof error === 'object' && 'message' in error ? error.message : String(error);
        throw new Error(body);
      }

      if (data?.error) {
        if (data.attempt_id) {
          // Already in progress — we don't have questions though, so show error
          setErrorMsg(isRTL ? 'لديك امتحان جارٍ بالفعل' : 'You already have an exam in progress');
          setPhase('error');
          return;
        }
        throw new Error(data.error);
      }

      setAttemptId(data.attempt_id);
      setQuestions(data.questions || []);
      setAnswers({});
      setCurrentIndex(0);
      setPhase('in_progress');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start exam');
      setPhase('error');
    }
  }, [isRTL]);

  const handleSubmit = useCallback(async () => {
    if (!attemptId || phase === 'submitting') return;
    setPhase('submitting');

    // Build answers map: question_id -> "A"|"B"|"C"|"D"
    const letterMap = ['A', 'B', 'C', 'D'];
    const formattedAnswers: Record<string, string> = {};
    for (const q of questions) {
      const selectedIdx = answers[String(q.question_id)];
      if (selectedIdx !== undefined) {
        const idx = parseInt(selectedIdx);
        formattedAnswers[String(q.question_id)] = letterMap[idx] || selectedIdx;
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke('grade-placement-exam', {
        body: { attempt_id: attemptId, answers: formattedAnswers },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPhase('submitted');
      toast({ title: isRTL ? 'تم التسليم بنجاح' : 'Submitted successfully' });
    } catch (err: any) {
      toast({
        title: isRTL ? 'خطأ في التسليم' : 'Submission error',
        description: err.message,
        variant: 'destructive',
      });
      setPhase('in_progress');
    }
  }, [attemptId, answers, questions, phase, isRTL, toast]);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = Object.keys(answers).length;

  // Loading
  if (phase === 'loading') {
    return (
      <DashboardLayout title={isRTL ? 'امتحان تحديد المستوى' : 'Placement Exam'}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  // Error
  if (phase === 'error') {
    return (
      <DashboardLayout title={isRTL ? 'امتحان تحديد المستوى' : 'Placement Exam'}>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-destructive text-lg font-medium">{errorMsg}</p>
          <Button onClick={() => navigate('/dashboard')}>
            {isRTL ? 'العودة للرئيسية' : 'Back to Dashboard'}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Ready — show start button
  if (phase === 'ready') {
    return (
      <DashboardLayout title={isRTL ? 'امتحان تحديد المستوى' : 'Placement Exam'}>
        <div className="flex flex-col items-center justify-center h-96 gap-6">
          <div className="p-4 rounded-full bg-primary/10">
            <Clock className="h-16 w-16 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-center">
            {isRTL ? 'امتحان تحديد المستوى' : 'Placement Exam'}
          </h2>
          <p className="text-muted-foreground text-center max-w-md">
            {isRTL
              ? 'سيتم سحب أسئلة عشوائية مناسبة لفئتك العمرية. أجب على جميع الأسئلة ثم اضغط تسليم.'
              : 'Random questions will be drawn for your age group. Answer all questions then submit.'}
          </p>
          <Button size="lg" onClick={startExam}>
            <Play className="h-5 w-5 me-2" />
            {isRTL ? 'ابدأ الامتحان' : 'Start Exam'}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Submitted
  if (phase === 'submitted') {
    return (
      <DashboardLayout title={isRTL ? 'امتحان تحديد المستوى' : 'Placement Exam'}>
        <div className="flex flex-col items-center justify-center h-96 gap-6">
          <CheckCircle className="h-20 w-20 text-green-500" />
          <h2 className="text-2xl font-bold text-center">
            {isRTL ? 'تم التسليم بنجاح!' : 'Submitted Successfully!'}
          </h2>
          <p className="text-muted-foreground text-center max-w-md">
            {isRTL
              ? 'ستتواصل معك الإدارة بخصوص نتيجة الامتحان وتحديد المستوى المناسب لك.'
              : 'The administration will contact you regarding your test results and appropriate level placement.'}
          </p>
          <Button onClick={() => navigate('/placement-gate')}>
            {isRTL ? 'العودة' : 'Back'}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // In progress
  return (
    <DashboardLayout title={isRTL ? 'امتحان تحديد المستوى' : 'Placement Exam'}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Progress */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <Badge variant="secondary" className="text-base px-3 py-1">
                {isRTL ? `سؤال ${currentIndex + 1} من ${questions.length}` : `Question ${currentIndex + 1} of ${questions.length}`}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {answeredCount}/{questions.length} {isRTL ? 'مجاب' : 'answered'}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        {/* Question */}
        {currentQuestion && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isRTL ? `سؤال ${currentIndex + 1}` : `Question ${currentIndex + 1}`}
                <Badge variant="outline" className="ms-2 text-xs">{currentQuestion.skill}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-base leading-relaxed whitespace-pre-wrap">
                {currentQuestion.question_text_ar}
              </p>

              {currentQuestion.image_url && (
                <img src={currentQuestion.image_url} alt="Question" className="max-w-full rounded-lg" />
              )}

              {currentQuestion.code_snippet && (
                <CodeBlock code={currentQuestion.code_snippet} />
              )}

              <RadioGroup
                value={answers[String(currentQuestion.question_id)] || ''}
                onValueChange={val => setAnswers(prev => ({ ...prev, [String(currentQuestion.question_id)]: val }))}
              >
                {(() => {
                  const opts = currentQuestion.options;
                  // Handle both array and object formats
                  const entries: [string, string][] = Array.isArray(opts)
                    ? opts.map((o, i) => [String(i), o])
                    : typeof opts === 'object' && opts !== null
                      ? (Object.entries(opts) as [string, string][]).sort(([a], [b]) => a.localeCompare(b))
                      : [];
                  return entries.map(([key, val], idx) => (
                    <div key={key} className="flex items-center space-x-2 rtl:space-x-reverse p-3 rounded-lg border hover:bg-accent transition-colors">
                      <RadioGroupItem value={key} id={`opt-${key}`} />
                      <Label htmlFor={`opt-${key}`} className="flex-1 cursor-pointer">{val}</Label>
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
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(prev => prev - 1)}
          >
            {isRTL ? <ArrowRight className="h-4 w-4 me-1" /> : <ArrowLeft className="h-4 w-4 me-1" />}
            {isRTL ? 'السابق' : 'Previous'}
          </Button>

          {currentIndex < questions.length - 1 ? (
            <Button onClick={() => setCurrentIndex(prev => prev + 1)}>
              {isRTL ? 'التالي' : 'Next'}
              {isRTL ? <ArrowLeft className="h-4 w-4 ms-1" /> : <ArrowRight className="h-4 w-4 ms-1" />}
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={phase === 'submitting'}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 me-1" />
              {phase === 'submitting' ? (isRTL ? 'جارٍ التسليم...' : 'Submitting...') : (isRTL ? 'تسليم الامتحان' : 'Submit Exam')}
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
