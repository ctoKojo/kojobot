import { useEffect, useState } from 'react';
import { Users, GraduationCap, Calendar, Bell, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';

interface DashboardStats {
  totalStudents: number;
  totalInstructors: number;
  totalGroups: number;
  activeSubscriptions: number;
  expiringSubscriptions: number;
}

export default function Dashboard() {
  const { user, role } = useAuth();
  const { t, isRTL } = useLanguage();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalInstructors: 0,
    totalGroups: 0,
    activeSubscriptions: 0,
    expiringSubscriptions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [role]);

  const fetchStats = async () => {
    try {
      if (role === 'admin') {
        // Fetch counts for admin
        const [studentsRes, instructorsRes, groupsRes, subscriptionsRes] = await Promise.all([
          supabase.from('user_roles').select('id', { count: 'exact' }).eq('role', 'student'),
          supabase.from('user_roles').select('id', { count: 'exact' }).eq('role', 'instructor'),
          supabase.from('groups').select('id', { count: 'exact' }).eq('is_active', true),
          supabase.from('subscriptions').select('id', { count: 'exact' }).eq('status', 'active'),
        ]);

        setStats({
          totalStudents: studentsRes.count || 0,
          totalInstructors: instructorsRes.count || 0,
          totalGroups: groupsRes.count || 0,
          activeSubscriptions: subscriptionsRes.count || 0,
          expiringSubscriptions: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const adminStats = [
    {
      title: t.dashboard.totalStudents,
      value: stats.totalStudents,
      icon: GraduationCap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: t.dashboard.totalInstructors,
      value: stats.totalInstructors,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: t.dashboard.totalGroups,
      value: stats.totalGroups,
      icon: Calendar,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: t.dashboard.activeSubscriptions,
      value: stats.activeSubscriptions,
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  const getRoleLabel = () => {
    switch (role) {
      case 'admin': return t.roles.admin;
      case 'instructor': return t.roles.instructor;
      case 'student': return t.roles.student;
      default: return 'User';
    }
  };

  const getWelcomeMessage = () => {
    const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
    return `${t.dashboard.welcome}, ${name}! 👋`;
  };

  const getSubtitle = () => {
    if (isRTL) {
      switch (role) {
        case 'admin': return 'إدارة منصتك التعليمية';
        case 'instructor': return 'تابع مجموعاتك وطلابك';
        case 'student': return 'شاهد دوراتك ومهامك';
        default: return '';
      }
    }
    switch (role) {
      case 'admin': return 'Manage your educational platform';
      case 'instructor': return 'Track your groups and students';
      case 'student': return 'View your courses and assignments';
      default: return '';
    }
  };

  return (
    <DashboardLayout title={t.nav.dashboard}>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-bold">{getWelcomeMessage()}</h1>
          <p className="text-muted-foreground mt-1">{getSubtitle()}</p>
        </div>

        {/* Stats Grid - Admin Only */}
        {role === 'admin' && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {adminStats.map((stat) => (
              <Card key={stat.title} className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {loading ? '...' : stat.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Expiring Subscriptions Alert - Admin Only */}
        {role === 'admin' && stats.expiringSubscriptions > 0 && (
          <Card className="border-warning bg-warning/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-5 w-5" />
                {isRTL ? 'اشتراكات قاربت على الانتهاء' : 'Expiring Subscriptions'}
              </CardTitle>
              <CardDescription>
                {isRTL 
                  ? `يوجد ${stats.expiringSubscriptions} اشتراك سينتهي خلال الأسبوع القادم`
                  : `${stats.expiringSubscriptions} subscriptions will expire within the next week`
                }
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Quick Actions for Instructor */}
        {role === 'instructor' && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  {t.nav.groups}
                </CardTitle>
                <CardDescription>
                  {isRTL ? 'عرض وإدارة مجموعاتك' : 'View and manage your groups'}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-secondary" />
                  {t.nav.attendance}
                </CardTitle>
                <CardDescription>
                  {isRTL ? 'تسجيل حضور الطلاب' : 'Record student attendance'}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Quick Actions for Student */}
        {role === 'student' && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  {t.nav.quizzes}
                </CardTitle>
                <CardDescription>
                  {isRTL ? 'عرض الكويزات المسندة إليك' : 'View your assigned quizzes'}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-secondary" />
                  {t.nav.assignments}
                </CardTitle>
                <CardDescription>
                  {isRTL ? 'تسليم الواجبات' : 'Submit your assignments'}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* No Role Assigned */}
        {!role && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-muted-foreground">
                {isRTL ? 'لم يتم تعيين دور لحسابك بعد' : 'Your account has not been assigned a role yet'}
              </CardTitle>
              <CardDescription>
                {isRTL ? 'يرجى التواصل مع المسؤول للحصول على صلاحيات' : 'Please contact an administrator to get access'}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
