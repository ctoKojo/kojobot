import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, CheckCircle } from 'lucide-react';
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

interface Question {
  id: string;
  question_text: string;
  question_text_ar: string;
  options: unknown;
  points: number;
  order_index: number;
  image_url?: string | null;
  code_snippet?: string | null;
}

export default function TakePlacementTest() {
  const { id: placementTestId } = useParams();
  const navigate = useNavigate();
  const { isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();

  const [placementTest, setPlacementTest] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (placementTestId && user) fetchPlacementTest();
  }, [placementTestId, user]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const fetchPlacementTest = async () => {
    try {
      const { data: pt, error } = await supabase
        .from('placement_tests')
        .select('*')
        .eq('id', placementTestId)
        .single();

      if (error || !pt) {
        toast({ title: isRTL ? 'لم يتم العثور على الامتحان' : 'Test not found', variant: 'destructive' });
        navigate('/dashboard');
        return;
      }

      if (pt.status === 'completed') {
        setSubmitted(true);
        setLoading(false);
        return;
      }

      if (pt.status === 'expired') {
        toast({ title: isRTL ? 'انتهت صلاحية الامتحان' : 'Test has expired', variant: 'destructive' });
        navigate('/dashboard');
        return;
      }

      setPlacementTest(pt);

      // Calculate time left
      const scheduledAt = new Date(pt.scheduled_at).getTime();
      const endTime = scheduledAt + pt.duration_minutes * 60 * 1000;
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);

      // Update status to in_progress if still pending
      if (pt.status === 'pending') {
        await supabase.from('placement_tests')
          .update({ status: 'in_progress', started_at: new Date().toISOString() })
          .eq('id', placementTestId);
      }

      // Fetch questions (student view — no correct_answer)
      const { data: qData } = await supabase
        .from('quiz_questions_student_view')
        .select('id, question_text, question_text_ar, options, points, order_index, image_url, code_snippet')
        .eq('quiz_id', pt.quiz_id)
        .order('order_index');

      setQuestions(qData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting || submitted) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('grade-placement-test', {
        body: { placement_test_id: placementTestId, answers },
      });

      if (error) throw error;
      setSubmitted(true);
      toast({ title: isRTL ? 'تم التسليم بنجاح' : 'Submitted successfully' });
    } catch (err: any) {
      toast({
        title: isRTL ? 'خطأ في التسليم' : 'Submission error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = Object.keys(answers).length;

  const getOptions = (q: Question): string[] => {
    const opts = q.options as any;
    if (opts?.en && Array.isArray(opts.en)) return language === 'ar' && opts.ar ? opts.ar : opts.en;
    if (opts?.options && Array.isArray(opts.options)) return opts.options.map((o: any) => o.text);
    return [];
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'امتحان تحديد المستوى' : 'Placement Test'}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (submitted) {
    return (
      <DashboardLayout title={isRTL ? 'امتحان تحديد المستوى' : 'Placement Test'}>
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
          <Button onClick={() => navigate('/dashboard')}>
            {isRTL ? 'العودة للرئيسية' : 'Back to Dashboard'}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={isRTL ? 'امتحان تحديد المستوى' : 'Placement Test'}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Timer + Progress */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <Badge variant={timeLeft < 60 ? 'destructive' : 'secondary'} className="text-base px-3 py-1">
                <Clock className="h-4 w-4 me-1" />
                {formatTime(timeLeft)}
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
                <Badge variant="outline" className="ms-2">{currentQuestion.points} {isRTL ? 'نقطة' : 'pts'}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-base leading-relaxed">
                {isRTL ? currentQuestion.question_text_ar : currentQuestion.question_text}
              </p>

              {currentQuestion.image_url && (
                <img src={currentQuestion.image_url} alt="Question" className="max-w-full rounded-lg" />
              )}

              {currentQuestion.code_snippet && (
                <CodeBlock code={currentQuestion.code_snippet} />
              )}

              <RadioGroup
                value={answers[currentQuestion.id] || ''}
                onValueChange={val => setAnswers(prev => ({ ...prev, [currentQuestion.id]: val }))}
              >
                {getOptions(currentQuestion).map((opt, idx) => (
                  <div key={idx} className="flex items-center space-x-2 rtl:space-x-reverse p-3 rounded-lg border hover:bg-accent transition-colors">
                    <RadioGroupItem value={String(idx)} id={`opt-${idx}`} />
                    <Label htmlFor={`opt-${idx}`} className="flex-1 cursor-pointer">{opt}</Label>
                  </div>
                ))}
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
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 me-1" />
              {submitting ? (isRTL ? 'جارٍ التسليم...' : 'Submitting...') : (isRTL ? 'تسليم الامتحان' : 'Submit Test')}
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
