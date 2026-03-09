import { Clock, CheckCircle, Play, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KojobotLogo } from '@/components/KojobotLogo';
import type { ExamPhase } from '@/pages/TakePlacementTest';

interface PlacementExamStatusProps {
  phase: ExamPhase;
  errorMsg: string;
  isRTL: boolean;
  onStart: () => void;
  onBack: () => void;
  onSignOut: () => void;
}

export function PlacementExamStatus({ phase, errorMsg, isRTL, onStart, onBack, onSignOut }: PlacementExamStatusProps) {
  const isWindowError = errorMsg.includes('expired') || errorMsg.includes('not open yet') || errorMsg.includes('No placement exam scheduled');

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="p-4 border-b flex justify-between items-center">
        <KojobotLogo size="md" />
        <Button variant="ghost" size="icon" onClick={onSignOut}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 text-center max-w-md mx-auto">
        {/* Loading */}
        {phase === 'loading' && (
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        )}

        {/* Error */}
        {phase === 'error' && (
          isWindowError ? (
            <>
              <div className="p-4 rounded-full bg-muted">
                <Clock className="h-12 w-12 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold">
                {isRTL ? 'انتهت نافذة الامتحان' : 'Exam Window Closed'}
              </h2>
              <p className="text-muted-foreground text-sm">
                {isRTL
                  ? 'انتهى الوقت المحدد للامتحان. يرجى التواصل مع الإدارة لتحديد موعد جديد. سيتم تحويلك تلقائياً...'
                  : 'The exam window has closed. Please contact administration to schedule a new session. Redirecting...'}
              </p>
            </>
          ) : (
            <>
              <p className="text-destructive text-lg font-medium">{errorMsg}</p>
              <Button onClick={onBack}>
                {isRTL ? 'العودة' : 'Back'}
              </Button>
            </>
          )
        )}

        {/* Ready */}
        {phase === 'ready' && (
          <>
            <div className="p-4 rounded-full bg-primary/10">
              <Clock className="h-16 w-16 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">
              {isRTL ? 'امتحان تحديد المستوى' : 'Placement Exam'}
            </h2>
            <p className="text-muted-foreground max-w-md">
              {isRTL
                ? 'الامتحان مكون من 3 أقسام: القسم A (أساسيات الحاسب)، القسم B (أساسيات البرمجة)، القسم C (ميول المسار). أجب على جميع الأسئلة ثم اضغط تسليم.'
                : 'The exam consists of 3 sections: Section A (Computer Basics), Section B (Programming Fundamentals), Section C (Track Inclination). Answer all questions then submit.'}
            </p>
            <Button size="lg" onClick={onStart}>
              <Play className="h-5 w-5 me-2" />
              {isRTL ? 'ابدأ الامتحان' : 'Start Exam'}
            </Button>
          </>
        )}

        {/* Submitted — No results shown */}
        {phase === 'submitted' && (
          <>
            <CheckCircle className="h-20 w-20 text-green-500" />
            <h2 className="text-2xl font-bold">
              {isRTL ? 'تم التسليم بنجاح!' : 'Submitted Successfully!'}
            </h2>
            <p className="text-muted-foreground max-w-md">
              {isRTL
                ? 'تم استلام إجاباتك بنجاح. بانتظار مراجعة واعتماد النتيجة من الإدارة.'
                : 'Your answers have been received. Awaiting review and approval by administration.'}
            </p>
            <Badge variant="outline" className="text-sm px-4 py-1.5">
              {isRTL ? 'بانتظار الاعتماد' : 'Pending Approval'}
            </Badge>
            <Button onClick={onBack}>
              {isRTL ? 'العودة' : 'Back'}
            </Button>
          </>
        )}

        {/* Submitting */}
        {phase === 'submitting' && (
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        )}
      </div>
    </div>
  );
}
