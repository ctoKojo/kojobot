import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Eye, Clock, CheckCircle2, User, Activity } from 'lucide-react';

interface LiveProgress {
  id: string;
  student_id: string;
  quiz_assignment_id: string;
  current_question_index: number;
  answered_count: number;
  total_questions: number;
  started_at: string;
  last_activity_at: string;
  status: string;
}

interface StudentInfo {
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
  avatar_url: string | null;
}

interface ExamLiveMonitorProps {
  quizId: string;
  groupId: string;
}

export function ExamLiveMonitor({ quizId, groupId }: ExamLiveMonitorProps) {
  const { isRTL, language } = useLanguage();
  const [progressList, setProgressList] = useState<(LiveProgress & { student?: StudentInfo })[]>([]);
  const [loading, setLoading] = useState(true);

  const [examEndTime, setExamEndTime] = useState<number | null>(null);
  const [countdown, setCountdown] = useState('');

  const fetchProgress = async () => {
    // Get all quiz assignments for this quiz+group
    const { data: assignments } = await supabase
      .from('quiz_assignments')
      .select('id, student_id, start_time, quizzes(duration_minutes)')
      .eq('quiz_id', quizId)
      .eq('group_id', groupId)
      .eq('is_active', true);

    if (!assignments?.length) {
      setLoading(false);
      return;
    }

    // Calculate exam end time from first assignment with start_time
    const firstWithStart = assignments.find(a => a.start_time);
    if (firstWithStart?.start_time) {
      const duration = (firstWithStart.quizzes as any)?.duration_minutes || 30;
      const endMs = new Date(firstWithStart.start_time).getTime() + duration * 60 * 1000;
      setExamEndTime(endMs);
    }

    const assignmentIds = assignments.map(a => a.id);
    const studentIds = assignments.map(a => a.student_id);

    // Get live progress
    const { data: progress } = await supabase
      .from('exam_live_progress')
      .select('*')
      .in('quiz_assignment_id', assignmentIds);

    // Get student profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, full_name_ar, avatar_url')
      .in('user_id', studentIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    // Merge: show all assigned students, with progress if available
    const merged = assignments.map(a => {
      const prog = progress?.find(p => p.quiz_assignment_id === a.id);
      const student = profileMap.get(a.student_id);
      return {
        id: prog?.id || a.id,
        student_id: a.student_id,
        quiz_assignment_id: a.id,
        current_question_index: prog?.current_question_index || 0,
        answered_count: prog?.answered_count || 0,
        total_questions: prog?.total_questions || 0,
        started_at: prog?.started_at || '',
        last_activity_at: prog?.last_activity_at || '',
        status: prog?.status || 'not_started',
        student,
      };
    });

    setProgressList(merged);
    setLoading(false);
  };

  // Countdown timer
  useEffect(() => {
    if (!examEndTime) return;
    const tick = () => {
      const remaining = Math.max(0, examEndTime - Date.now());
      if (remaining <= 0) {
        setCountdown(isRTL ? 'انتهى الوقت' : 'Time\'s up');
        return;
      }
      const totalSec = Math.floor(remaining / 1000);
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      const pad = (n: number) => n.toString().padStart(2, '0');
      setCountdown(hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [examEndTime, isRTL]);

  useEffect(() => {
    fetchProgress();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('exam-live-progress')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'exam_live_progress',
      }, () => {
        fetchProgress();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [quizId, groupId]);

  const getName = (s?: StudentInfo) => {
    if (!s) return '—';
    return language === 'ar' ? s.full_name_ar || s.full_name : s.full_name;
  };

  const getTimeSinceActivity = (lastActivity: string) => {
    if (!lastActivity) return '';
    const diff = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 1000);
    if (diff < 60) return isRTL ? `${diff} ث` : `${diff}s`;
    if (diff < 3600) return isRTL ? `${Math.floor(diff / 60)} د` : `${Math.floor(diff / 60)}m`;
    return isRTL ? `${Math.floor(diff / 3600)} س` : `${Math.floor(diff / 3600)}h`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1"><Activity className="h-3 w-3" />{isRTL ? 'يحل الآن' : 'In Progress'}</Badge>;
      case 'submitted':
        return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 gap-1"><CheckCircle2 className="h-3 w-3" />{isRTL ? 'سلّم' : 'Submitted'}</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />{isRTL ? 'لم يبدأ' : 'Not Started'}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!progressList.length) return null;

  const inProgress = progressList.filter(p => p.status === 'in_progress').length;
  const submitted = progressList.filter(p => p.status === 'submitted').length;
  const notStarted = progressList.filter(p => p.status === 'not_started').length;

  return (
    <Card className="border-2 border-blue-400/30 dark:border-blue-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg bg-blue-500/10">
            <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          {isRTL ? 'مراقبة مباشرة للامتحان' : 'Live Exam Monitor'}
          <div className="flex items-center gap-1.5 ms-auto">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-xs text-muted-foreground font-normal">
              {isRTL ? 'مباشر' : 'LIVE'}
            </span>
          </div>
        </CardTitle>
        {/* Countdown timer */}
        {examEndTime && countdown && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-sm font-bold tabular-nums ${
            examEndTime - Date.now() <= 5 * 60 * 1000
              ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 animate-pulse'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
          }`}>
            <Clock className="h-4 w-4" />
            {isRTL ? `متبقي: ${countdown}` : `Remaining: ${countdown}`}
          </div>
        )}
        {/* Summary stats */}
        <div className="flex gap-4 text-sm">
          <span className="text-blue-600 dark:text-blue-400 font-medium">{isRTL ? `${inProgress} يحل` : `${inProgress} active`}</span>
          <span className="text-green-600 dark:text-green-400 font-medium">{isRTL ? `${submitted} سلّم` : `${submitted} submitted`}</span>
          <span className="text-muted-foreground">{isRTL ? `${notStarted} لم يبدأ` : `${notStarted} waiting`}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {progressList
          .sort((a, b) => {
            const order = { in_progress: 0, not_started: 1, submitted: 2 };
            return (order[a.status as keyof typeof order] ?? 1) - (order[b.status as keyof typeof order] ?? 1);
          })
          .map((p) => (
          <div
            key={p.quiz_assignment_id}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
              p.status === 'in_progress' ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' :
              p.status === 'submitted' ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800' :
              'bg-muted/30 border-border'
            }`}
          >
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarImage src={p.student?.avatar_url || undefined} />
              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                {getName(p.student)?.charAt(0) || <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">{getName(p.student)}</span>
                {getStatusBadge(p.status)}
              </div>

              {p.status === 'in_progress' && p.total_questions > 0 && (
                <div className="flex items-center gap-2">
                  <Progress value={(p.answered_count / p.total_questions) * 100} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                    {p.answered_count}/{p.total_questions}
                  </span>
                  {p.last_activity_at && (
                    <span className="text-[10px] text-muted-foreground/60">
                      {getTimeSinceActivity(p.last_activity_at)}
                    </span>
                  )}
                </div>
              )}

              {p.status === 'submitted' && p.total_questions > 0 && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  {isRTL ? `أجاب على ${p.answered_count} من ${p.total_questions}` : `Answered ${p.answered_count}/${p.total_questions}`}
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
