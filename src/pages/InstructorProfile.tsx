import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Calendar, Clock, Users, BookOpen, 
  FileText, ArrowLeft, Mail, Phone, Award, BarChart3, AlertTriangle, X, DollarSign
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { formatTime12Hour } from '@/lib/timeUtils';
import { InstructorPerformanceCharts } from '@/components/instructor/InstructorPerformanceCharts';

interface AttendanceStats {
  totalRecords: number;
  presentRate: number;
  absentRate: number;
  lateRate: number;
}

interface QuizStats {
  totalSubmissions: number;
  averageScore: number;
  passRate: number;
  submissionsPerQuiz: { quiz_id: string; title: string; title_ar: string; count: number; avgScore: number }[];
}

interface AssignmentStats {
  totalSubmissions: number;
  pendingGrading: number;
  averageScore: number;
  submissionRate: number;
}

interface InstructorWarning {
  id: string;
  session_id: string;
  warning_type: string;
  reason: string;
  reason_ar: string;
  created_at: string;
  is_active: boolean;
}

interface InstructorData {
  profile: any;
  groups: any[];
  upcomingSessions: any[];
  completedSessions: any[];
  quizzes: any[];
  assignments: any[];
  totalStudents: number;
  attendanceStats: AttendanceStats;
  quizStats: QuizStats;
  assignmentStats: AssignmentStats;
  attendanceTrend: { date: string; rate: number }[];
  warnings: InstructorWarning[];
  salaryPayments: any[];
  currentSalary: any | null;
}

