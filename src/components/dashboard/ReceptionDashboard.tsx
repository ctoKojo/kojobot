import { useState, useEffect } from 'react';
import { getCairoToday } from '@/lib/timeUtils';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, Clock, AlertTriangle, CreditCard, RefreshCw, Target, ChevronRight, ArrowRight, Award, Loader2, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface DashboardStats {
  activeStudents: number;
  activeGroups: number;
  todaySessions: number;
  unrecordedAttendance: number;
  overduePayments: number;
  pendingMakeups: number;
  awaitingFinalExam: number;
  unprintedCertificates: number;
  generatingCertificates: number;
  pendingParentApprovals: number;
}

export function ReceptionDashboard() {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    activeStudents: 0,
    activeGroups: 0,
    todaySessions: 0,
    unrecordedAttendance: 0,
    overduePayments: 0,
    pendingMakeups: 0,
    awaitingFinalExam: 0,
    unprintedCertificates: 0,
    generatingCertificates: 0,
    pendingParentApprovals: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const today = getCairoToday();

      const [studentsRes, groupsRes, sessionsRes, attendanceRes, subsRes, makeupRes, awaitingExamRes, certsRes, generatingCertsRes] = await Promise.all([
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('groups').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('sessions').select('id, group_id').eq('session_date', today).eq('status', 'scheduled'),
        supabase.from('attendance').select('session_id').in('session_id',
          (await supabase.from('sessions').select('id').eq('session_date', today).eq('status', 'scheduled')).data?.map(s => s.id) || []
        ),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true })
          .eq('status', 'active')
          .lt('next_payment_date', today)
          .gt('remaining_amount', 0),
        supabase.from('makeup_sessions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('group_student_progress').select('id', { count: 'exact', head: true }).eq('status', 'awaiting_exam'),
        supabase.from('student_certificates').select('id', { count: 'exact', head: true }).eq('status', 'ready').is('printed_at', null),
        supabase.from('student_certificates').select('id', { count: 'exact', head: true }).in('status', ['pending', 'generating', 'failed']),
      ]);

      // Calculate unrecorded attendance
      const todaySessionIds = sessionsRes.data?.map(s => s.id) || [];
      const recordedSessionIds = new Set(attendanceRes.data?.map(a => a.session_id) || []);
      const unrecorded = todaySessionIds.filter(id => !recordedSessionIds.has(id)).length;

      // Pending parent account approvals
      const { data: parentRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'parent');
      const parentIds = (parentRoles || []).map(r => r.user_id);
      let pendingParentApprovals = 0;
      if (parentIds.length > 0) {
        const { count } = await supabase
          .from('profiles')
          .select('user_id', { count: 'exact', head: true })
          .in('user_id', parentIds)
          .eq('is_approved', false);
        pendingParentApprovals = count || 0;
      }

      setStats({
        activeStudents: studentsRes.count || 0,
        activeGroups: groupsRes.count || 0,
        todaySessions: sessionsRes.data?.length || 0,
        unrecordedAttendance: unrecorded,
        overduePayments: subsRes.count || 0,
        pendingMakeups: makeupRes.count || 0,
        awaitingFinalExam: awaitingExamRes.count || 0,
        unprintedCertificates: certsRes.count || 0,
        generatingCertificates: generatingCertsRes.count || 0,
        pendingParentApprovals,
      });
    } catch (error) {
      console.error('Error fetching reception stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: isRTL ? 'الطلاب النشطين' : 'Active Students',
      value: stats.activeStudents,
      icon: Users,
      gradient: 'from-blue-500 to-blue-600',
      onClick: () => navigate('/students'),
    },
    {
      title: isRTL ? 'المجموعات النشطة' : 'Active Groups',
      value: stats.activeGroups,
      icon: Calendar,
      gradient: 'from-emerald-500 to-emerald-600',
      onClick: () => navigate('/groups'),
    },
    {
      title: isRTL ? 'جلسات اليوم' : "Today's Sessions",
      value: stats.todaySessions,
      icon: Clock,
      gradient: 'from-purple-500 to-purple-600',
      onClick: () => navigate('/sessions'),
    },
  ];

  const alerts = [
    stats.pendingParentApprovals > 0 && {
      icon: UserPlus,
      title: isRTL ? 'طلبات تأكيد حسابات أولياء الأمور' : 'Parent Account Approval Requests',
      description: isRTL
        ? `${stats.pendingParentApprovals} ولي أمر بانتظار الموافقة على حسابه`
        : `${stats.pendingParentApprovals} parent(s) awaiting account approval`,
      count: stats.pendingParentApprovals,
      variant: 'destructive' as const,
      onClick: () => navigate('/parents'),
    },
    stats.unrecordedAttendance > 0 && {
      icon: AlertTriangle,
      title: isRTL ? 'حضور غير مسجل' : 'Unrecorded Attendance',
      description: isRTL
        ? `${stats.unrecordedAttendance} جلسة بدون تسجيل حضور`
        : `${stats.unrecordedAttendance} sessions without recorded attendance`,
      count: stats.unrecordedAttendance,
      variant: 'destructive' as const,
      onClick: () => navigate('/sessions'),
    },
    stats.overduePayments > 0 && {
      icon: CreditCard,
      title: isRTL ? 'مدفوعات متأخرة' : 'Overdue Payments',
      description: isRTL
        ? `${stats.overduePayments} طالب متأخر في الدفع`
        : `${stats.overduePayments} students with overdue payments`,
      count: stats.overduePayments,
      variant: 'destructive' as const,
      onClick: () => navigate('/finance'),
    },
    stats.pendingMakeups > 0 && {
      icon: RefreshCw,
      title: isRTL ? 'تعويضات معلقة' : 'Pending Makeups',
      description: isRTL
        ? `${stats.pendingMakeups} سيشن تعويضية تحتاج جدولة`
        : `${stats.pendingMakeups} makeup sessions need scheduling`,
      count: stats.pendingMakeups,
      variant: 'default' as const,
      onClick: () => navigate('/makeup-sessions'),
    },
    stats.awaitingFinalExam > 0 && {
      icon: Target,
      title: isRTL ? 'جاهزون للامتحان النهائي' : 'Awaiting Final Exam',
      description: isRTL
        ? `${stats.awaitingFinalExam} طالب ينتظر جدولة الامتحان النهائي`
        : `${stats.awaitingFinalExam} students await final exam scheduling`,
      count: stats.awaitingFinalExam,
      variant: 'secondary' as const,
      onClick: () => navigate('/final-exams'),
    },
    stats.unprintedCertificates > 0 && {
      icon: Award,
      title: isRTL ? 'شهادات جاهزة للطباعة' : 'Certificates Ready to Print',
      description: isRTL
        ? `${stats.unprintedCertificates} شهادة جاهزة — افتح الطابور للطباعة`
        : `${stats.unprintedCertificates} certificates ready — open queue to print`,
      count: stats.unprintedCertificates,
      variant: 'default' as const,
      onClick: () => navigate('/certificates-queue'),
    },
    stats.generatingCertificates > 0 && {
      icon: Loader2,
      title: isRTL ? 'شهادات قيد التوليد' : 'Certificates Generating',
      description: isRTL
        ? `${stats.generatingCertificates} شهادة قيد المعالجة التلقائية`
        : `${stats.generatingCertificates} certificates being processed automatically`,
      count: stats.generatingCertificates,
      variant: 'secondary' as const,
      onClick: () => navigate('/certificates-queue'),
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
      <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-3">
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
                      : alert.variant === 'secondary'
                      ? 'bg-secondary/10 text-secondary'
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
    </div>
  );
}
