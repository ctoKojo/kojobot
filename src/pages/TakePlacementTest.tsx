import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { KojobotLogo } from '@/components/KojobotLogo';
import { PlacementExamHeader } from '@/components/placement-exam/PlacementExamHeader';
import { PlacementExamQuestion } from '@/components/placement-exam/PlacementExamQuestion';
import { PlacementExamReview } from '@/components/placement-exam/PlacementExamReview';
import { PlacementExamStatus } from '@/components/placement-exam/PlacementExamStatus';

export interface ExamQuestion {
  order: number;
  question_id: number;
  question_text_ar: string;
  options: string[];
  skill: string;
  code_snippet: string | null;
  image_url: string | null;
}

export type ExamPhase = 'loading' | 'ready' | 'in_progress' | 'review' | 'submitting' | 'submitted' | 'error';

export default function TakePlacementTest() {
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const { user, signOut } = useAuth();

  const [phase, setPhase] = useState<ExamPhase>('loading');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState('');

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

      setPhase('ready');
    } catch {
      setPhase('ready');
    }
  };

  const startExam = useCallback(async () => {
    setPhase('loading');
    try {
      const { data, error } = await supabase.functions.invoke('draw-placement-exam');

      if (data?.error) throw new Error(data.error);

      if (error) {
        const context = (error as any)?.context;
        if (context) {
          try {
            const parsed = typeof context === 'string' ? JSON.parse(context) : await context?.json?.();
            if (parsed?.error) throw new Error(parsed.error);
          } catch (e2: any) {
            if (e2?.message && !e2.message.includes('JSON')) throw e2;
          }
        }
        throw new Error((error as any)?.message || 'Failed to start exam');
      }

      setAttemptId(data.attempt_id);
      setQuestions(data.questions || []);
      setAnswers({});
      setCurrentIndex(0);
      setPhase('in_progress');
    } catch (err: any) {
      const msg: string = err.message || 'Failed to start exam';
      setErrorMsg(msg);
      if (msg.includes('expired') || msg.includes('not open yet') || msg.includes('No placement exam scheduled')) {
        setTimeout(() => navigate('/placement-gate'), 2500);
      }
      setPhase('error');
    }
  }, [navigate]);

  const handleSubmit = useCallback(async () => {
    if (!attemptId || phase === 'submitting') return;
    setPhase('submitting');

    const formattedAnswers: Record<string, string> = {};
    for (const q of questions) {
      const selected = answers[String(q.question_id)];
      if (selected !== undefined) {
        formattedAnswers[String(q.question_id)] = selected;
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

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const answeredCount = Object.keys(answers).length;

  // Non-exam phases
  if (phase !== 'in_progress' && phase !== 'review') {
    return (
      <PlacementExamStatus
        phase={phase}
        errorMsg={errorMsg}
        isRTL={isRTL}
        onStart={startExam}
        onBack={() => navigate('/placement-gate')}
        onSignOut={signOut}
      />
    );
  }

  // Review phase
  if (phase === 'review') {
    return (
      <div className="min-h-screen bg-background flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-4 border-b flex justify-between items-center">
          <KojobotLogo size="md" />
          <Button variant="ghost" size="icon" onClick={signOut} title={isRTL ? 'تسجيل الخروج' : 'Sign Out'}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <PlacementExamReview
            questions={questions}
            answers={answers}
            isRTL={isRTL}
            phase={phase}
            onGoBack={() => setPhase('in_progress')}
            onGoToQuestion={(idx) => { setCurrentIndex(idx); setPhase('in_progress'); }}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    );
  }

  // In progress
  return (
    <div className="min-h-screen bg-background flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="p-4 border-b flex justify-between items-center">
        <KojobotLogo size="md" />
        <Button variant="ghost" size="icon" onClick={signOut} title={isRTL ? 'تسجيل الخروج' : 'Sign Out'}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 space-y-6">
          <PlacementExamHeader
            currentIndex={currentIndex}
            totalQuestions={questions.length}
            answeredCount={answeredCount}
            isRTL={isRTL}
          />

          {questions[currentIndex] && (
            <PlacementExamQuestion
              question={questions[currentIndex]}
              questionIndex={currentIndex}
              selectedAnswer={answers[String(questions[currentIndex].question_id)] || ''}
              onAnswer={handleAnswer}
              isRTL={isRTL}
            />
          )}

          <PlacementExamNavigation
            currentIndex={currentIndex}
            totalQuestions={questions.length}
            isRTL={isRTL}
            onPrev={() => setCurrentIndex(prev => prev - 1)}
            onNext={() => setCurrentIndex(prev => prev + 1)}
            onReview={() => setPhase('review')}
          />
        </div>
      </div>
    </div>
  );
}

import { ArrowLeft, ArrowRight, Eye } from 'lucide-react';

function PlacementExamNavigation({
  currentIndex,
  totalQuestions,
  isRTL,
  onPrev,
  onNext,
  onReview,
}: {
  currentIndex: number;
  totalQuestions: number;
  isRTL: boolean;
  onPrev: () => void;
  onNext: () => void;
  onReview: () => void;
}) {
  return (
    <div className="flex justify-between pb-6">
      <Button
        variant="outline"
        disabled={currentIndex === 0}
        onClick={onPrev}
      >
        {isRTL ? <ArrowRight className="h-4 w-4 me-1" /> : <ArrowLeft className="h-4 w-4 me-1" />}
        {isRTL ? 'السابق' : 'Previous'}
      </Button>

      {currentIndex < totalQuestions - 1 ? (
        <Button onClick={onNext}>
          {isRTL ? 'التالي' : 'Next'}
          {isRTL ? <ArrowLeft className="h-4 w-4 ms-1" /> : <ArrowRight className="h-4 w-4 ms-1" />}
        </Button>
      ) : (
        <Button
          onClick={onReview}
          className="bg-green-600 hover:bg-green-700"
        >
          <Eye className="h-4 w-4 me-1" />
          {isRTL ? 'مراجعة وتسليم' : 'Review & Submit'}
        </Button>
      )}
    </div>
  );
}
