import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CalendarDays, Play, CheckCircle, Loader2, ShieldAlert, LogOut } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { KojobotLogo } from '@/components/KojobotLogo';

type PlacementStatus = 'loading' | 'not_scheduled' | 'scheduled' | 'open' | 'submitted' | 'no_schedule';

export default function PlacementGate() {
  const { user, signOut } = useAuth();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [status, setStatus] = useState<PlacementStatus>('loading');
  const [schedule, setSchedule] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    fetchSchedule();
    // Re-check every 30 seconds for auto-open
    const interval = setInterval(fetchSchedule, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchSchedule = async () => {
    try {
      // Check if there's an active schedule
      const { data: scheduleData } = await supabase
        .from('placement_exam_schedules' as any)
        .select('*')
        .eq('student_id', user!.id)
        // Include 'expired' to recover from any previous incorrect status updates;
        // actual availability is determined by opens_at/closes_at below.
        .in('status', ['scheduled', 'open', 'expired'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!scheduleData) {
      // Check if there's a submitted attempt awaiting review
        const { data: attempt } = await supabase
          .from('placement_exam_attempts' as any)
          .select('id, status')
          .eq('student_id', user!.id)
          .in('status', ['submitted', 'in_progress'])
          .maybeSingle();

        const attemptStatus = (attempt as any)?.status;
        if (attemptStatus === 'submitted') {
          setStatus('submitted');
          return;
        }
        if (attemptStatus === 'in_progress') {
          setStatus('open');
          setSchedule(null);
          return;
        }

        setStatus('not_scheduled');
        return;
      }

      setSchedule(scheduleData);

      const now = new Date();
      const opensAt = new Date((scheduleData as any).opens_at);
      const closesAt = new Date((scheduleData as any).closes_at);

      if (now >= opensAt && now <= closesAt) {
        setStatus('open');
      } else if (now < opensAt) {
        setStatus('scheduled');
      } else {
        // Expired
        setStatus('not_scheduled');
      }
    } catch (err) {
      console.error('PlacementGate error:', err);
      setStatus('not_scheduled');
    }
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Cairo',
    });
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-lg shadow-xl border-0">
        <CardContent className="pt-8 pb-8 px-6 flex flex-col items-center text-center space-y-6">
          <KojobotLogo size="lg" />

          {/* Not Scheduled */}
          {status === 'not_scheduled' && (
            <>
              <div className="p-4 rounded-full bg-muted">
                <ShieldAlert className="h-12 w-12 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold">
                {isRTL ? 'لم يتم تحديد موعد الامتحان بعد' : 'No Exam Scheduled Yet'}
              </h2>
              <p className="text-muted-foreground max-w-sm">
                {isRTL
                  ? 'يرجى التواصل مع الإدارة لتحديد موعد امتحان تحديد المستوى. لن تتمكن من الوصول للمنصة قبل اجتياز الامتحان.'
                  : 'Please contact the administration to schedule your placement exam. You cannot access the platform until the exam is completed.'}
              </p>
              <Button variant="outline" onClick={signOut} className="mt-2">
                <LogOut className="h-4 w-4 me-2" />
                {isRTL ? 'تسجيل الخروج' : 'Sign Out'}
              </Button>
            </>
          )}

          {/* Scheduled — Waiting */}
          {status === 'scheduled' && schedule && (
            <>
              <div className="p-4 rounded-full bg-primary/10">
                <CalendarDays className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-xl font-bold">
                {isRTL ? 'موعد امتحان تحديد المستوى' : 'Placement Exam Scheduled'}
              </h2>
              
              <div className="bg-muted/50 rounded-lg p-4 w-full space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-lg">
                    {formatDateTime(schedule.opens_at)}
                  </span>
                </div>
                {schedule.notes && (
                  <p className="text-sm text-muted-foreground">{schedule.notes}</p>
                )}
              </div>

              <Badge variant="secondary" className="text-sm px-4 py-1.5">
                {isRTL ? 'المنصة ستفتح بعد اجتياز الامتحان' : 'Platform will unlock after passing the exam'}
              </Badge>
            </>
          )}

          {/* Open — Can Start */}
          {status === 'open' && (
            <>
              <div className="p-4 rounded-full bg-green-500/10">
                <Play className="h-12 w-12 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-green-700 dark:text-green-400">
                {isRTL ? 'الامتحان متاح الآن!' : 'Exam is Now Open!'}
              </h2>
              <p className="text-muted-foreground max-w-sm">
                {isRTL
                  ? 'يمكنك البدء في امتحان تحديد المستوى الآن. أجب على جميع الأسئلة ثم اضغط تسليم.'
                  : 'You can start your placement exam now. Answer all questions and submit when ready.'}
              </p>
              {schedule && (
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'ينتهي الموعد:' : 'Closes at:'} {formatDateTime(schedule.closes_at)}
                </p>
              )}
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => navigate('/placement-test')}
              >
                <Play className="h-5 w-5 me-2" />
                {isRTL ? 'ابدأ امتحان تحديد المستوى' : 'Start Placement Exam'}
              </Button>
            </>
          )}

          {/* Submitted — Awaiting Review */}
          {status === 'submitted' && (
            <>
              <div className="p-4 rounded-full bg-blue-500/10">
                <CheckCircle className="h-12 w-12 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold">
                {isRTL ? 'تم استلام امتحان تحديد المستوى' : 'Placement Exam Received'}
              </h2>
              <p className="text-muted-foreground max-w-sm">
                {isRTL
                  ? 'تم استلام إجاباتك بنجاح. بانتظار المراجعة وتحديد المستوى المناسب. ستتواصل معك الإدارة قريباً.'
                  : 'Your answers have been received. Awaiting review and level assignment. The administration will contact you soon.'}
              </p>
              <Badge variant="outline" className="text-sm px-4 py-1.5">
                {isRTL ? 'بانتظار المراجعة' : 'Awaiting Review'}
              </Badge>
            </>
          )}

          {/* Sign Out — always visible */}
          {status !== 'not_scheduled' && (
            <Button variant="outline" onClick={signOut} className="mt-2">
              <LogOut className="h-4 w-4 me-2" />
              {isRTL ? 'تسجيل الخروج' : 'Sign Out'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
