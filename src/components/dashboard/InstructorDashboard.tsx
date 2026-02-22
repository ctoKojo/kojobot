import { useEffect, useState } from 'react';
import { Calendar, GraduationCap, Clock, Users, ClipboardList, FileQuestion, BarChart3, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { formatTime12Hour } from '@/lib/timeUtils';

interface InstructorWarning {
  id: string;
  session_id: string;
  warning_type: string;
  reason: string;
  reason_ar: string;
  created_at: string;
  sessions?: {
    session_number: number;
    groups?: {
      name: string;
      name_ar: string;
    };
  };
}

interface InstructorStats {
  groupCount: number;
  studentCount: number;
  upcomingSessions: any[];
  pendingAssignments: number;
  pendingSubmissions: number;
  activeWarnings: InstructorWarning[];
}

export function InstructorDashboard() {
  const { user } = useAuth();
  const { isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState<InstructorStats>({
    groupCount: 0,
    studentCount: 0,
    upcomingSessions: [],
    pendingAssignments: 0,
    pendingSubmissions: 0,
    activeWarnings: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      // Get instructor's groups
      const { data: groups } = await supabase
        .from('groups')
        .select('id, name, name_ar')
        .eq('instructor_id', user?.id)
        .eq('is_active', true);

      const groupIds = groups?.map(g => g.id) || [];

      // Get student count
      let studentCount = 0;
      if (groupIds.length > 0) {
        const { count } = await supabase
          .from('group_students')
          .select('id', { count: 'exact' })
          .in('group_id', groupIds)
          .eq('is_active', true);
        studentCount = count || 0;
      }

      // Get today and tomorrow's sessions only
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const todayStr = today.toISOString().split('T')[0];
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      let upcomingSessions: any[] = [];
      if (groupIds.length > 0) {
        const { data } = await supabase
          .from('sessions')
          .select('*, groups(name, name_ar)')
          .in('group_id', groupIds)
          .in('session_date', [todayStr, tomorrowStr])
          .eq('status', 'scheduled')
          .order('session_date')
          .order('session_time');
        upcomingSessions = data || [];
      }

      // Get pending submissions (assignments waiting to be graded)
      const { count: pendingCount } = await supabase
        .from('assignment_submissions')
        .select('id', { count: 'exact' })
        .eq('status', 'submitted');

      // Get instructor's assignment IDs and count pending submissions
      const { data: instructorAssignments } = await supabase
        .from('assignments')
        .select('id')
        .eq('assigned_by', user?.id);
      
      let pendingSubmissionsCount = 0;
      if (instructorAssignments && instructorAssignments.length > 0) {
        const assignmentIds = instructorAssignments.map(a => a.id);
        const { count: submissionsCount } = await supabase
          .from('assignment_submissions')
          .select('id', { count: 'exact' })
          .in('assignment_id', assignmentIds)
          .eq('status', 'submitted');
        pendingSubmissionsCount = submissionsCount || 0;
      }

      // Get active warnings for this instructor
      const { data: warnings } = await supabase
        .from('instructor_warnings')
        .select(`
          id, session_id, warning_type, reason, reason_ar, created_at,
          sessions(session_number, groups(name, name_ar))
        `)
        .eq('instructor_id', user?.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

      setStats({
        groupCount: groups?.length || 0,
        studentCount,
        upcomingSessions,
        pendingAssignments: pendingCount || 0,
        pendingSubmissions: pendingSubmissionsCount,
        activeWarnings: (warnings || []) as unknown as InstructorWarning[],
      });
    } catch (error) {
      console.error('Error fetching instructor stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Warnings Alert */}
      {stats.activeWarnings.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              {isRTL ? 'إنذارات نشطة' : 'Active Warnings'}
              <Badge variant="destructive">{stats.activeWarnings.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.activeWarnings.slice(0, 3).map((warning) => (
                <div 
                  key={warning.id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-sm"
                >
                  <span className="text-red-800 dark:text-red-300">
                    {language === 'ar' ? warning.reason_ar : warning.reason}
                  </span>
                  <Badge variant="outline" className="border-red-300 text-red-700 dark:border-red-700 dark:text-red-400">
                    {warning.warning_type === 'no_quiz' && (isRTL ? 'كويز' : 'Quiz')}
                    {warning.warning_type === 'no_assignment' && (isRTL ? 'واجب' : 'Assignment')}
                    {warning.warning_type === 'no_attendance' && (isRTL ? 'حضور' : 'Attendance')}
                  </Badge>
                </div>
              ))}
              {stats.activeWarnings.length > 3 && (
                <p className="text-xs text-red-600 dark:text-red-400 text-center">
                  {isRTL 
                    ? `+${stats.activeWarnings.length - 3} إنذارات أخرى` 
                    : `+${stats.activeWarnings.length - 3} more warnings`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/groups')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              {isRTL ? 'مجموعاتي' : 'My Groups'}
            </CardTitle>
            <div className="p-1.5 sm:p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold">{loading ? '...' : stats.groupCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              {isRTL ? 'إجمالي الطلاب' : 'Total Students'}
            </CardTitle>
            <div className="p-1.5 sm:p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold">{loading ? '...' : stats.studentCount}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/sessions')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-2">
              {isRTL ? 'السيشنات القادمة' : 'Upcoming'}
            </CardTitle>
            <div className="p-1.5 sm:p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold">{loading ? '...' : stats.upcomingSessions.length}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/assignments')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-2">
              {isRTL ? 'تسليمات بانتظار' : 'Pending Submissions'}
            </CardTitle>
            <div className="p-1.5 sm:p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold">{loading ? '...' : stats.pendingSubmissions}</div>
          </CardContent>
        </Card>
      </div>


      {/* Today & Tomorrow Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {isRTL ? 'سيشنات اليوم وبكرة' : "Today & Tomorrow's Sessions"}
          </CardTitle>
          <CardDescription>
            {isRTL ? 'السيشنات المجدولة لليوم والغد' : 'Sessions scheduled for today and tomorrow'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : stats.upcomingSessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              {isRTL ? 'لا توجد سيشنات قادمة' : 'No upcoming sessions'}
            </p>
          ) : (
            <div className="space-y-3">
              {stats.upcomingSessions.map((session: any) => {
                const today = new Date().toISOString().split('T')[0];
                const isToday = session.session_date === today;
                
                return (
                  <div 
                    key={session.id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/session/${session.id}`)}
                  >
                    <div>
                      <p className="font-medium">
                        {language === 'ar' ? session.groups?.name_ar : session.groups?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? `سيشن ${session.session_number || '-'}` : `Session ${session.session_number || '-'}`}
                        {session.topic && ` - ${language === 'ar' && session.topic_ar ? session.topic_ar : session.topic}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={isToday ? 'default' : 'outline'} className={isToday ? 'kojo-gradient' : ''}>
                        {isToday ? (isRTL ? 'اليوم' : 'Today') : (isRTL ? 'بكرة' : 'Tomorrow')}
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1">{formatTime12Hour(session.session_time, isRTL)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/attendance')}>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              {isRTL ? 'تسجيل الحضور' : 'Record Attendance'}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {isRTL ? 'سجل حضور وغياب الطلاب' : 'Mark student attendance'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow sm:col-span-2 md:col-span-1" onClick={() => navigate('/my-instructor-quizzes')}>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileQuestion className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
              {isRTL ? 'إسناد الكويزات' : 'Quiz Assignments'}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {isRTL ? 'أسند كويزات وتابع نتائج الطلاب' : 'Assign quizzes and track student results'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
