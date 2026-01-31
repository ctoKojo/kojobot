import { useEffect, useState } from 'react';
import { Calendar, GraduationCap, Clock, AlertTriangle, ClipboardList, FileQuestion, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      // Get student's group
      const { data: groupStudent } = await supabase
        .from('group_students')
        .select('group_id, groups(id, name, name_ar, schedule_day, schedule_time)')
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

      setStats({
        groupInfo: groupStudent?.groups,
        subscription,
        attendanceStats: { present, absent, total: present + absent },
        warnings: warningsCount || 0,
        pendingQuizzes,
        pendingAssignments,
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

  return (
    <div className="space-y-6">
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
              </>
            ) : (
              <Badge variant="destructive">{isRTL ? 'غير مشترك' : 'No subscription'}</Badge>
            )}
          </CardContent>
        </Card>
      </div>

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
                    {quiz.due_date && (
                      <Badge variant="outline">{formatDate(quiz.due_date)}</Badge>
                    )}
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
                    </div>
                    <Badge variant="outline" className="bg-orange-100 text-orange-800">
                      {formatDate(assignment.due_date)}
                    </Badge>
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
              {isRTL ? 'تسليم الواجبات' : 'Submit Assignments'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'عرض وتسليم الواجبات المطلوبة' : 'View and submit your assignments'}
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
