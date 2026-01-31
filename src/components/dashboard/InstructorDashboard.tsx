import { useEffect, useState } from 'react';
import { Calendar, GraduationCap, Clock, Users, ClipboardList, FileQuestion, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { formatTime12Hour } from '@/lib/timeUtils';

interface InstructorStats {
  groupCount: number;
  studentCount: number;
  upcomingSessions: any[];
  pendingAssignments: number;
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

      // Get upcoming sessions
      const today = new Date().toISOString().split('T')[0];
      let upcomingSessions: any[] = [];
      if (groupIds.length > 0) {
        const { data } = await supabase
          .from('sessions')
          .select('*, groups(name, name_ar)')
          .in('group_id', groupIds)
          .gte('session_date', today)
          .eq('status', 'scheduled')
          .order('session_date')
          .limit(5);
        upcomingSessions = data || [];
      }

      // Get pending assignments
      const { count: pendingCount } = await supabase
        .from('assignment_submissions')
        .select('id', { count: 'exact' })
        .eq('status', 'submitted');

      setStats({
        groupCount: groups?.length || 0,
        studentCount,
        upcomingSessions,
        pendingAssignments: pendingCount || 0,
      });
    } catch (error) {
      console.error('Error fetching instructor stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/groups')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isRTL ? 'مجموعاتي' : 'My Groups'}
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-100">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? '...' : stats.groupCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isRTL ? 'إجمالي الطلاب' : 'Total Students'}
            </CardTitle>
            <div className="p-2 rounded-lg bg-green-100">
              <GraduationCap className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? '...' : stats.studentCount}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/sessions')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isRTL ? 'السيشنات القادمة' : 'Upcoming Sessions'}
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-100">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? '...' : stats.upcomingSessions.length}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/assignments')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isRTL ? 'تسليمات بانتظار التقييم' : 'Pending Submissions'}
            </CardTitle>
            <div className="p-2 rounded-lg bg-orange-100">
              <ClipboardList className="h-5 w-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? '...' : stats.pendingAssignments}</div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {isRTL ? 'السيشنات القادمة' : 'Upcoming Sessions'}
          </CardTitle>
          <CardDescription>
            {isRTL ? 'جدول السيشنات القادمة' : 'Your upcoming session schedule'}
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
              {stats.upcomingSessions.map((session: any) => (
                <div 
                  key={session.id} 
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/attendance?session=${session.id}&group=${session.group_id}`)}
                >
                  <div>
                    <p className="font-medium">
                      {language === 'ar' ? session.groups?.name_ar : session.groups?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {session.topic_ar && language === 'ar' ? session.topic_ar : session.topic || '-'}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{session.session_date}</Badge>
                    <p className="text-sm text-muted-foreground mt-1">{formatTime12Hour(session.session_time, isRTL)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/attendance')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {isRTL ? 'تسجيل الحضور' : 'Record Attendance'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'سجل حضور وغياب الطلاب' : 'Mark student attendance'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/quizzes')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileQuestion className="h-5 w-5 text-secondary" />
              {isRTL ? 'إسناد كويز' : 'Assign Quiz'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'اختر كويز وأسنده لمجموعة' : 'Select and assign a quiz to a group'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/assignments')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-green-600" />
              {isRTL ? 'إنشاء اساينمنت' : 'Create Assignment'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'أضف اساينمنت جديد لطلابك' : 'Add a new assignment for your students'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
