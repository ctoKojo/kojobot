import { useEffect, useState } from 'react';
import { Calendar, GraduationCap, Clock, Users, ClipboardList, FileQuestion, BarChart3, AlertTriangle, ChevronRight, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { getCairoToday } from '@/lib/timeUtils';
import { SessionTimeDisplay } from '@/components/shared/SessionTimeDisplay';
import { ClosureBanner } from '@/components/shared/ClosureBanner';

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
        .eq('assigned_by', user?.id)
        .eq('is_auto_generated', false);
      
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

  const statCards = [
    {
      title: isRTL ? 'مجموعاتي' : 'My Groups',
      value: stats.groupCount,
      icon: Calendar,
      gradient: 'from-blue-500 to-blue-600',
      onClick: () => navigate('/groups'),
    },
    {
      title: isRTL ? 'إجمالي الطلاب' : 'Total Students',
      value: stats.studentCount,
      icon: GraduationCap,
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      title: isRTL ? 'السيشنات القادمة' : 'Upcoming Sessions',
      value: stats.upcomingSessions.length,
      icon: Clock,
      gradient: 'from-purple-500 to-purple-600',
      onClick: () => navigate('/sessions'),
    },
    {
      title: isRTL ? 'تسليمات بانتظار' : 'Pending Submissions',
      value: stats.pendingSubmissions,
      icon: ClipboardList,
      gradient: 'from-amber-500 to-orange-500',
      onClick: () => navigate('/assignments'),
    },
    {
      title: isRTL ? 'الإنذارات النشطة' : 'Active Warnings',
      value: stats.activeWarnings.length,
      icon: AlertTriangle,
      gradient: stats.activeWarnings.length > 0 ? 'from-red-500 to-red-600' : 'from-slate-400 to-slate-500',
      onClick: () => navigate('/my-instructor-warnings'),
    },
  ];

  // Build alerts
  const alerts = [
    stats.activeWarnings.length > 0 && {
      icon: AlertTriangle,
      title: isRTL ? 'إنذارات نشطة' : 'Active Warnings',
      description: isRTL
        ? `${stats.activeWarnings.length} إنذار نشط يتطلب انتباهك`
        : `${stats.activeWarnings.length} active warnings require your attention`,
      count: stats.activeWarnings.length,
      variant: 'destructive' as const,
      onClick: () => navigate('/my-instructor-warnings'),
    },
    stats.pendingSubmissions > 0 && {
      icon: ClipboardList,
      title: isRTL ? 'تسليمات بانتظار التصحيح' : 'Submissions Awaiting Grading',
      description: isRTL
        ? `${stats.pendingSubmissions} تسليم بانتظار التصحيح`
        : `${stats.pendingSubmissions} submissions waiting to be graded`,
      count: stats.pendingSubmissions,
      variant: 'default' as const,
      onClick: () => navigate('/assignments'),
    },
  ].filter(Boolean) as Array<{
    icon: any;
    title: string;
    description: string;
    count: number;
    variant: 'destructive' | 'default' | 'secondary' | 'outline';
    onClick?: () => void;
  }>;

  return (
    <div className="space-y-8">
      {/* Stats Grid - Gradient Cards */}
      <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className={`relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 ${stat.onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
            onClick={stat.onClick}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-[0.08] dark:opacity-[0.15]`} />
            <div className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} w-20 h-20 bg-gradient-to-br ${stat.gradient} opacity-[0.12] dark:opacity-[0.2] rounded-full -translate-y-6 ${isRTL ? '-translate-x-6' : 'translate-x-6'}`} />
            
            <CardHeader className="relative flex flex-row items-center justify-between pb-1 p-4 sm:p-5 sm:pb-1">
              <div className={`p-2 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-sm`}>
                <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              {stat.onClick && (
                <ChevronRight className={`h-4 w-4 text-muted-foreground/50 ${isRTL ? 'rotate-180' : ''}`} />
              )}
            </CardHeader>
            <CardContent className="relative p-4 sm:p-5 pt-2 sm:pt-2">
              <div className="text-3xl sm:text-4xl font-bold tracking-tight">
                {loading ? (
                  <div className="h-9 w-16 bg-muted animate-pulse rounded" />
                ) : (
                  stat.value
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-1">
                {stat.title}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {isRTL ? 'تنبيهات تحتاج انتباهك' : 'Needs Your Attention'}
          </h2>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
            {alerts.map((alert, index) => (
              <Card
                key={index}
                className={`group transition-all duration-200 hover:shadow-md ${alert.onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''} ${
                  alert.variant === 'destructive' 
                    ? 'border-destructive/30 bg-destructive/5 dark:bg-destructive/10' 
                    : 'border-border'
                }`}
                onClick={alert.onClick}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`flex-shrink-0 p-2.5 rounded-xl ${
                    alert.variant === 'destructive' 
                      ? 'bg-destructive/10 text-destructive' 
                      : 'bg-primary/10 text-primary'
                  }`}>
                    <alert.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-sm truncate">{alert.title}</p>
                      <Badge variant={alert.variant} className="text-xs tabular-nums flex-shrink-0">
                        {alert.count}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{alert.description}</p>
                  </div>
                  {alert.onClick && (
                    <ArrowRight className={`h-4 w-4 text-muted-foreground/40 group-hover:text-foreground/60 transition-colors flex-shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Warning Details */}
      {stats.activeWarnings.length > 0 && (
        <Card className="border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {isRTL ? 'تفاصيل الإنذارات' : 'Warning Details'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.activeWarnings.slice(0, 3).map((warning) => (
                <div 
                  key={warning.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 dark:bg-destructive/10 text-sm"
                >
                  <span className="text-destructive dark:text-red-400">
                    {language === 'ar' ? warning.reason_ar : warning.reason}
                  </span>
                  <Badge variant="outline" className="border-destructive/30 text-destructive">
                    {warning.warning_type === 'no_quiz' && (isRTL ? 'كويز' : 'Quiz')}
                    {warning.warning_type === 'no_assignment' && (isRTL ? 'واجب' : 'Assignment')}
                    {warning.warning_type === 'no_attendance' && (isRTL ? 'حضور' : 'Attendance')}
                  </Badge>
                </div>
              ))}
              {stats.activeWarnings.length > 3 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  {isRTL 
                    ? `+${stats.activeWarnings.length - 3} إنذارات أخرى` 
                    : `+${stats.activeWarnings.length - 3} more warnings`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
            <div className="space-y-2 sm:space-y-3">
              {stats.upcomingSessions.map((session: any) => {
                const today = getCairoToday();
                const isToday = session.session_date === today;
                
                return (
                  <div 
                    key={session.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer gap-2"
                    onClick={() => navigate(`/session/${session.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm sm:text-base truncate">
                        {language === 'ar' ? session.groups?.name_ar : session.groups?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? `سيشن ${session.session_number || '-'}` : `Session ${session.session_number || '-'}`}
                        {session.topic && ` - ${language === 'ar' && session.topic_ar ? session.topic_ar : session.topic}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={isToday ? 'default' : 'outline'} className={isToday ? 'kojo-gradient' : ''}>
                        {isToday ? (isRTL ? 'اليوم' : 'Today') : (isRTL ? 'بكرة' : 'Tomorrow')}
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1"><SessionTimeDisplay sessionDate={session.session_date} sessionTime={session.session_time} isRTL={isRTL} /></p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {isRTL ? 'إجراءات سريعة' : 'Quick Actions'}
        </h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
          <Card 
            className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200" 
            onClick={() => navigate('/my-instructor-warnings')}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/10 to-red-600/10 flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">{isRTL ? 'إنذاراتي' : 'My Warnings'}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'عرض وتتبع الإنذارات الصادرة' : 'View and track issued warnings'}</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200" 
            onClick={() => navigate('/instructor-schedule')}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 flex-shrink-0">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">{isRTL ? 'جدولي' : 'My Schedule'}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'عرض جدول المواعيد والسيشنات' : 'View your schedule and sessions'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
