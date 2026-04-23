import { useEffect, useState } from 'react';
import { Users, GraduationCap, Calendar, TrendingUp, AlertTriangle, RefreshCw, DollarSign, Snowflake, ClipboardList, ClipboardCheck, Target, ArrowRight, ChevronRight, Plus, UserPlus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { getCairoToday } from '@/lib/timeUtils';
import { AdminAnalytics } from './AdminAnalytics';
import { ClosureBanner } from '@/components/shared/ClosureBanner';

interface AdminStats {
  totalStudents: number;
  totalInstructors: number;
  totalGroups: number;
  activeSubscriptions: number;
  expiringSubscriptions: number;
  activeWarnings: number;
  pendingMakeupSessions: number;
  overduePayments: number;
  suspendedStudents: number;
  frozenGroups: number;
  pendingSubscriptionRequests: number;
  pendingPlacementTests: number;
  awaitingFinalExam: number;
  pendingParentApprovals: number;
}

export function AdminDashboard() {
  const { user } = useAuth();
  const { t, isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats>({
    totalStudents: 0,
    totalInstructors: 0,
    totalGroups: 0,
    activeSubscriptions: 0,
    expiringSubscriptions: 0,
    activeWarnings: 0,
    pendingMakeupSessions: 0,
    overduePayments: 0,
    suspendedStudents: 0,
    frozenGroups: 0,
    pendingSubscriptionRequests: 0,
    pendingPlacementTests: 0,
    awaitingFinalExam: 0,
    pendingParentApprovals: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [studentsRes, instructorsRes, groupsRes, subscriptionsRes, warningsRes, makeupRes, frozenRes, subRequestsRes, placementRes, awaitingExamRes] = await Promise.all([
        supabase.from('user_roles').select('id', { count: 'exact' }).eq('role', 'student'),
        supabase.from('user_roles').select('user_id').eq('role', 'instructor'),
        supabase.from('groups').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('subscriptions').select('id', { count: 'exact' }).eq('status', 'active'),
        supabase.from('instructor_warnings').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('makeup_sessions').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('groups').select('id', { count: 'exact' }).eq('is_active', true).eq('status', 'frozen'),
        supabase.from('subscription_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('placement_v2_attempts' as any).select('id', { count: 'exact' }).eq('status', 'submitted').eq('needs_manual_review', true),
        supabase.from('group_student_progress').select('id', { count: 'exact' }).eq('status', 'awaiting_exam'),
      ]);

      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      const { count: expiringCount } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact' })
        .eq('status', 'active')
        .lte('end_date', weekFromNow.toISOString().split('T')[0]);

      const { count: suspendedCount } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact' })
        .eq('status', 'active')
        .eq('is_suspended', true);

      const today = getCairoToday();
      const { count: overdueCount } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact' })
        .eq('status', 'active')
        .lt('next_payment_date', today)
        .gt('remaining_amount', 0);

      const instructorIds = (instructorsRes.data || []).map(r => r.user_id);
      let activeInstructorCount = 0;
      if (instructorIds.length > 0) {
        const { count } = await supabase
          .from('profiles')
          .select('user_id', { count: 'exact', head: true })
          .in('user_id', instructorIds)
          .neq('employment_status', 'terminated');
        activeInstructorCount = count || 0;
      }

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
        totalStudents: studentsRes.count || 0,
        totalInstructors: activeInstructorCount,
        totalGroups: groupsRes.count || 0,
        activeSubscriptions: subscriptionsRes.count || 0,
        expiringSubscriptions: expiringCount || 0,
        activeWarnings: warningsRes.count || 0,
        pendingMakeupSessions: makeupRes.count || 0,
        overduePayments: overdueCount || 0,
        suspendedStudents: suspendedCount || 0,
        frozenGroups: frozenRes.count || 0,
        pendingSubscriptionRequests: subRequestsRes.count || 0,
        pendingPlacementTests: placementRes.count || 0,
        awaitingFinalExam: awaitingExamRes.count || 0,
        pendingParentApprovals,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: t.dashboard.totalStudents,
      value: stats.totalStudents,
      icon: GraduationCap,
      gradient: 'from-blue-500 to-blue-600',
      onClick: () => navigate('/students'),
    },
    {
      title: t.dashboard.totalInstructors,
      value: stats.totalInstructors,
      icon: Users,
      gradient: 'from-purple-500 to-purple-600',
      onClick: () => navigate('/instructors'),
    },
    {
      title: t.dashboard.totalGroups,
      value: stats.totalGroups,
      icon: Calendar,
      gradient: 'from-emerald-500 to-emerald-600',
      onClick: () => navigate('/groups'),
    },
    {
      title: t.dashboard.activeSubscriptions,
      value: stats.activeSubscriptions,
      icon: TrendingUp,
      gradient: 'from-amber-500 to-orange-500',
    },
  ];

  // Build alerts array dynamically
  const alerts = [
    stats.activeWarnings > 0 && {
      icon: AlertTriangle,
      title: isRTL ? 'إنذارات المدربين النشطة' : 'Active Instructor Warnings',
      description: isRTL 
        ? `${stats.activeWarnings} إنذار نشط يتطلب المراجعة`
        : `${stats.activeWarnings} active warnings require review`,
      count: stats.activeWarnings,
      variant: 'destructive' as const,
      onClick: () => navigate('/instructor-warnings'),
    },
    stats.overduePayments > 0 && {
      icon: DollarSign,
      title: isRTL ? 'مدفوعات متأخرة' : 'Overdue Payments',
      description: isRTL 
        ? `${stats.overduePayments} طالب متأخر في الدفع${stats.suspendedStudents > 0 ? ` (${stats.suspendedStudents} موقوف)` : ''}`
        : `${stats.overduePayments} students with overdue payments${stats.suspendedStudents > 0 ? ` (${stats.suspendedStudents} suspended)` : ''}`,
      count: stats.overduePayments,
      variant: 'destructive' as const,
      onClick: () => navigate('/finance'),
    },
    stats.pendingPlacementTests > 0 && {
      icon: ClipboardCheck,
      title: isRTL ? 'امتحانات تحديد مستوى معلقة' : 'Pending Placement Tests',
      description: isRTL 
        ? `${stats.pendingPlacementTests} امتحان في انتظار المراجعة`
        : `${stats.pendingPlacementTests} placement test(s) awaiting review`,
      count: stats.pendingPlacementTests,
      variant: 'default' as const,
      onClick: () => navigate('/placement-test-review'),
    },
    stats.awaitingFinalExam > 0 && {
      icon: Target,
      title: isRTL ? 'طلاب جاهزون للامتحان النهائي' : 'Students Ready for Final Exam',
      description: isRTL 
        ? `${stats.awaitingFinalExam} طالب أكمل السيشنات وينتظر جدولة الامتحان النهائي`
        : `${stats.awaitingFinalExam} student(s) completed sessions and await final exam`,
      count: stats.awaitingFinalExam,
      variant: 'secondary' as const,
      onClick: () => navigate('/final-exams'),
    },
    stats.pendingMakeupSessions > 0 && {
      icon: RefreshCw,
      title: isRTL ? 'سيشنات تعويضية معلقة' : 'Pending Makeup Sessions',
      description: isRTL 
        ? `${stats.pendingMakeupSessions} سيشن تعويضية تحتاج جدولة`
        : `${stats.pendingMakeupSessions} makeup sessions need scheduling`,
      count: stats.pendingMakeupSessions,
      variant: 'outline' as const,
      onClick: () => navigate('/makeup-sessions'),
    },
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
    stats.pendingSubscriptionRequests > 0 && {
      icon: ClipboardList,
      title: isRTL ? 'طلبات اشتراك جديدة' : 'New Subscription Requests',
      description: isRTL 
        ? `${stats.pendingSubscriptionRequests} طلب اشتراك جديد يحتاج مراجعة`
        : `${stats.pendingSubscriptionRequests} new subscription requests need review`,
      count: stats.pendingSubscriptionRequests,
      variant: 'secondary' as const,
      onClick: () => navigate('/subscription-requests'),
    },
    stats.expiringSubscriptions > 0 && {
      icon: AlertTriangle,
      title: isRTL ? 'اشتراكات قاربت على الانتهاء' : 'Expiring Subscriptions',
      description: isRTL 
        ? `${stats.expiringSubscriptions} اشتراك سينتهي خلال الأسبوع القادم`
        : `${stats.expiringSubscriptions} subscriptions expire within the next week`,
      count: stats.expiringSubscriptions,
      variant: 'outline' as const,
      onClick: undefined,
    },
    stats.frozenGroups > 0 && {
      icon: Snowflake,
      title: isRTL ? 'مجموعات مجمدة' : 'Frozen Groups',
      description: isRTL 
        ? `${stats.frozenGroups} مجموعة مجمدة حالياً`
        : `${stats.frozenGroups} groups are currently frozen`,
      count: stats.frozenGroups,
      variant: 'outline' as const,
      onClick: () => navigate('/groups'),
    },
  ].filter(Boolean) as Array<{
    icon: any;
    title: string;
    description: string;
    count: number;
    variant: 'destructive' | 'default' | 'secondary' | 'outline';
    onClick?: () => void;
  }>;

  const quickActions = [
    {
      title: t.students.addStudent,
      subtitle: isRTL ? 'إضافة طالب جديد للنظام' : 'Add a new student',
      icon: GraduationCap,
      gradient: 'from-blue-500/10 to-blue-600/10',
      iconColor: 'text-blue-600 dark:text-blue-400',
      onClick: () => navigate('/students'),
    },
    {
      title: t.instructors.addInstructor,
      subtitle: isRTL ? 'إضافة مدرب جديد' : 'Add a new instructor',
      icon: Users,
      gradient: 'from-purple-500/10 to-purple-600/10',
      iconColor: 'text-purple-600 dark:text-purple-400',
      onClick: () => navigate('/instructors'),
    },
    {
      title: t.groups.addGroup,
      subtitle: isRTL ? 'إنشاء مجموعة جديدة' : 'Create a new group',
      icon: Calendar,
      gradient: 'from-emerald-500/10 to-emerald-600/10',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      onClick: () => navigate('/groups'),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Academy Closure Banner */}
      {user && <ClosureBanner role="admin" userId={user.id} isRTL={isRTL} language={language} />}

      {/* Stats Grid - Gradient Cards */}
      <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className={`relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 ${stat.onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
            onClick={stat.onClick}
          >
            {/* Gradient background accent */}
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

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {isRTL ? 'إجراءات سريعة' : 'Quick Actions'}
        </h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          {quickActions.map((action) => (
            <Button
              key={action.title}
              variant="outline"
              className="h-auto p-4 flex items-center gap-3 justify-start hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              onClick={action.onClick}
            >
              <div className={`p-2 rounded-xl bg-gradient-to-br ${action.gradient} flex-shrink-0`}>
                <action.icon className={`h-5 w-5 ${action.iconColor}`} />
              </div>
              <div className={`text-${isRTL ? 'right' : 'left'} min-w-0`}>
                <p className="font-semibold text-sm flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  {action.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{action.subtitle}</p>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {/* Advanced Analytics */}
      <AdminAnalytics />
    </div>
  );
}
