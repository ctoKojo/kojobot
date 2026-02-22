import { useEffect, useState } from 'react';
import { Calendar, GraduationCap, Clock, AlertTriangle, ClipboardList, FileQuestion, CheckCircle, Play, BookOpen, Video, ExternalLink, Snowflake, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { formatTime12Hour, formatDate } from '@/lib/timeUtils';

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
      const today = new Date().toISOString().split('T')[0];
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

      // Fetch level progress from actual attendance records
      let levelProgress = null;
      if (groupStudent?.group_id) {
        // Get sessions where student was present or late
        const { data: presentAttendance } = await supabase
          .from('attendance')
          .select('session_id, status, compensation_status, sessions!inner(session_number, group_id)')
          .eq('student_id', user?.id)
          .eq('sessions.group_id', groupStudent.group_id)
          .in('status', ['present', 'late']);

        // Get sessions where student was compensated (regardless of original status)
        const { data: compensatedAttendance } = await supabase
          .from('attendance')
          .select('session_id, sessions!inner(session_number, group_id)')
          .eq('student_id', user?.id)
          .eq('sessions.group_id', groupStudent.group_id)
          .eq('compensation_status', 'compensated');

        // Calculate unique session numbers attended
        const attendedSessionNumbers = new Set<number>();
        presentAttendance?.forEach((a: any) => {
          if (a.sessions?.session_number) attendedSessionNumbers.add(a.sessions.session_number);
        });
        compensatedAttendance?.forEach((a: any) => {
          if (a.sessions?.session_number) attendedSessionNumbers.add(a.sessions.session_number);
        });

        if (attendedSessionNumbers.size > 0 || presentAttendance?.length === 0) {
          levelProgress = { completed: attendedSessionNumbers.size, total: 12 };
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

  return (
    <div className="space-y-6">
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
                    ? 'لن تتمكن من استلام كويزات أو واجبات جديدة. تواصل مع الإدارة لمزيد من المعلومات.'
                    : 'You will not receive new quizzes or assignments. Contact administration for more information.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Welcome Banner */}
      {stats.profile && (
        <Card className="kojo-gradient text-white">
          <CardContent className="py-4 sm:py-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8" />
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

      {/* Profile Summary */}
      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        {/* Group Info */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              {isRTL ? 'المجموعة' : 'My Group'}
            </CardTitle>
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            {stats.groupInfo ? (
              <>
                <div className="text-sm sm:text-lg font-bold truncate">
                  {language === 'ar' ? stats.groupInfo.name_ar : stats.groupInfo.name}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {stats.groupInfo.schedule_day} - {formatTime12Hour(stats.groupInfo.schedule_time, isRTL)}
                </p>
                {/* Session Link for Online Groups */}
                {stats.groupInfo.attendance_mode === 'online' && stats.groupInfo.session_link && (
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
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">{isRTL ? 'غير مسجل' : 'Not enrolled'}</p>
            )}
          </CardContent>
        </Card>

        {/* Attendance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              {isRTL ? 'الحضور' : 'Attendance'}
            </CardTitle>
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold">{attendanceRate}%</div>
            <Progress value={attendanceRate} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
              {stats.attendanceStats.present} / {stats.attendanceStats.total} {isRTL ? 'سيشن' : 'sessions'}
            </p>
          </CardContent>
        </Card>

        {/* Warnings */}
        <Card 
          className={`${stats.warnings > 0 ? 'border-warning' : ''} cursor-pointer hover:shadow-lg transition-shadow`}
          onClick={() => navigate('/my-warnings')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              {isRTL ? 'الإنذارات' : 'Warnings'}
            </CardTitle>
            <AlertTriangle className={`h-4 w-4 sm:h-5 sm:w-5 ${stats.warnings > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className={`text-2xl sm:text-3xl font-bold ${stats.warnings > 0 ? 'text-warning' : ''}`}>
              {loading ? '...' : stats.warnings}
            </div>
            {stats.warnings > 0 && (
              <p className="text-xs text-warning mt-1">
                {isRTL ? 'اضغط للتفاصيل' : 'Click for details'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              {isRTL ? 'الاشتراك' : 'Subscription'}
            </CardTitle>
            <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            {stats.subscription ? (
              <>
                <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">
                  {isRTL ? 'نشط' : 'Active'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
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

      {/* Curriculum Progress & Makeup Credits */}
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
                <div key={ms.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {language === 'ar' ? ms.groups?.name_ar : ms.groups?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {ms.scheduled_date} • {formatTime12Hour(ms.scheduled_time, isRTL)}
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

      {stats.upcomingSessions.length > 0 && (
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
                <div key={session.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
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
                      <p className="text-sm text-muted-foreground mt-1">{formatTime12Hour(session.session_time, isRTL)}</p>
                    </div>
                    {/* Join Session Button for Online Groups */}
                    {session.groups?.attendance_mode === 'online' && session.groups?.session_link && (
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
    </div>
  );
}
