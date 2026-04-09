import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Calendar, Clock, Award, AlertTriangle, BookOpen, 
  FileText, GraduationCap, ArrowLeft, Mail, Phone, CheckCircle, XCircle, BarChart3, Plus, RefreshCw, DollarSign, Printer
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/timeUtils';
import { notificationService } from '@/lib/notificationService';
import { StudentPerformanceCharts } from '@/components/student/StudentPerformanceCharts';
import { LevelHistorySection } from '@/components/student/LevelHistorySection';
import { EvaluationSummary } from '@/components/student/EvaluationSummary';
import { IssueWarningDialog } from '@/components/student/IssueWarningDialog';
import { CreateSubscriptionDialog } from '@/components/student/CreateSubscriptionDialog';
import { EditSubscriptionDialog } from '@/components/student/EditSubscriptionDialog';
import { ResetPasswordButton } from '@/components/ResetPasswordButton';
import { generateStudentReport } from '@/lib/pdfReports';
import { PaymentsHistory } from '@/components/student/PaymentsHistory';
import { SchedulePlacementDialog } from '@/components/student/SchedulePlacementDialog';
import { StudentCertificatesTab } from '@/components/student/StudentCertificatesTab';
import { StudentXpBreakdown } from '@/components/dashboard/StudentXpCard';

interface StudentData {
  profile: any;
  subscription: any;
  group: any;
  attendance: any[];
  quizSubmissions: any[];
  assignmentSubmissions: any[];
  warnings: any[];
  makeupSessions: any[];
}

function MakeupCreditsDisplay({ studentId }: { studentId: string }) {
  const { isRTL } = useLanguage();
  const [credits, setCredits] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from('student_makeup_credits')
      .select('*, levels(name, name_ar)')
      .eq('student_id', studentId)
      .then(({ data }) => setCredits(data || []));
  }, [studentId]);

  if (credits.length === 0) {
    return <span>{isRTL ? 'لا يوجد رصيد تعويضي مسجل' : 'No makeup credits recorded'}</span>;
  }

  return (
    <div className="space-y-1">
      {credits.map((c: any) => {
        const remaining = Math.max(0, c.total_free_allowed - c.used_free);
        const levelName = isRTL ? (c.levels?.name_ar || c.levels?.name) : (c.levels?.name || '');
        return (
          <div key={c.id} className="text-sm">
            {levelName}: <Badge variant={remaining === 0 ? 'destructive' : 'secondary'}>{remaining}/{c.total_free_allowed} {isRTL ? 'متبقية' : 'remaining'}</Badge>
          </div>
        );
      })}
    </div>
  );
}

