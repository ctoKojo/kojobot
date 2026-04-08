import { useEffect, useState } from 'react';
import { Calendar, GraduationCap, Clock, AlertTriangle, ClipboardList, FileQuestion, CheckCircle, Play, BookOpen, Video, ExternalLink, Snowflake, RefreshCw, ClipboardCheck, ChevronRight } from 'lucide-react';
import { LevelPassedBanner } from '@/components/student/LevelPassedBanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { getCairoToday } from '@/lib/timeUtils';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '@/lib/timeUtils';
import { SessionTimeDisplay } from '@/components/shared/SessionTimeDisplay';
import { isSessionActiveCairo } from '@/lib/sessionTimeGuard';
import { ClosureBanner } from '@/components/shared/ClosureBanner';

interface GroupInfo {
  id: string;
  name: string;
  name_ar: string;
  schedule_day: string;
  schedule_time: string;
  instructor_id: string;
  attendance_mode: string | null;
  session_link: string | null;
  status: string;
}

interface StudentStats {
  groupInfo: GroupInfo | null;
  subscription: any;
  attendanceStats: { present: number; absent: number; total: number };
  warnings: number;
  pendingQuizzes: any[];
  pendingAssignments: any[];
  upcomingSessions: any[];
  profile: any;
  levelProgress: { completed: number; total: number } | null;
  makeupCredits: any | null;
  scheduledMakeups: any[];
}

