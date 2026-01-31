import { useEffect, useState } from 'react';
import { Calendar, GraduationCap, Clock, AlertTriangle, ClipboardList, FileQuestion, CheckCircle, Play, BookOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface StudentStats {
  groupInfo: any;
  subscription: any;
  attendanceStats: { present: number; absent: number; total: number };
  warnings: number;
  pendingQuizzes: any[];
  pendingAssignments: any[];
  upcomingSessions: any[];
  profile: any;
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

      // Get student's group
      const { data: groupStudent } = await supabase
        .from('group_students')
        .select('group_id, groups(id, name, name_ar, schedule_day, schedule_time, instructor_id)')
        .eq('student_id', user?.id)
        .eq('is_active', true)
        .single();

      // Get subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('student_id', user?.id)
        .eq('status', 'active')
        .single();

      // Get warnings count
      const { count: warningsCount } = await supabase
        .from('warnings')
        .select('id', { count: 'exact' })
        .eq('student_id', user?.id)
        .eq('is_active', true);

      // Get attendance stats
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', user?.id);

      const present = attendanceData?.filter(a => a.status === 'present' || a.status === 'late').length || 0;
      const absent = attendanceData?.filter(a => a.status === 'absent').length || 0;

      // Get pending quiz assignments
      const { data: quizAssignments } = await supabase
        .from('quiz_assignments')
        .select('*, quizzes(title, title_ar, duration_minutes)')
        .eq('is_active', true)
        .or(`student_id.eq.${user?.id},group_id.eq.${groupStudent?.group_id}`)
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
        .or(`student_id.eq.${user?.id},group_id.eq.${groupStudent?.group_id}`)
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
          .select('*, groups(name, name_ar)')
          .eq('group_id', groupStudent.group_id)
          .gte('session_date', today)
          .eq('status', 'scheduled')
          .order('session_date')
          .limit(3);
        upcomingSessions = data || [];
      }

      setStats({
        groupInfo: groupStudent?.groups,
        subscription,
        attendanceStats: { present, absent, total: present + absent },
        warnings: warningsCount || 0,
        pendingQuizzes,
        pendingAssignments,
        upcomingSessions,
        profile,
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const daysUntil = (date: string) => {
    const diff = new Date(date).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      {stats.profile && (
        <Card className="kojo-gradient text-white">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <GraduationCap className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">
                  {isRTL ? 'مرحباً' : 'Welcome'}, {language === 'ar' ? stats.profile.full_name_ar : stats.profile.full_name}!
                </h2>
                <p className="opacity-90">
                  {stats.profile.levels && (language === 'ar' ? stats.profile.levels.name_ar : stats.profile.levels.name)}
                  {stats.profile.age_groups && ` • ${language === 'ar' ? stats.profile.age_groups.name_ar : stats.profile.age_groups.name}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile Summary */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Group Info */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isRTL ? 'المجموعة' : 'My Group'}
            </CardTitle>
            <Calendar className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {stats.groupInfo ? (
              <>
                <div className="text-lg font-bold">
                  {language === 'ar' ? stats.groupInfo.name_ar : stats.groupInfo.name}
                </div>
                <p className="text-sm text-muted-foreground">
                  {stats.groupInfo.schedule_day} - {stats.groupInfo.schedule_time}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">{isRTL ? 'غير مسجل' : 'Not enrolled'}</p>
            )}
          </CardContent>
        </Card>

        {/* Attendance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isRTL ? 'نسبة الحضور' : 'Attendance Rate'}
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{attendanceRate}%</div>
            <Progress value={attendanceRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {stats.attendanceStats.present} / {stats.attendanceStats.total} {isRTL ? 'سيشن' : 'sessions'}
            </p>
          </CardContent>
        </Card>

        {/* Warnings */}
        <Card className={stats.warnings > 0 ? 'border-warning' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isRTL ? 'الإنذارات' : 'Warnings'}
            </CardTitle>
            <AlertTriangle className={`h-5 w-5 ${stats.warnings > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats.warnings > 0 ? 'text-warning' : ''}`}>
              {loading ? '...' : stats.warnings}
            </div>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isRTL ? 'الاشتراك' : 'Subscription'}
            </CardTitle>
            <GraduationCap className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            {stats.subscription ? (
              <>
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  {isRTL ? 'نشط' : 'Active'}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">
                  {isRTL ? 'ينتهي: ' : 'Expires: '}
                  {formatDate(stats.subscription.end_date)}
                </p>
                {daysUntil(stats.subscription.end_date) <= 7 && (
                  <Badge variant="destructive" className="mt-2">
                    {isRTL ? `متبقي ${daysUntil(stats.subscription.end_date)} يوم` : `${daysUntil(stats.subscription.end_date)} days left`}
                  </Badge>
                )}
              </>
            ) : (
              <Badge variant="destructive">{isRTL ? 'غير مشترك' : 'No subscription'}</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Sessions */}
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
                  <div className="text-right">
                    <Badge variant="outline">{session.session_date}</Badge>
                    <p className="text-sm text-muted-foreground mt-1">{session.session_time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Tasks */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Quizzes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileQuestion className="h-5 w-5 text-primary" />
              {isRTL ? 'كويزات بانتظارك' : 'Pending Quizzes'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.pendingQuizzes.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {isRTL ? 'لا توجد كويزات حالياً' : 'No pending quizzes'}
              </p>
            ) : (
              <div className="space-y-3">
                {stats.pendingQuizzes.map((quiz: any) => (
                  <div key={quiz.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                    <div>
                      <p className="font-medium">
                        {language === 'ar' ? quiz.quizzes?.title_ar : quiz.quizzes?.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {quiz.quizzes?.duration_minutes} {isRTL ? 'دقيقة' : 'min'}
                      </p>
                    </div>
                    <Button size="sm" className="kojo-gradient" onClick={() => navigate(`/quiz/${quiz.id}`)}>
                      <Play className="w-4 h-4 mr-1" />
                      {isRTL ? 'ابدأ' : 'Start'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-secondary" />
              {isRTL ? 'اساينمنتات بانتظارك' : 'Pending Assignments'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.pendingAssignments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {isRTL ? 'لا توجد اساينمنتات حالياً' : 'No pending assignments'}
              </p>
            ) : (
              <div className="space-y-3">
                {stats.pendingAssignments.map((assignment: any) => (
                  <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                    <div>
                      <p className="font-medium">
                        {language === 'ar' ? assignment.title_ar : assignment.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? 'الموعد: ' : 'Due: '}{formatDate(assignment.due_date)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/assignment/${assignment.id}`)}>
                      {isRTL ? 'تسليم' : 'Submit'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/assignments')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              {isRTL ? 'الواجبات' : 'My Assignments'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'عرض جميع الواجبات المطلوبة' : 'View all your assignments'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/attendance')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-secondary" />
              {isRTL ? 'سجل الحضور' : 'Attendance History'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'عرض سجل الحضور والغياب' : 'View your attendance record'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
