import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Calendar, Clock, Award, AlertTriangle, BookOpen, 
  FileText, GraduationCap, ArrowLeft, Mail, Phone, CheckCircle, XCircle, BarChart3, Plus
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
import { supabase } from '@/integrations/supabase/client';
import { StudentPerformanceCharts } from '@/components/student/StudentPerformanceCharts';
import { IssueWarningDialog } from '@/components/student/IssueWarningDialog';

interface StudentData {
  profile: any;
  subscription: any;
  group: any;
  attendance: any[];
  quizSubmissions: any[];
  assignmentSubmissions: any[];
  warnings: any[];
}

export default function StudentProfile() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { isRTL, language } = useLanguage();
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StudentData | null>(null);
  const [showWarningDialog, setShowWarningDialog] = useState(false);

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

      // Fetch subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch group membership
      const { data: groupStudent } = await supabase
        .from('group_students')
        .select('*, groups(*, profiles!groups_instructor_id_fkey(full_name, full_name_ar))')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .maybeSingle();

      // Fetch attendance
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*, sessions(session_date, session_time, topic, topic_ar)')
        .eq('student_id', studentId)
        .order('recorded_at', { ascending: false })
        .limit(50);

      // Fetch quiz submissions
      const { data: quizSubmissions } = await supabase
        .from('quiz_submissions')
        .select('*, quiz_assignments(quizzes(title, title_ar))')
        .eq('student_id', studentId)
        .order('submitted_at', { ascending: false });

      // Fetch assignment submissions
      const { data: assignmentSubmissions } = await supabase
        .from('assignment_submissions')
        .select('*, assignments(title, title_ar, max_score)')
        .eq('student_id', studentId)
        .order('submitted_at', { ascending: false });

      // Fetch warnings
      const { data: warnings } = await supabase
        .from('warnings')
        .select('*, profiles!warnings_issued_by_fkey(full_name, full_name_ar)')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      setData({
        profile,
        subscription,
        group: groupStudent?.groups,
        attendance: attendance || [],
        quizSubmissions: quizSubmissions || [],
        assignmentSubmissions: assignmentSubmissions || [],
        warnings: warnings || [],
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
        <div className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isRTL ? 'رجوع' : 'Back'}
          </Button>
          
          {(role === 'admin' || role === 'instructor') && (
            <Button 
              variant="outline" 
              className="border-warning text-warning hover:bg-warning/10"
              onClick={() => setShowWarningDialog(true)}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {isRTL ? 'إصدار إنذار' : 'Issue Warning'}
            </Button>
          )}
        </div>

        {/* Profile Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <Avatar className="h-24 w-24">
                <AvatarImage src={data.profile.avatar_url} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {data.profile.full_name?.charAt(0) || 'S'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">
                  {language === 'ar' ? data.profile.full_name_ar || data.profile.full_name : data.profile.full_name}
                </h1>
                <div className="flex flex-wrap gap-2 mt-2">
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
                    <p className="text-sm text-muted-foreground">
                      {isRTL ? 'ينتهي: ' : 'Ends: '}{formatDate(data.subscription.end_date)}
                    </p>
                    {data.subscription.remaining_amount > 0 && (
                      <p className="text-sm text-orange-600">
                        {isRTL ? 'متبقي: ' : 'Remaining: '}{data.subscription.remaining_amount} {isRTL ? 'ج.م' : 'EGP'}
                      </p>
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
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{attendanceStats.rate}%</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'نسبة الحضور' : 'Attendance Rate'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{quizStats.completed}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'كويزات مكتملة' : 'Quizzes Completed'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Award className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{quizStats.avgScore}%</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'متوسط الدرجات' : 'Avg. Score'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.warnings.length}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'إنذارات' : 'Warnings'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Group Info */}
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

        {/* Performance Charts - New Section */}
        <StudentPerformanceCharts
          attendance={data.attendance}
          quizSubmissions={data.quizSubmissions}
          assignmentSubmissions={data.assignmentSubmissions}
          instructor={data.group?.profiles}
          groupName={data.group?.name}
          groupNameAr={data.group?.name_ar}
        />

        {/* Detailed Tabs */}
        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="attendance">{isRTL ? 'الحضور' : 'Attendance'}</TabsTrigger>
            <TabsTrigger value="quizzes">{isRTL ? 'الكويزات' : 'Quizzes'}</TabsTrigger>
            <TabsTrigger value="assignments">{isRTL ? 'الواجبات' : 'Assignments'}</TabsTrigger>
            <TabsTrigger value="warnings">{isRTL ? 'الإنذارات' : 'Warnings'}</TabsTrigger>
          </TabsList>

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
        </Tabs>
      </div>

      {/* Issue Warning Dialog */}
      <IssueWarningDialog
        open={showWarningDialog}
        onOpenChange={setShowWarningDialog}
        studentId={studentId!}
        studentName={language === 'ar' ? data.profile.full_name_ar || data.profile.full_name : data.profile.full_name}
        onSuccess={fetchStudentData}
      />
    </DashboardLayout>
  );
}