export function StudentDashboard() {
  const { user } = useAuth();
  const { isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState<StudentStats>({
    groupInfo: null,
    subscription: null,
    attendanceStats: { present: 0, absent: 0, total: 0 },
    warnings: 0,
    pendingQuizzes: [],
    pendingAssignments: [],
    upcomingSessions: [],
    profile: null,
    levelProgress: null,
    makeupCredits: null,
    scheduledMakeups: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, age_groups(name, name_ar), levels(name, name_ar)')
        .eq('user_id', user?.id)
        .single();

      // Get student's group - use maybeSingle to avoid 406 when no group exists
      const { data: groupStudentData } = await supabase
        .from('group_students')
        .select('group_id, groups(id, name, name_ar, schedule_day, schedule_time, instructor_id, attendance_mode, session_link, status)')
        .eq('student_id', user?.id)
        .eq('is_active', true)
        .maybeSingle();
      
      const groupStudent = groupStudentData;

      // Get subscription - use maybeSingle to avoid 406 when no subscription exists
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('student_id', user?.id)
        .eq('status', 'active')
        .maybeSingle();

      // Get warnings count from the warnings table
      const { count: warningsCount } = await supabase
        .from('warnings')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', user?.id)
        .eq('is_active', true);

      // Get attendance stats
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', user?.id);

      const present = attendanceData?.filter(a => a.status === 'present' || a.status === 'late').length || 0;
      const absent = attendanceData?.filter(a => a.status === 'absent').length || 0;

      // Build filter for quizzes and assignments based on whether student has a group
      const groupId = groupStudent?.group_id;
      const quizFilter = groupId 
        ? `student_id.eq.${user?.id},group_id.eq.${groupId}`
        : `student_id.eq.${user?.id}`;

      // Get pending quiz assignments
      const { data: quizAssignments } = await supabase
        .from('quiz_assignments')
        .select('*, quizzes(title, title_ar, duration_minutes)')
        .eq('is_active', true)
        .eq('is_auto_generated', false)
        .or(quizFilter)
        .limit(5);

      // Filter out completed quizzes
      const { data: completedQuizzes } = await supabase
        .from('quiz_submissions')
        .select('quiz_assignment_id')
        .eq('student_id', user?.id);

      const completedIds = completedQuizzes?.map(q => q.quiz_assignment_id) || [];
      const pendingQuizzes = quizAssignments?.filter(q => !completedIds.includes(q.id)) || [];

      // Get pending assignments
      const { data: assignments } = await supabase
        .from('assignments')
        .select('*')
        .eq('is_active', true)
        .eq('is_auto_generated', false)
        .or(quizFilter)
        .gte('due_date', new Date().toISOString())
        .limit(5);

      // Filter out submitted assignments
      const { data: submittedAssignments } = await supabase
        .from('assignment_submissions')
        .select('assignment_id')
        .eq('student_id', user?.id);

      const submittedIds = submittedAssignments?.map(s => s.assignment_id) || [];
      const pendingAssignments = assignments?.filter(a => !submittedIds.includes(a.id)) || [];

      // Get upcoming sessions
      const today = getCairoToday();
      let upcomingSessions: any[] = [];
      if (groupStudent?.group_id) {
        const { data } = await supabase
          .from('sessions')
          .select('*, groups(name, name_ar, attendance_mode, session_link)')
          .eq('group_id', groupStudent.group_id)
          .gte('session_date', today)
          .eq('status', 'scheduled')
          .order('session_date')
          .limit(3);
        upcomingSessions = data || [];
      }

      // Fetch level progress from group's last_delivered_content_number
      let levelProgress = null;
      if (groupStudent?.group_id) {
        const { data: groupInfo } = await supabase
          .from('groups')
          .select('last_delivered_content_number, starting_session_number, owed_sessions_count, levels(expected_sessions_count)')
          .eq('id', groupStudent.group_id)
          .single();
        
        if (groupInfo) {
          const delivered = groupInfo.last_delivered_content_number ?? 0;
          const startingNum = groupInfo.starting_session_number ?? 1;
          const total = (groupInfo.levels as any)?.expected_sessions_count ?? 12;
          const completed = Math.max(0, delivered - (startingNum - 1));
          levelProgress = { completed, total };
        }
      }

      // Fetch makeup credits for current level
      let makeupCredits = null;
      if (profile?.level_id) {
        const { data: credits } = await supabase
          .from('student_makeup_credits')
          .select('used_free, total_free_allowed')
          .eq('student_id', user?.id)
          .eq('level_id', profile.level_id)
          .maybeSingle();
        makeupCredits = credits;
      }

      // Fetch scheduled makeup sessions
      const { data: scheduledMakeups } = await supabase
        .from('makeup_sessions')
        .select('*, groups(name, name_ar)')
        .eq('student_id', user?.id)
        .eq('status', 'scheduled')
        .order('scheduled_date');

      setStats({
        groupInfo: groupStudent?.groups,
        subscription,
        attendanceStats: { present, absent, total: present + absent },
        warnings: warningsCount || 0,
        pendingQuizzes,
        pendingAssignments,
        upcomingSessions,
        profile,
        levelProgress,
        makeupCredits,
        scheduledMakeups: scheduledMakeups || [],
      });
    } catch (error) {
      console.error('Error fetching student stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const attendanceRate = stats.attendanceStats.total > 0
    ? Math.round((stats.attendanceStats.present / stats.attendanceStats.total) * 100)
    : 0;

  // SSOT: uses centralized formatDate from timeUtils.ts

  const daysUntil = (date: string) => {
    const diff = new Date(date).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Check for pending placement test
  const [placementTest, setPlacementTest] = useState<any>(null);
  const [placementReviewPending, setPlacementReviewPending] = useState(false);

  useEffect(() => {
    if (user) {
      (supabase.from('placement_v2_student_view' as any)
        .select('id, status')
        .eq('student_id', user.id)
        .in('status', ['in_progress', 'submitted']) as any)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setPlacementTest(data);
            if (data.status === 'submitted') {
              setPlacementReviewPending(true);
            }
          }
        });
    }
  }, [user]);



  return (
    <div className="space-y-6">
      {/* Placement Test Banner — blocks dashboard */}
      {placementTest && placementTest.status === 'in_progress' && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center gap-4">
              <ClipboardCheck className="h-16 w-16 text-primary" />
              <h2 className="text-xl font-bold">
                {isRTL ? 'يجب إجراء امتحان تحديد المستوى أولاً' : 'Placement Test Required'}
              </h2>
              <p className="text-muted-foreground max-w-md">
                {isRTL
                  ? 'لازم تمتحن امتحان تحديد المستوى قبل ما تقدر تستخدم باقي النظام'
                  : 'You must complete the placement test before accessing the rest of the system'}
              </p>
              <Button className="mt-2" size="lg" onClick={() => navigate('/placement-test')}>
                <Play className="h-5 w-5 me-2" />
                {isRTL ? 'أكمل الامتحان' : 'Continue Exam'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {placementReviewPending && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <Clock className="h-8 w-8 text-amber-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-amber-800 dark:text-amber-300">
                  {isRTL ? 'في انتظار مراجعة النتيجة' : 'Awaiting Result Review'}
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {isRTL
                    ? 'تم تسليم الامتحان بنجاح. الإدارة هتراجع النتيجة وتحدد المستوى المناسب.'
                    : 'Test submitted successfully. Administration will review and assign your level.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Only show rest of dashboard if no pending placement test */}
      {(!placementTest || placementTest.status === 'submitted' || placementTest.status === 'reviewed') && (
        <>

      {/* Frozen Group Alert */}
      {stats.groupInfo?.status === 'frozen' && (
        <Card className="border-sky-300 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-800">
          <CardContent className="py-4 sm:py-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center flex-shrink-0">
                <Snowflake className="w-6 h-6 sm:w-8 sm:h-8 text-sky-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-sky-800 dark:text-sky-300">
                  {isRTL ? 'مجموعتك مجمدة حالياً' : 'Your group is currently frozen'}
                </h2>
                <p className="text-sm sm:text-base text-sky-700 dark:text-sky-400">
                  {isRTL 
                    ? 'السيشنات متوقفة مؤقتاً ولن تتمكن من استلام كويزات أو واجبات جديدة. تواصل مع الإدارة لمزيد من المعلومات.'
                    : 'Sessions are paused and you will not receive new quizzes or assignments. Contact administration for more information.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Academy Closure Banner */}
      {user && <ClosureBanner role="student" userId={user.id} isRTL={isRTL} language={language} />}

      {/* Level Passed - Track Selection Banner */}
      {user && <LevelPassedBanner studentId={user.id} onUpgraded={fetchStats} />}

      {/* Welcome Banner */}
      {stats.profile && (
        <Card className="kojo-gradient text-white">
          <CardContent className="py-4 sm:py-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/20 flex-shrink-0 overflow-hidden">
                {stats.profile.avatar_url ? (
                  <img src={stats.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-2xl font-bold truncate">
                  {isRTL ? 'مرحباً' : 'Welcome'}, {language === 'ar' ? stats.profile.full_name_ar : stats.profile.full_name}!
                </h2>
                <p className="opacity-90 text-sm sm:text-base truncate">
                  {stats.profile.levels && (language === 'ar' ? stats.profile.levels.name_ar : stats.profile.levels.name)}
                  {stats.profile.age_groups && ` • ${language === 'ar' ? stats.profile.age_groups.name_ar : stats.profile.age_groups.name}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile Summary - Gradient Cards */}
      <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-4">
        {/* Group Info */}
        <Card className="relative overflow-hidden border-0 shadow-md">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 opacity-[0.08] dark:opacity-[0.15]" />
          <div className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 opacity-[0.12] dark:opacity-[0.2] rounded-full -translate-y-6 ${isRTL ? '-translate-x-6' : 'translate-x-6'}`} />
          <CardHeader className="relative flex flex-row items-center justify-between pb-1 p-4 sm:p-5 sm:pb-1">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative p-4 sm:p-5 pt-2 sm:pt-2">
            {stats.groupInfo ? (
              <>
                <div className="text-sm sm:text-lg font-bold truncate">
                  {language === 'ar' ? stats.groupInfo.name_ar : stats.groupInfo.name}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {stats.groupInfo.schedule_day} - <SessionTimeDisplay sessionDate={getCairoToday()} sessionTime={stats.groupInfo.schedule_time} isRTL={isRTL} />
                </p>
                {stats.groupInfo.attendance_mode === 'online' && stats.groupInfo.session_link && (() => {
                  const hasActiveSession = stats.upcomingSessions.some((s: any) => 
                    isSessionActiveCairo(s.session_date, s.session_time, s.duration_minutes)
                  );
                  if (!hasActiveSession) return null;
                  return (
                    <Button 
                      size="sm" 
                      className="mt-2 w-full bg-green-600 hover:bg-green-700"
                      asChild
                    >
                      <a href={stats.groupInfo.session_link} target="_blank" rel="noopener noreferrer">
                        <Video className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                        {isRTL ? 'انضم للجلسة' : 'Join Session'}
                      </a>
                    </Button>
                  );
                })()}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">{isRTL ? 'غير مسجل' : 'Not enrolled'}</p>
            )}
          </CardContent>
        </Card>

        {/* Attendance */}
        <Card className="relative overflow-hidden border-0 shadow-md">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600 opacity-[0.08] dark:opacity-[0.15]" />
          <div className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 opacity-[0.12] dark:opacity-[0.2] rounded-full -translate-y-6 ${isRTL ? '-translate-x-6' : 'translate-x-6'}`} />
          <CardHeader className="relative flex flex-row items-center justify-between pb-1 p-4 sm:p-5 sm:pb-1">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative p-4 sm:p-5 pt-2 sm:pt-2">
            <div className="text-3xl sm:text-4xl font-bold tracking-tight">{attendanceRate}%</div>
            <Progress value={attendanceRate} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {stats.attendanceStats.present} / {stats.attendanceStats.total} {isRTL ? 'سيشن' : 'sessions'}
            </p>
          </CardContent>
        </Card>

        {/* Warnings */}
        <Card 
          className="relative overflow-hidden border-0 shadow-md cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
          onClick={() => navigate('/my-warnings')}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${stats.warnings > 0 ? 'from-red-500 to-red-600' : 'from-amber-500 to-amber-600'} opacity-[0.08] dark:opacity-[0.15]`} />
          <div className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} w-20 h-20 bg-gradient-to-br ${stats.warnings > 0 ? 'from-red-500 to-red-600' : 'from-amber-500 to-amber-600'} opacity-[0.12] dark:opacity-[0.2] rounded-full -translate-y-6 ${isRTL ? '-translate-x-6' : 'translate-x-6'}`} />
          <CardHeader className="relative flex flex-row items-center justify-between pb-1 p-4 sm:p-5 sm:pb-1">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${stats.warnings > 0 ? 'from-red-500 to-red-600' : 'from-amber-500 to-amber-600'} shadow-sm`}>
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground/50 ${isRTL ? 'rotate-180' : ''}`} />
          </CardHeader>
          <CardContent className="relative p-4 sm:p-5 pt-2 sm:pt-2">
            <div className="text-3xl sm:text-4xl font-bold tracking-tight">
              {loading ? <div className="h-9 w-16 bg-muted animate-pulse rounded" /> : stats.warnings}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {isRTL ? 'الإنذارات' : 'Warnings'}
            </p>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card className="relative overflow-hidden border-0 shadow-md">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-600 opacity-[0.08] dark:opacity-[0.15]" />
          <div className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 opacity-[0.12] dark:opacity-[0.2] rounded-full -translate-y-6 ${isRTL ? '-translate-x-6' : 'translate-x-6'}`} />
          <CardHeader className="relative flex flex-row items-center justify-between pb-1 p-4 sm:p-5 sm:pb-1">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-sm">
              <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative p-4 sm:p-5 pt-2 sm:pt-2">
            {stats.subscription ? (
              <>
                <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
                  {isRTL ? 'نشط' : 'Active'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {isRTL ? 'ينتهي: ' : 'Expires: '}
                  {formatDate(stats.subscription.end_date)}
                </p>
                {daysUntil(stats.subscription.end_date) <= 7 && (
                  <Badge variant="destructive" className="mt-2 text-xs">
                    {isRTL ? `${daysUntil(stats.subscription.end_date)} يوم` : `${daysUntil(stats.subscription.end_date)} days`}
                  </Badge>
                )}
              </>
            ) : (
              <Badge variant="destructive" className="text-xs">{isRTL ? 'غير مشترك' : 'None'}</Badge>
            )}
          </CardContent>
        </Card>
      </div>


      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
        {/* Level Progress */}
        {stats.levelProgress && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-5 w-5 text-primary" />
                {isRTL ? 'تقدم المنهج' : 'Curriculum Progress'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl font-bold">{stats.levelProgress.completed}/{stats.levelProgress.total}</span>
                <span className="text-sm text-muted-foreground">{isRTL ? 'سيشن مكتمل' : 'sessions completed'}</span>
              </div>
              <Progress value={(stats.levelProgress.completed / stats.levelProgress.total) * 100} className="h-3" />
            </CardContent>
          </Card>
        )}

        {/* Makeup Credits */}
        {stats.makeupCredits && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <RefreshCw className="h-5 w-5 text-secondary" />
                {isRTL ? 'رصيد التعويضية' : 'Makeup Credits'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl font-bold">
                  {Math.max(0, stats.makeupCredits.total_free_allowed - stats.makeupCredits.used_free)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {isRTL ? `من ${stats.makeupCredits.total_free_allowed} سيشن مجانية متبقية` : `of ${stats.makeupCredits.total_free_allowed} free sessions remaining`}
                </span>
              </div>
              <Progress value={(stats.makeupCredits.used_free / stats.makeupCredits.total_free_allowed) * 100} className="h-3" />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Scheduled Makeup Sessions */}
      {stats.scheduledMakeups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-secondary" />
              {isRTL ? 'سيشنات تعويضية مجدولة' : 'Scheduled Makeup Sessions'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.scheduledMakeups.map((ms: any) => (
                <div key={ms.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-3 rounded-lg border hover:bg-muted/50 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {language === 'ar' ? ms.groups?.name_ar : ms.groups?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {ms.scheduled_date} • <SessionTimeDisplay sessionDate={ms.scheduled_date} sessionTime={ms.scheduled_time} isRTL={isRTL} />
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-secondary text-secondary">{isRTL ? 'تعويضية' : 'Makeup'}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats.upcomingSessions.length > 0 && stats.groupInfo?.status !== 'frozen' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {isRTL ? 'السيشنات القادمة' : 'Upcoming Sessions'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.upcomingSessions.map((session: any) => (
                <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-3 rounded-lg border hover:bg-muted/50 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {language === 'ar' ? session.groups?.name_ar : session.groups?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {session.topic_ar && language === 'ar' ? session.topic_ar : session.topic || (isRTL ? 'بدون موضوع' : 'No topic')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <Badge variant="outline">{session.session_date}</Badge>
                      <p className="text-sm text-muted-foreground mt-1"><SessionTimeDisplay sessionDate={session.session_date} sessionTime={session.session_time} isRTL={isRTL} /></p>
                    </div>
                    {/* Join Session Button for Online Groups */}
                    {session.groups?.attendance_mode === 'online' && session.groups?.session_link && 
                      isSessionActiveCairo(session.session_date, session.session_time, session.duration_minutes) && (
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700"
                        asChild
                      >
                        <a href={session.groups.session_link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Tasks */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
        {/* Pending Quizzes */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileQuestion className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              {isRTL ? 'كويزات بانتظارك' : 'Pending Quizzes'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {stats.pendingQuizzes.length === 0 ? (
              <p className="text-muted-foreground text-center py-4 text-sm">
                {isRTL ? 'لا توجد كويزات حالياً' : 'No pending quizzes'}
              </p>
            ) : (
              <div className="space-y-3">
                {stats.pendingQuizzes.map((quiz: any) => (
                  <div key={quiz.id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg border hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm sm:text-base truncate">
                        {language === 'ar' ? quiz.quizzes?.title_ar : quiz.quizzes?.title}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {quiz.quizzes?.duration_minutes} {isRTL ? 'دقيقة' : 'min'}
                      </p>
                    </div>
                    <Button size="sm" className="kojo-gradient ml-2 flex-shrink-0" onClick={() => navigate(`/quiz/${quiz.id}`)}>
                      <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      <span className="hidden sm:inline">{isRTL ? 'ابدأ' : 'Start'}</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Assignments */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
              {isRTL ? 'اساينمنتات بانتظارك' : 'Pending Assignments'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {stats.pendingAssignments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4 text-sm">
                {isRTL ? 'لا توجد اساينمنتات حالياً' : 'No pending assignments'}
              </p>
            ) : (
              <div className="space-y-3">
                {stats.pendingAssignments.map((assignment: any) => (
                  <div key={assignment.id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg border hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm sm:text-base truncate">
                        {language === 'ar' ? assignment.title_ar : assignment.title}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {isRTL ? 'الموعد: ' : 'Due: '}{formatDate(assignment.due_date)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="ml-2 flex-shrink-0" onClick={() => navigate(`/assignment/${assignment.id}`)}>
                      <span className="text-xs sm:text-sm">{isRTL ? 'تسليم' : 'Submit'}</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/assignments')}>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              {isRTL ? 'الواجبات' : 'My Assignments'}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {isRTL ? 'عرض جميع الواجبات المطلوبة' : 'View all your assignments'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/attendance')}>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
              {isRTL ? 'سجل الحضور' : 'Attendance History'}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {isRTL ? 'عرض سجل الحضور والغياب' : 'View your attendance record'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
        </>
      )}
    </div>
  );
}