function LevelProgressGrid({ studentId, attendance, makeupSessions }: { studentId: string; attendance: any[]; makeupSessions: any[] }) {
  const { isRTL, language } = useLanguage();
  
  // Build a 1-12 session progress grid from attendance data
  const sessionMap = new Map<number, string>();
  
  attendance.forEach((a: any) => {
    const sessionNum = a.sessions?.session_number;
    if (sessionNum) {
      if (a.status === 'present' || a.status === 'late') {
        sessionMap.set(sessionNum, 'present');
      } else if (a.compensation_status === 'compensated') {
        sessionMap.set(sessionNum, 'compensated');
      } else if (a.status === 'absent') {
        sessionMap.set(sessionNum, 'absent');
      }
    }
  });

  return (
    <div>
      <p className="text-sm font-medium mb-2">{isRTL ? 'تقدم الليفل (1-12)' : 'Level Progress (1-12)'}</p>
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(num => {
          const status = sessionMap.get(num);
          const bgClass = status === 'present' ? 'bg-green-500 text-white' :
                          status === 'compensated' ? 'bg-blue-500 text-white' :
                          status === 'absent' ? 'bg-red-500 text-white' :
                          'bg-muted text-muted-foreground';
          return (
            <div key={num} className={`w-full aspect-square rounded flex items-center justify-center text-xs font-medium ${bgClass}`}>
              {num}
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500" />{isRTL ? 'حضر' : 'Present'}</span>
        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-500" />{isRTL ? 'عوّض' : 'Compensated'}</span>
        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500" />{isRTL ? 'غاب' : 'Absent'}</span>
        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-muted" />{isRTL ? 'لم يبدأ' : 'Not started'}</span>
      </div>
    </div>
  );
}

export default function StudentProfile() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { isRTL, language } = useLanguage();
  const { role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StudentData | null>(null);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [showRenewalDialog, setShowRenewalDialog] = useState(false);
  const [showEditSubscriptionDialog, setShowEditSubscriptionDialog] = useState(false);
  const [showPlacementSchedule, setShowPlacementSchedule] = useState(false);

  useEffect(() => {
    if (studentId) fetchStudentData();
  }, [studentId]);

  const fetchStudentData = async () => {
    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, age_groups(name, name_ar), levels(name, name_ar)')
        .eq('user_id', studentId)
        .single();

      // Fetch subscription with pricing plan
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*, pricing_plans(name, name_ar, attendance_mode)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch group membership
      const { data: groupStudent } = await supabase
        .from('group_students')
        .select('*, groups(*)')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .maybeSingle();

      // Fetch attendance
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*, sessions(session_date, session_time, session_number, topic, topic_ar)')
        .eq('student_id', studentId)
        .order('recorded_at', { ascending: false })
        .limit(50);

      // Fetch quiz submissions
      const { data: quizSubmissions } = await supabase
        .from('quiz_submissions')
        .select('*, quiz_assignments(quizzes(title, title_ar))')
        .eq('student_id', studentId)
        .eq('is_auto_generated', false)
        .order('submitted_at', { ascending: false });

      // Fetch assignment submissions
      const { data: assignmentSubmissions } = await supabase
        .from('assignment_submissions')
        .select('*, assignments(title, title_ar, max_score)')
        .eq('student_id', studentId)
        .eq('is_auto_generated', false)
        .order('submitted_at', { ascending: false });

      // Fetch warnings
      const { data: warnings } = await supabase
        .from('warnings')
        .select('*, profiles!warnings_issued_by_fkey(full_name, full_name_ar)')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Fetch makeup sessions
      const { data: makeupSessions } = await supabase
        .from('makeup_sessions')
        .select('*, groups(name, name_ar), levels(name, name_ar)')
        .eq('student_id', studentId!)
        .order('created_at', { ascending: false });

      setData({
        profile,
        subscription,
        group: groupStudent?.groups,
        attendance: attendance || [],
        quizSubmissions: quizSubmissions || [],
        assignmentSubmissions: assignmentSubmissions || [],
        warnings: warnings || [],
        makeupSessions: makeupSessions || [],
      });
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceStats = () => {
    const total = data?.attendance.length || 0;
    const present = data?.attendance.filter(a => a.status === 'present').length || 0;
    const absent = data?.attendance.filter(a => a.status === 'absent').length || 0;
    const late = data?.attendance.filter(a => a.status === 'late').length || 0;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, late, rate };
  };

  const getQuizStats = () => {
    const completed = data?.quizSubmissions.filter(q => q.status === 'completed').length || 0;
    const avgScore = data?.quizSubmissions.length 
      ? Math.round(data.quizSubmissions.reduce((sum, q) => sum + (q.percentage || 0), 0) / data.quizSubmissions.length)
      : 0;
    return { completed, avgScore };
  };

  // SSOT: uses centralized formatDate from timeUtils.ts

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'ملف الطالب' : 'Student Profile'}>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!data?.profile) {
    return (
      <DashboardLayout title={isRTL ? 'ملف الطالب' : 'Student Profile'}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{isRTL ? 'لم يتم العثور على الطالب' : 'Student not found'}</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isRTL ? 'رجوع' : 'Go Back'}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const attendanceStats = getAttendanceStats();
  const quizStats = getQuizStats();

  return (
    <DashboardLayout title={isRTL ? 'ملف الطالب' : 'Student Profile'}>
      <div className="space-y-6">
        {/* Back Button & Actions */}
        <div className="flex justify-between items-center flex-wrap gap-2">
          <Button variant="ghost" onClick={() => navigate('/students')}>
            <ArrowLeft className={`h-4 w-4 ${isRTL ? "ms-2 rotate-180" : "me-2"}`} />
            {isRTL ? 'رجوع' : 'Back'}
          </Button>
          
          {(role === 'admin' || role === 'instructor' || role === 'reception') && (
            <div className="flex gap-2">
              {(role === 'admin' || role === 'reception') && !data?.subscription && (
                <Button 
                  variant="outline"
                  onClick={() => setShowSubscriptionDialog(true)}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  {isRTL ? 'إنشاء اشتراك' : 'Create Subscription'}
                </Button>
              )}
              {(role === 'admin' || role === 'reception') && data?.subscription && (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => setShowEditSubscriptionDialog(true)}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    {isRTL ? 'تعديل الاشتراك' : 'Edit Subscription'}
                  </Button>
                  {Number(data.subscription.remaining_amount) <= 0 && (
                    <Button 
                      variant="default"
                      onClick={() => setShowRenewalDialog(true)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {isRTL ? 'تجديد الاشتراك' : 'Renew Subscription'}
                    </Button>
                  )}
                </>
              )}
              {role === 'admin' && (
                <ResetPasswordButton
                  userId={studentId!}
                  userName={data?.profile?.full_name || ''}
                  userEmail={data?.profile?.email || ''}
                  avatarUrl={data?.profile?.avatar_url}
                  levelName={data?.profile?.levels?.name}
                  subscriptionType={data?.profile?.subscription_type}
                  attendanceMode={data?.profile?.attendance_mode}
                  ageGroupName={data?.profile?.age_groups?.name}
                />
              )}
              <Button
                variant="outline"
                onClick={() => {
                  const totalSessions = data?.attendance?.length || 0;
                  const presentSessions = data?.attendance?.filter(a => a.status === 'present').length || 0;
                  const attendanceRate = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0;
                  const quizScores = data?.quizSubmissions?.filter(q => q.percentage != null).map(q => q.percentage) || [];
                  const quizAvg = quizScores.length > 0 ? Math.round(quizScores.reduce((a: number, b: number) => a + b, 0) / quizScores.length) : 0;
                  const assignScores = data?.assignmentSubmissions?.filter(a => a.score != null).map(a => a.score) || [];
                  const assignAvg = assignScores.length > 0 ? Math.round(assignScores.reduce((a: number, b: number) => a + b, 0) / assignScores.length) : 0;

                  generateStudentReport(
                    {
                      name: data?.profile?.full_name || '',
                      email: data?.profile?.email || '',
                      group: data?.group ? (language === 'ar' ? data.group.name_ar : data.group.name) : undefined,
                      level: data?.profile?.levels ? (language === 'ar' ? data.profile.levels.name_ar : data.profile.levels.name) : undefined,
                      ageGroup: data?.profile?.age_groups ? (language === 'ar' ? data.profile.age_groups.name_ar : data.profile.age_groups.name) : undefined,
                    },
                    { attendanceRate, quizAvg, assignmentAvg: assignAvg, totalSessions, presentSessions, warningsCount: data?.warnings?.length || 0 },
                    isRTL,
                  );
                }}
              >
                <Printer className="h-4 w-4 mr-2" />
                {isRTL ? 'تقرير PDF' : 'PDF Report'}
              </Button>
              <Button 
                variant="outline" 
                className="border-warning text-warning hover:bg-warning/10"
                onClick={() => setShowWarningDialog(true)}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                {isRTL ? 'إصدار إنذار' : 'Issue Warning'}
              </Button>
              {/* Schedule Placement Exam — only if student has no level */}
              {!data?.profile?.level_id && (role === 'admin' || role === 'reception') && (
                <Button
                  variant="outline"
                  onClick={() => setShowPlacementSchedule(true)}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {isRTL ? 'جدولة امتحان تحديد المستوى' : 'Schedule Placement Exam'}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Profile Header */}
        <Card className="relative overflow-hidden border-0 shadow-md">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full -translate-y-10 translate-x-10" />
          <CardContent className="relative p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <Avatar className="h-24 w-24 ring-4 ring-primary/20 shadow-lg">
                <AvatarImage src={data.profile.avatar_url} className="object-cover" />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-secondary text-white">
                  {data.profile.full_name?.charAt(0) || 'S'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">
                  {language === 'ar' ? data.profile.full_name_ar || data.profile.full_name : data.profile.full_name}
                </h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  {data.group && (
                    <Badge 
                      variant="default" 
                      className="cursor-pointer hover:opacity-80 transition-opacity gap-1"
                      onClick={() => navigate(`/group/${data.group.id}`)}
                    >
                      <BookOpen className="h-3 w-3" />
                      {language === 'ar' ? data.group.name_ar : data.group.name}
                    </Badge>
                  )}
                  {data.profile.age_groups && (
                    <Badge variant="secondary">
                      {language === 'ar' ? data.profile.age_groups.name_ar : data.profile.age_groups.name}
                    </Badge>
                  )}
                  {data.profile.levels && (
                    <Badge variant="outline">
                      {language === 'ar' ? data.profile.levels.name_ar : data.profile.levels.name}
                    </Badge>
                  )}
                  {data.warnings.length > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {data.warnings.length} {isRTL ? 'إنذار' : 'Warning(s)'}
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

              {/* Subscription Status */}
              <div className="text-right">
                {data.subscription ? (
                  <div className="space-y-1">
                    <Badge className="bg-green-100 text-green-800">
                      {isRTL ? 'اشتراك فعال' : 'Active Subscription'}
                    </Badge>
                    {data.subscription.pricing_plans && (
                      <p className="text-sm font-medium">
                        {language === 'ar' ? data.subscription.pricing_plans.name_ar : data.subscription.pricing_plans.name}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {isRTL ? 'ينتهي: ' : 'Ends: '}{formatDate(data.subscription.end_date)}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {data.subscription.payment_type === 'installment' ? (isRTL ? 'تقسيط' : 'Installment') : (isRTL ? 'دفع كامل' : 'Full Payment')}
                    </Badge>
                    {Number(data.subscription.remaining_amount) > 0 && (
                      <p className="text-sm text-orange-600">
                        {isRTL ? 'متبقي: ' : 'Remaining: '}{data.subscription.remaining_amount} {isRTL ? 'ج.م' : 'EGP'}
                      </p>
                    )}
                    {data.subscription.next_payment_date && (
                      <p className="text-xs text-muted-foreground">
                        {isRTL ? 'الدفع القادم: ' : 'Next: '}{formatDate(data.subscription.next_payment_date)}
                      </p>
                    )}
                    {data.subscription.is_suspended && (
                      <Badge variant="destructive">{isRTL ? 'موقوف' : 'Suspended'}</Badge>
                    )}
                  </div>
                ) : (
                  <Badge variant="destructive">{isRTL ? 'لا يوجد اشتراك' : 'No Subscription'}</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            { label: isRTL ? 'نسبة الحضور' : 'Attendance Rate', value: `${attendanceStats.rate}%`, icon: CheckCircle, gradient: 'from-emerald-500 to-emerald-600', bgGradient: 'from-emerald-500/10 to-emerald-600/5' },
            { label: isRTL ? 'كويزات مكتملة' : 'Quizzes Completed', value: quizStats.completed, icon: BookOpen, gradient: 'from-blue-500 to-blue-600', bgGradient: 'from-blue-500/10 to-blue-600/5' },
            { label: isRTL ? 'متوسط الدرجات' : 'Avg. Score', value: `${quizStats.avgScore}%`, icon: Award, gradient: 'from-purple-500 to-purple-600', bgGradient: 'from-purple-500/10 to-purple-600/5' },
            { label: isRTL ? 'إنذارات' : 'Warnings', value: data.warnings.length, icon: AlertTriangle, gradient: data.warnings.length > 0 ? 'from-red-500 to-red-600' : 'from-amber-500 to-orange-500', bgGradient: data.warnings.length > 0 ? 'from-red-500/10 to-red-600/5' : 'from-amber-500/10 to-orange-500/5' },
          ].map((stat) => (
            <Card key={stat.label} className="relative overflow-hidden border-0 shadow-sm">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgGradient}`} />
              <CardContent className="relative p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${stat.gradient}`}>
                    <stat.icon className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Group Info */}
        {/* Detailed Tabs - Action First */}
        <Tabs defaultValue="payments" className="w-full">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="payments">{isRTL ? 'الدفعات' : 'Payments'}</TabsTrigger>
            <TabsTrigger value="attendance">{isRTL ? 'الحضور' : 'Attendance'}</TabsTrigger>
            <TabsTrigger value="warnings">{isRTL ? 'الإنذارات' : 'Warnings'}</TabsTrigger>
            <TabsTrigger value="quizzes">{isRTL ? 'الكويزات' : 'Quizzes'}</TabsTrigger>
            <TabsTrigger value="assignments">{isRTL ? 'الواجبات' : 'Assignments'}</TabsTrigger>
            <TabsTrigger value="makeup">{isRTL ? 'التعويضات' : 'Makeup'}</TabsTrigger>
            <TabsTrigger value="certificates">{isRTL ? 'الشهادات' : 'Certificates'}</TabsTrigger>
            <TabsTrigger value="xp">{isRTL ? 'نقاط XP' : 'XP'}</TabsTrigger>
          </TabsList>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <PaymentsHistory studentId={studentId!} subscription={data.subscription} attendance={data.attendance} />
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'سجل الحضور' : 'Attendance History'}</CardTitle>
                <CardDescription>
                  {isRTL 
                    ? `${attendanceStats.present} حضور، ${attendanceStats.absent} غياب، ${attendanceStats.late} تأخير`
                    : `${attendanceStats.present} present, ${attendanceStats.absent} absent, ${attendanceStats.late} late`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.attendance.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد سجلات حضور' : 'No attendance records'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.attendance.slice(0, 20).map((record: any) => (
                      <div key={record.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">
                            {record.sessions?.topic || record.sessions?.session_date}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(record.sessions?.session_date)} - {record.sessions?.session_time}
                          </p>
                        </div>
                        <Badge className={
                          record.status === 'present' ? 'bg-green-100 text-green-800' :
                          record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }>
                          {record.status === 'present' ? (isRTL ? 'حاضر' : 'Present') :
                           record.status === 'late' ? (isRTL ? 'متأخر' : 'Late') :
                           (isRTL ? 'غائب' : 'Absent')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Warnings Tab */}
          <TabsContent value="warnings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  {isRTL ? 'الإنذارات' : 'Warnings'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.warnings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                    {isRTL ? 'لا توجد إنذارات' : 'No warnings'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.warnings.map((warning: any) => (
                      <div key={warning.id} className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge variant="destructive" className="mb-2">
                              {warning.warning_type === 'attendance' ? (isRTL ? 'غياب' : 'Attendance') : 
                               warning.warning_type === 'behavior' ? (isRTL ? 'سلوك' : 'Behavior') :
                               (isRTL ? 'عام' : 'General')}
                            </Badge>
                            <p className="font-medium">
                              {language === 'ar' ? warning.reason_ar || warning.reason : warning.reason}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {isRTL ? 'بواسطة: ' : 'By: '}
                              {warning.profiles?.full_name || '-'}
                            </p>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(warning.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quizzes Tab */}
          <TabsContent value="quizzes">
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'نتائج الكويزات' : 'Quiz Results'}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.quizSubmissions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد كويزات' : 'No quiz submissions'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.quizSubmissions.map((submission: any) => (
                      <div key={submission.id} className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium">
                            {language === 'ar' 
                              ? submission.quiz_assignments?.quizzes?.title_ar 
                              : submission.quiz_assignments?.quizzes?.title}
                          </p>
                          <Badge className={submission.percentage >= 60 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {submission.percentage || 0}%
                          </Badge>
                        </div>
                        <Progress value={submission.percentage || 0} className="h-2" />
                        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                          <span>{isRTL ? 'الدرجة: ' : 'Score: '}{submission.score}/{submission.max_score}</span>
                          <span>{formatDate(submission.submitted_at)}</span>
                        </div>
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
                <CardTitle>{isRTL ? 'الواجبات المسلمة' : 'Assignment Submissions'}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.assignmentSubmissions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد واجبات' : 'No assignment submissions'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.assignmentSubmissions.map((submission: any) => (
                      <div key={submission.id} className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {language === 'ar' 
                                ? submission.assignments?.title_ar 
                                : submission.assignments?.title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {isRTL ? 'سُلم في: ' : 'Submitted: '}{formatDate(submission.submitted_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className={
                              submission.status === 'graded' ? 'bg-green-100 text-green-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {submission.status === 'graded' ? (isRTL ? 'مُقيّم' : 'Graded') : (isRTL ? 'بانتظار التقييم' : 'Pending')}
                            </Badge>
                            {submission.score !== null && (
                              <p className="text-sm font-medium mt-1">
                                {submission.score}/{submission.assignments?.max_score || 100}
                              </p>
                            )}
                          </div>
                        </div>
                        {submission.feedback && (
                          <p className="mt-2 text-sm bg-muted p-2 rounded">
                            {language === 'ar' ? submission.feedback_ar || submission.feedback : submission.feedback}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Makeup Sessions Tab */}
          <TabsContent value="makeup">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  {isRTL ? 'السيشنات التعويضية' : 'Makeup Sessions'}
                </CardTitle>
                <CardDescription>
                  <MakeupCreditsDisplay studentId={studentId!} />
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Level Progress Grid */}
                <LevelProgressGrid studentId={studentId!} attendance={data.attendance} makeupSessions={data.makeupSessions} />
                
                <div className="mb-4 mt-4 p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {isRTL ? 'السيشنات المعوضة' : 'Compensated sessions'}
                    </span>
                    <Badge variant="secondary">
                      {data.makeupSessions.filter((m: any) => m.status === 'completed').length} / {data.makeupSessions.length}
                    </Badge>
                  </div>
                </div>
                {data.makeupSessions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    {isRTL ? 'لا توجد سيشنات تعويضية' : 'No makeup sessions'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.makeupSessions.map((ms: any) => (
                      <div key={ms.id} className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={ms.reason === 'group_cancelled' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}>
                              {ms.reason === 'group_cancelled' ? (isRTL ? 'إلغاء مجموعة' : 'Group Cancelled') : (isRTL ? 'غياب' : 'Absent')}
                            </Badge>
                            <Badge variant={ms.is_free ? 'secondary' : 'outline'}>
                              {ms.is_free ? (isRTL ? 'مجانية' : 'Free') : (isRTL ? 'مدفوعة' : 'Paid')}
                            </Badge>
                          </div>
                          <Badge className={
                            ms.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            ms.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                            ms.status === 'completed' ? 'bg-green-100 text-green-800' :
                            'bg-muted text-muted-foreground'
                          }>
                            {ms.status === 'pending' ? (isRTL ? 'معلق' : 'Pending') :
                             ms.status === 'scheduled' ? (isRTL ? 'مجدول' : 'Scheduled') :
                             ms.status === 'completed' ? (isRTL ? 'مكتمل' : 'Completed') :
                             (isRTL ? 'منتهي' : 'Expired')}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {ms.groups && (
                            <p>{isRTL ? 'المجموعة: ' : 'Group: '}{language === 'ar' ? ms.groups.name_ar : ms.groups.name}</p>
                          )}
                          {ms.scheduled_date && (
                            <p>{isRTL ? 'الموعد: ' : 'Scheduled: '}{formatDate(ms.scheduled_date)} {ms.scheduled_time}</p>
                          )}
                          <p>{isRTL ? 'تاريخ الإنشاء: ' : 'Created: '}{formatDate(ms.created_at)}</p>
                        </div>
                        {/* Student confirmation for scheduled sessions */}
                        {ms.status === 'scheduled' && ms.student_confirmed === null && role === 'student' && (
                          <div className="mt-3 flex gap-2 border-t pt-3">
                            <Button size="sm" className="flex-1" onClick={async () => {
                              await supabase.from('makeup_sessions').update({ student_confirmed: true }).eq('id', ms.id);
                              const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
                              if (adminRoles) {
                                for (const admin of adminRoles) {
                                  await notificationService.create({
                                    user_id: admin.user_id,
                                    title: 'Makeup Session Confirmed',
                                    title_ar: 'تأكيد سيشن تعويضية',
                                    message: `${data.profile.full_name} confirmed a makeup session`,
                                    message_ar: `${data.profile.full_name_ar || data.profile.full_name} أكد السيشن التعويضية`,
                                    type: 'success',
                                    category: 'makeup_session',
                                    action_url: '/makeup-sessions',
                                  });
                                }
                              }
                              toast({ title: isRTL ? 'تم التأكيد' : 'Confirmed' });
                              fetchStudentData();
                            }}>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {isRTL ? 'تأكيد' : 'Confirm'}
                            </Button>
                            <Button size="sm" variant="destructive" className="flex-1" onClick={async () => {
                              await supabase.from('makeup_sessions').update({ student_confirmed: false }).eq('id', ms.id);
                              const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
                              if (adminRoles) {
                                for (const admin of adminRoles) {
                                  await notificationService.create({
                                    user_id: admin.user_id,
                                    title: 'Makeup Session Rejected',
                                    title_ar: 'رفض سيشن تعويضية',
                                    message: `${data.profile.full_name} rejected a makeup session`,
                                    message_ar: `${data.profile.full_name_ar || data.profile.full_name} رفض السيشن التعويضية`,
                                    type: 'warning',
                                    category: 'makeup_session',
                                    action_url: '/makeup-sessions',
                                  });
                                }
                              }
                              toast({ title: isRTL ? 'تم الرفض' : 'Rejected' });
                              fetchStudentData();
                            }}>
                              <XCircle className="h-3 w-3 mr-1" />
                              {isRTL ? 'رفض' : 'Reject'}
                            </Button>
                          </div>
                        )}
                        {ms.status === 'scheduled' && ms.student_confirmed === true && (
                          <div className="mt-2">
                            <Badge className="bg-green-100 text-green-800">{isRTL ? 'تم التأكيد ✓' : 'Confirmed ✓'}</Badge>
                          </div>
                        )}
                        {ms.status === 'scheduled' && ms.student_confirmed === false && (
                          <div className="mt-2">
                            <Badge variant="destructive">{isRTL ? 'مرفوض' : 'Rejected'}</Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Certificates Tab */}
          <TabsContent value="certificates">
            <StudentCertificatesTab studentId={studentId!} />
          </TabsContent>

          <TabsContent value="xp">
            <StudentXpBreakdown studentId={studentId!} />
          </TabsContent>
        </Tabs>

        {/* Reference Sections - Below Tabs */}
        {data.group && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                {isRTL ? 'المجموعة' : 'Group'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'اسم المجموعة' : 'Group Name'}</p>
                  <p className="font-medium">{language === 'ar' ? data.group.name_ar : data.group.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'الموعد' : 'Schedule'}</p>
                  <p className="font-medium">{data.group.schedule_day} - {data.group.schedule_time}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'المدة' : 'Duration'}</p>
                  <p className="font-medium">{data.group.duration_minutes} {isRTL ? 'دقيقة' : 'min'}</p>
                </div>
                {data.group.profiles && (
                  <div>
                    <p className="text-sm text-muted-foreground">{isRTL ? 'المدرب' : 'Instructor'}</p>
                    <p className="font-medium">
                      {language === 'ar' ? data.group.profiles.full_name_ar || data.group.profiles.full_name : data.group.profiles.full_name}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Level History */}
        <LevelHistorySection studentId={studentId!} />

        {/* Evaluation Summary */}
        <EvaluationSummary studentId={studentId!} />

        {/* Performance Charts - Heaviest, last */}
        <StudentPerformanceCharts
          attendance={data.attendance}
          quizSubmissions={data.quizSubmissions}
          assignmentSubmissions={data.assignmentSubmissions}
          instructor={data.group?.profiles}
          groupName={data.group?.name}
          groupNameAr={data.group?.name_ar}
        />
      </div>

      {/* Issue Warning Dialog */}
      <IssueWarningDialog
        open={showWarningDialog}
        onOpenChange={setShowWarningDialog}
        studentId={studentId!}
        studentName={language === 'ar' ? data.profile.full_name_ar || data.profile.full_name : data.profile.full_name}
        onSuccess={fetchStudentData}
      />

      {/* Create Subscription Dialog */}
      <CreateSubscriptionDialog
        open={showSubscriptionDialog}
        onOpenChange={setShowSubscriptionDialog}
        studentId={studentId!}
        studentName={language === 'ar' ? data.profile.full_name_ar || data.profile.full_name : data.profile.full_name}
        onSuccess={fetchStudentData}
      />

      {/* Renewal Subscription Dialog */}
      <CreateSubscriptionDialog
        open={showRenewalDialog}
        onOpenChange={setShowRenewalDialog}
        studentId={studentId!}
        studentName={language === 'ar' ? data.profile.full_name_ar || data.profile.full_name : data.profile.full_name}
        onSuccess={fetchStudentData}
        isRenewal={true}
        previousSubscriptionId={data.subscription?.id}
      />

      {/* Edit Subscription Dialog */}
      {data.subscription && (
        <EditSubscriptionDialog
          open={showEditSubscriptionDialog}
          onOpenChange={setShowEditSubscriptionDialog}
          subscription={data.subscription}
          studentId={studentId!}
          studentName={language === 'ar' ? data.profile.full_name_ar || data.profile.full_name : data.profile.full_name}
          onSuccess={fetchStudentData}
        />
      )}

      {/* Schedule Placement Exam Dialog */}
      <SchedulePlacementDialog
        open={showPlacementSchedule}
        onOpenChange={setShowPlacementSchedule}
        studentId={studentId!}
        studentName={language === 'ar' ? data.profile.full_name_ar || data.profile.full_name : data.profile.full_name}
        onScheduled={fetchStudentData}
      />
    </DashboardLayout>
  );
}
