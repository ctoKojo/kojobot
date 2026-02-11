import { useEffect, useState } from 'react';
import { Users, GraduationCap, Calendar, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AdminStats {
  totalStudents: number;
  totalInstructors: number;
  totalGroups: number;
  activeSubscriptions: number;
  expiringSubscriptions: number;
  activeWarnings: number;
  pendingMakeupSessions: number;
}

export function AdminDashboard() {
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats>({
    totalStudents: 0,
    totalInstructors: 0,
    totalGroups: 0,
    activeSubscriptions: 0,
    expiringSubscriptions: 0,
    activeWarnings: 0,
    pendingMakeupSessions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [studentsRes, instructorsRes, groupsRes, subscriptionsRes, warningsRes, makeupRes] = await Promise.all([
        supabase.from('user_roles').select('id', { count: 'exact' }).eq('role', 'student'),
        supabase.from('user_roles').select('id', { count: 'exact' }).eq('role', 'instructor'),
        supabase.from('groups').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('subscriptions').select('id', { count: 'exact' }).eq('status', 'active'),
        supabase.from('instructor_warnings').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('makeup_sessions').select('id', { count: 'exact' }).eq('status', 'pending'),
      ]);

      // Check for expiring subscriptions (within 7 days)
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      const { count: expiringCount } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact' })
        .eq('status', 'active')
        .lte('end_date', weekFromNow.toISOString().split('T')[0]);

      setStats({
        totalStudents: studentsRes.count || 0,
        totalInstructors: instructorsRes.count || 0,
        totalGroups: groupsRes.count || 0,
        activeSubscriptions: subscriptionsRes.count || 0,
        expiringSubscriptions: expiringCount || 0,
        activeWarnings: warningsRes.count || 0,
        pendingMakeupSessions: makeupRes.count || 0,
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
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      onClick: () => navigate('/students'),
    },
    {
      title: t.dashboard.totalInstructors,
      value: stats.totalInstructors,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      onClick: () => navigate('/instructors'),
    },
    {
      title: t.dashboard.totalGroups,
      value: stats.totalGroups,
      icon: Calendar,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      onClick: () => navigate('/groups'),
    },
    {
      title: t.dashboard.activeSubscriptions,
      value: stats.activeSubscriptions,
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card 
            key={stat.title} 
            className={`hover:shadow-lg transition-shadow ${stat.onClick ? 'cursor-pointer' : ''}`}
            onClick={stat.onClick}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-2">
                {stat.title}
              </CardTitle>
              <div className={`p-1.5 sm:p-2 rounded-lg ${stat.bgColor} flex-shrink-0`}>
                <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <div className="text-2xl sm:text-3xl font-bold">
                {loading ? '...' : stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Instructor Warnings Alert */}
      {stats.activeWarnings > 0 && (
        <Card 
          className="border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/instructor-warnings')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              {isRTL ? 'إنذارات المدربين النشطة' : 'Active Instructor Warnings'}
            </CardTitle>
            <CardDescription className="text-red-600 dark:text-red-400">
              {isRTL 
                ? `يوجد ${stats.activeWarnings} إنذار نشط يتطلب المراجعة`
                : `${stats.activeWarnings} active warnings require review`
              }
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Pending Makeup Sessions Alert */}
      {stats.pendingMakeupSessions > 0 && (
        <Card 
          className="border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/makeup-sessions')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <RefreshCw className="h-5 w-5" />
              {isRTL ? 'سيشنات تعويضية معلقة' : 'Pending Makeup Sessions'}
            </CardTitle>
            <CardDescription className="text-orange-600 dark:text-orange-400">
              {isRTL 
                ? `يوجد ${stats.pendingMakeupSessions} سيشن تعويضية تحتاج جدولة`
                : `${stats.pendingMakeupSessions} makeup sessions need to be scheduled`
              }
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Expiring Subscriptions Alert */}
      {stats.expiringSubscriptions > 0 && (
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

      {/* Quick Actions */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/students')}>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              {t.students.addStudent}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {isRTL ? 'إضافة طالب جديد للنظام' : 'Add a new student to the system'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/instructors')}>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
              {t.instructors.addInstructor}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {isRTL ? 'إضافة مدرب جديد' : 'Add a new instructor'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow sm:col-span-2 md:col-span-1" onClick={() => navigate('/groups')}>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              {t.groups.addGroup}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {isRTL ? 'إنشاء مجموعة جديدة' : 'Create a new group'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