export default function InstructorProfile() {
  const { instructorId } = useParams();
  const navigate = useNavigate();
  const { isRTL, language } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InstructorData | null>(null);
  const [dismissingWarningId, setDismissingWarningId] = useState<string | null>(null);

  useEffect(() => {
    if (instructorId) fetchInstructorData();
  }, [instructorId]);

  const fetchInstructorData = async () => {
    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', instructorId)
        .single();

      // Fetch groups
      const { data: groups } = await supabase
        .from('groups')
        .select('*, age_groups(name, name_ar), levels(name, name_ar)')
        .eq('instructor_id', instructorId)
        .eq('is_active', true);

      const groupIds = (groups || []).map(g => g.id);

      // Fetch students count
      const { count: totalStudents } = await supabase
        .from('group_students')
        .select('*', { count: 'exact', head: true })
        .in('group_id', groupIds.length > 0 ? groupIds : ['no-groups'])
        .eq('is_active', true);

      // Fetch upcoming sessions
      const { data: upcomingSessions } = await supabase
        .from('sessions')
        .select('*, groups(name, name_ar)')
        .in('group_id', groupIds.length > 0 ? groupIds : ['no-groups'])
        .gte('session_date', new Date().toISOString().split('T')[0])
        .order('session_date', { ascending: true })
        .limit(10);

      // Fetch completed sessions
      const { data: completedSessions } = await supabase
        .from('sessions')
        .select('*, groups(name, name_ar)')
        .in('group_id', groupIds.length > 0 ? groupIds : ['no-groups'])
        .eq('status', 'completed')
        .order('session_date', { ascending: false })
        .limit(20);

      // Fetch all sessions for attendance
      const { data: allSessions } = await supabase
        .from('sessions')
        .select('id, session_date')
        .in('group_id', groupIds.length > 0 ? groupIds : ['no-groups'])
        .eq('status', 'completed');

      const sessionIds = (allSessions || []).map(s => s.id);

      // Fetch attendance records
      const { data: attendanceRecords } = await supabase
        .from('attendance')
        .select('status, session_id, sessions(session_date)')
        .in('session_id', sessionIds.length > 0 ? sessionIds : ['no-sessions']);

      // Calculate attendance stats
      const totalAttendance = attendanceRecords?.length || 0;
      const presentCount = attendanceRecords?.filter(a => a.status === 'present').length || 0;
      const absentCount = attendanceRecords?.filter(a => a.status === 'absent').length || 0;
      const lateCount = attendanceRecords?.filter(a => a.status === 'late').length || 0;

      const attendanceStats: AttendanceStats = {
        totalRecords: totalAttendance,
        presentRate: totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0,
        absentRate: totalAttendance > 0 ? (absentCount / totalAttendance) * 100 : 0,
        lateRate: totalAttendance > 0 ? (lateCount / totalAttendance) * 100 : 0,
      };

      // Calculate attendance trend by date
      const attendanceByDate = new Map<string, { present: number; total: number }>();
      attendanceRecords?.forEach(record => {
        const date = (record.sessions as any)?.session_date;
        if (date) {
          if (!attendanceByDate.has(date)) {
            attendanceByDate.set(date, { present: 0, total: 0 });
          }
          const entry = attendanceByDate.get(date)!;
          entry.total++;
          if (record.status === 'present' || record.status === 'late') {
            entry.present++;
          }
        }
      });

      const attendanceTrend = Array.from(attendanceByDate.entries())
        .map(([date, data]) => ({
          date,
          rate: data.total > 0 ? (data.present / data.total) * 100 : 0,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-30); // Last 30 days

      // Fetch quizzes created
      const { data: quizzes } = await supabase
        .from('quizzes')
        .select('*')
        .eq('created_by', instructorId)
        .order('created_at', { ascending: false })
        .limit(10);

      const quizIds = (quizzes || []).map(q => q.id);

      // Fetch quiz assignments for these quizzes
      const { data: quizAssignments } = await supabase
        .from('quiz_assignments')
        .select('id, quiz_id, quizzes(title, title_ar, passing_score)')
        .in('quiz_id', quizIds.length > 0 ? quizIds : ['no-quizzes']);

      const assignmentIds = (quizAssignments || []).map(qa => qa.id);

      // Fetch quiz submissions
      const { data: quizSubmissions } = await supabase
        .from('quiz_submissions')
        .select('*, quiz_assignments(quiz_id, quizzes(title, title_ar, passing_score))')
        .in('quiz_assignment_id', assignmentIds.length > 0 ? assignmentIds : ['no-assignments'])
        .eq('status', 'completed');

      // Calculate quiz stats
      const completedSubmissions = quizSubmissions?.filter(s => s.percentage !== null) || [];
      const avgQuizScore = completedSubmissions.length > 0
        ? completedSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / completedSubmissions.length
        : 0;

      const passedCount = completedSubmissions.filter(s => {
        const passingScore = (s.quiz_assignments as any)?.quizzes?.passing_score || 60;
        return (s.percentage || 0) >= passingScore;
      }).length;

      // Group submissions by quiz
      const submissionsByQuiz = new Map<string, { quiz_id: string; title: string; title_ar: string; scores: number[] }>();
      completedSubmissions.forEach(s => {
        const quizId = (s.quiz_assignments as any)?.quiz_id;
        const title = (s.quiz_assignments as any)?.quizzes?.title || 'Unknown';
        const title_ar = (s.quiz_assignments as any)?.quizzes?.title_ar || title;
        if (quizId) {
          if (!submissionsByQuiz.has(quizId)) {
            submissionsByQuiz.set(quizId, { quiz_id: quizId, title, title_ar, scores: [] });
          }
          submissionsByQuiz.get(quizId)!.scores.push(s.percentage || 0);
        }
      });

      const submissionsPerQuiz = Array.from(submissionsByQuiz.values()).map(q => ({
        quiz_id: q.quiz_id,
        title: q.title,
        title_ar: q.title_ar,
        count: q.scores.length,
        avgScore: q.scores.reduce((a, b) => a + b, 0) / q.scores.length,
      }));

      const quizStats: QuizStats = {
        totalSubmissions: completedSubmissions.length,
        averageScore: avgQuizScore,
        passRate: completedSubmissions.length > 0 ? (passedCount / completedSubmissions.length) * 100 : 0,
        submissionsPerQuiz,
      };

      // Fetch assignments created
      const { data: assignments } = await supabase
        .from('assignments')
        .select('*')
        .eq('assigned_by', instructorId)
        .order('created_at', { ascending: false })
        .limit(10);

      const instructorAssignmentIds = (assignments || []).map(a => a.id);

      // Fetch assignment submissions
      const { data: assignmentSubmissions } = await supabase
        .from('assignment_submissions')
        .select('*, assignments(max_score)')
        .in('assignment_id', instructorAssignmentIds.length > 0 ? instructorAssignmentIds : ['no-assignments']);

      // Calculate assignment stats
      const gradedSubmissions = assignmentSubmissions?.filter(s => s.status === 'graded' && s.score !== null) || [];
      const pendingSubmissions = assignmentSubmissions?.filter(s => s.status === 'submitted') || [];
      
      const avgAssignmentScore = gradedSubmissions.length > 0
        ? gradedSubmissions.reduce((sum, s) => {
            const maxScore = (s.assignments as any)?.max_score || 100;
            return sum + ((s.score || 0) / maxScore) * 100;
          }, 0) / gradedSubmissions.length
        : 0;

      // Calculate expected submissions (total students * number of assignments)
      const expectedSubmissions = (totalStudents || 0) * (assignments?.length || 0);

      const assignmentStats: AssignmentStats = {
        totalSubmissions: assignmentSubmissions?.length || 0,
        pendingGrading: pendingSubmissions.length,
        averageScore: avgAssignmentScore,
        submissionRate: expectedSubmissions > 0 
          ? ((assignmentSubmissions?.length || 0) / expectedSubmissions) * 100 
          : 0,
      };

      // Fetch instructor warnings
      const { data: warnings } = await supabase
        .from('instructor_warnings')
        .select('*')
        .eq('instructor_id', instructorId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Fetch salary info
      const { data: currentSalary } = await supabase
        .from('employee_salaries')
        .select('*')
        .eq('employee_id', instructorId)
        .eq('is_active', true)
        .maybeSingle();

      const { data: salaryPayments } = await supabase
        .from('salary_payments')
        .select('*')
        .eq('employee_id', instructorId!)
        .order('month', { ascending: false })
        .limit(50);

      setData({
        profile,
        groups: groups || [],
        upcomingSessions: upcomingSessions || [],
        completedSessions: completedSessions || [],
        quizzes: quizzes || [],
        assignments: assignments || [],
        totalStudents: totalStudents || 0,
        attendanceStats,
        quizStats,
        assignmentStats,
        attendanceTrend,
        warnings: (warnings || []) as InstructorWarning[],
        salaryPayments: salaryPayments || [],
        currentSalary,
      });
    } catch (error) {
      console.error('Error fetching instructor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDismissWarning = async (warningId: string) => {
    setDismissingWarningId(warningId);
    try {
      const { error } = await supabase
        .from('instructor_warnings')
        .update({ is_active: false })
        .eq('id', warningId);

      if (error) throw error;

      toast({
        title: isRTL ? 'تم الإلغاء' : 'Dismissed',
        description: isRTL ? 'تم إلغاء الإنذار بنجاح' : 'Warning dismissed successfully',
      });

      // Refresh data
      fetchInstructorData();
    } catch (error) {
      console.error('Error dismissing warning:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في إلغاء الإنذار' : 'Failed to dismiss warning',
      });
    } finally {
      setDismissingWarningId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'ملف المدرب' : 'Instructor Profile'}>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!data?.profile) {
    return (
      <DashboardLayout title={isRTL ? 'ملف المدرب' : 'Instructor Profile'}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{isRTL ? 'لم يتم العثور على المدرب' : 'Instructor not found'}</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isRTL ? 'رجوع' : 'Go Back'}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={isRTL ? 'ملف المدرب' : 'Instructor Profile'}>
      <div className="space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {isRTL ? 'رجوع' : 'Back'}
        </Button>

        {/* Profile Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <Avatar className="h-24 w-24">
                <AvatarImage src={data.profile.avatar_url} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {data.profile.full_name?.charAt(0) || 'I'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">
                  {language === 'ar' ? data.profile.full_name_ar || data.profile.full_name : data.profile.full_name}
                </h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">
                    {isRTL ? 'مدرب' : 'Instructor'}
                  </Badge>
                  {data.profile.specialization && (
                    <Badge variant="outline">
                      {language === 'ar' ? data.profile.specialization_ar || data.profile.specialization : data.profile.specialization}
                    </Badge>
                  )}
                  <Badge 
                    variant="outline"
                    className={data.profile.employment_status === 'permanent' ? "bg-green-600 text-white border-green-600" : "border-amber-500 text-amber-600"}
                  >
                    {data.profile.employment_status === 'permanent' ? (isRTL ? 'مثبت' : 'Permanent') : (isRTL ? 'تدريب' : 'Training')}
                  </Badge>
                  <Badge 
                    variant="outline"
                    className={data.profile.work_type === 'full_time' ? "border-blue-500 text-blue-600" : "border-purple-500 text-purple-600"}
                  >
                    {data.profile.work_type === 'full_time' ? (isRTL ? 'فول تايم' : 'Full-time') : (isRTL ? 'بارت تايم' : 'Part-time')}
                  </Badge>
                  {data.profile.employment_status === 'training' && data.profile.is_paid_trainee && (
                    <Badge variant="outline" className="border-emerald-500 text-emerald-600">
                      {isRTL ? `متدرب بمقابل (${data.profile.hourly_rate} ج.م/ساعة)` : `Paid Trainee (${data.profile.hourly_rate} EGP/hr)`}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {data.profile.email}
                  </span>
                  {data.profile.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {data.profile.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.groups.length}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'المجموعات' : 'Groups'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.upcomingSessions.length}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'جلسات قادمة' : 'Upcoming Sessions'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.quizzes.length}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'الكويزات' : 'Quizzes'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.assignments.length}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'الواجبات' : 'Assignments'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Warnings Section */}
        {data.warnings.length > 0 && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
                {isRTL ? 'إنذارات نشطة' : 'Active Warnings'}
                <Badge variant="destructive">{data.warnings.length}</Badge>
              </CardTitle>
              <CardDescription className="text-red-600 dark:text-red-400">
                {isRTL ? 'هذه الإنذارات تم إصدارها بسبب عدم الالتزام بمتطلبات السيشنات' : 'These warnings were issued due to non-compliance with session requirements'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.warnings.map((warning) => (
                  <div 
                    key={warning.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-red-100 dark:bg-red-900/30"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-red-800 dark:text-red-300">
                        {language === 'ar' ? warning.reason_ar : warning.reason}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {formatDate(warning.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-red-300 text-red-700 dark:border-red-700 dark:text-red-400">
                        {warning.warning_type === 'no_quiz' && (isRTL ? 'كويز مفقود' : 'Missing Quiz')}
                        {warning.warning_type === 'no_assignment' && (isRTL ? 'واجب مفقود' : 'Missing Assignment')}
                        {warning.warning_type === 'no_attendance' && (isRTL ? 'حضور غير مسجل' : 'No Attendance')}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismissWarning(warning.id)}
                        disabled={dismissingWarningId === warning.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-200 dark:hover:bg-red-900/50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Tabs */}
        <Tabs defaultValue="reports" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="reports" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              {isRTL ? 'التقارير' : 'Reports'}
            </TabsTrigger>
            <TabsTrigger value="finance" className="gap-2">
              <DollarSign className="h-4 w-4" />
              {isRTL ? 'المالية' : 'Finance'}
            </TabsTrigger>
            <TabsTrigger value="groups">{isRTL ? 'المجموعات' : 'Groups'}</TabsTrigger>
            <TabsTrigger value="sessions">{isRTL ? 'الجلسات' : 'Sessions'}</TabsTrigger>
            <TabsTrigger value="quizzes">{isRTL ? 'الكويزات' : 'Quizzes'}</TabsTrigger>
            <TabsTrigger value="assignments">{isRTL ? 'الواجبات' : 'Assignments'}</TabsTrigger>
          </TabsList>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <InstructorPerformanceCharts
              totalStudents={data.totalStudents}
              attendanceStats={data.attendanceStats}
              quizStats={data.quizStats}
              assignmentStats={data.assignmentStats}
              attendanceTrend={data.attendanceTrend}
            />
          </TabsContent>

          {/* Finance Tab */}
          <TabsContent value="finance">
            <div className="space-y-4">
              {/* Salary Summary */}
              <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">{isRTL ? 'الراتب الأساسي' : 'Base Salary'}</p>
                    <p className="text-2xl font-bold">
                      {data.currentSalary ? `${data.currentSalary.base_salary} ${isRTL ? 'ج.م' : 'EGP'}` : (isRTL ? 'غير محدد' : 'Not set')}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي المدفوع' : 'Total Paid'}</p>
                    <p className="text-2xl font-bold text-green-600">
                      {data.salaryPayments.reduce((sum, p) => sum + Number(p.net_amount || 0), 0)} {isRTL ? 'ج.م' : 'EGP'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">{isRTL ? 'عدد الدفعات' : 'Payments Count'}</p>
                    <p className="text-2xl font-bold">{data.salaryPayments.length}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Payment History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    {isRTL ? 'سجل الرواتب' : 'Salary History'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.salaryPayments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {isRTL ? 'لا يوجد سجلات رواتب' : 'No salary records'}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {data.salaryPayments.map((payment: any) => (
                        <div key={payment.id} className="flex items-center justify-between p-4 rounded-lg border">
                          <div>
                            <p className="font-medium">
                              {new Date(payment.month).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long' })}
                            </p>
                            <div className="flex gap-3 mt-1 text-sm">
                              <span className="text-muted-foreground">{isRTL ? 'أساسي:' : 'Base:'} {payment.base_amount}</span>
                              {Number(payment.deductions) > 0 && (
                                <span className="text-destructive">
                                  {isRTL ? 'خصم:' : 'Ded:'} -{payment.deductions}
                                  {payment.deduction_reason && <span className="text-xs ml-1">({language === 'ar' && payment.deduction_reason_ar ? payment.deduction_reason_ar : payment.deduction_reason})</span>}
                                </span>
                              )}
                              {Number(payment.bonus) > 0 && (
                                <span className="text-green-600">
                                  {isRTL ? 'بونص:' : 'Bonus:'} +{payment.bonus}
                                  {payment.bonus_reason && <span className="text-xs ml-1">({language === 'ar' && payment.bonus_reason_ar ? payment.bonus_reason_ar : payment.bonus_reason})</span>}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{payment.net_amount} {isRTL ? 'ج.م' : 'EGP'}</p>
                            <Badge className={payment.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                              {payment.status === 'paid' ? (isRTL ? 'مصروف' : 'Paid') : (isRTL ? 'معلق' : 'Pending')}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Groups Tab */}
          <TabsContent value="groups">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {isRTL ? 'المجموعات' : 'Groups'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.groups.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد مجموعات' : 'No groups assigned'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.groups.map((group: any) => (
                      <div 
                        key={group.id} 
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/group/${group.id}`)}
                      >
                        <div>
                          <p className="font-medium">
                            {language === 'ar' ? group.name_ar : group.name}
                          </p>
                          <div className="flex gap-2 mt-1">
                            {group.age_groups && (
                              <Badge variant="outline" className="text-xs">
                                {language === 'ar' ? group.age_groups.name_ar : group.age_groups.name}
                              </Badge>
                            )}
                            {group.levels && (
                              <Badge variant="secondary" className="text-xs">
                                {language === 'ar' ? group.levels.name_ar : group.levels.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">
                            {group.schedule_day} - {formatTime12Hour(group.schedule_time, isRTL)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions">
            <div className="space-y-6">
              {/* Upcoming Sessions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-green-500" />
                    {isRTL ? 'الجلسات القادمة' : 'Upcoming Sessions'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.upcomingSessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {isRTL ? 'لا توجد جلسات قادمة' : 'No upcoming sessions'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.upcomingSessions.map((session: any) => (
                        <div 
                          key={session.id} 
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                          onClick={() => navigate(`/session/${session.id}`)}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {session.session_number ? `${isRTL ? 'سيشن' : 'Session'} ${session.session_number}` : ''}
                              </p>
                              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                {isRTL ? 'قادمة' : 'Upcoming'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {language === 'ar' ? session.groups?.name_ar : session.groups?.name}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatDate(session.session_date)}</p>
                            <p className="text-sm text-muted-foreground">{formatTime12Hour(session.session_time, isRTL)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Completed Sessions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    {isRTL ? 'الجلسات المكتملة' : 'Completed Sessions'}
                    <Badge variant="secondary">{data.completedSessions.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.completedSessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {isRTL ? 'لا توجد جلسات مكتملة' : 'No completed sessions'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.completedSessions.map((session: any) => (
                        <div 
                          key={session.id} 
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                          onClick={() => navigate(`/session/${session.id}`)}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {session.session_number ? `${isRTL ? 'سيشن' : 'Session'} ${session.session_number}` : ''}
                              </p>
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                {isRTL ? 'مكتملة' : 'Completed'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {language === 'ar' ? session.groups?.name_ar : session.groups?.name}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatDate(session.session_date)}</p>
                            <p className="text-sm text-muted-foreground">{formatTime12Hour(session.session_time, isRTL)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Quizzes Tab */}
          <TabsContent value="quizzes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {isRTL ? 'الكويزات المنشأة' : 'Created Quizzes'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.quizzes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد كويزات' : 'No quizzes created'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.quizzes.map((quiz: any) => (
                      <div key={quiz.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">
                            {language === 'ar' ? quiz.title_ar : quiz.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {quiz.duration_minutes} {isRTL ? 'دقيقة' : 'min'}
                          </p>
                        </div>
                        <Badge variant={quiz.is_active ? 'default' : 'secondary'}>
                          {quiz.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {isRTL ? 'الواجبات المعينة' : 'Assigned Tasks'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.assignments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد واجبات' : 'No assignments created'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.assignments.map((assignment: any) => (
                      <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">
                            {language === 'ar' ? assignment.title_ar : assignment.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {isRTL ? 'موعد التسليم: ' : 'Due: '}{formatDate(assignment.due_date)}
                          </p>
                        </div>
                        <Badge variant={assignment.is_active ? 'default' : 'secondary'}>
                          {assignment.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'منتهي' : 'Closed')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
