import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/lib/notificationService';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, Clock, CreditCard, BookOpen, UserCheck, FileText, Award, RefreshCw, Calendar, Download, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export default function ParentStudentView() {
  const { studentId } = useParams<{ studentId: string }>();
  const { user } = useAuth();
  const { isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [makeupSessions, setMakeupSessions] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !studentId) return;

    const fetchData = async () => {
      // Verify parent is linked to this student
      const { data: link } = await supabase
        .from('parent_students')
        .select('id')
        .eq('parent_id', user.id)
        .eq('student_id', studentId)
        .maybeSingle();

      if (!link) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      setAuthorized(true);

      const [profileRes, attendanceRes, submissionsRes, paymentsRes, subRes, quizRes, certRes, makeupRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', studentId).maybeSingle(),
        supabase.from('attendance').select('*, sessions(session_date, session_number, groups(name, name_ar))').eq('student_id', studentId).order('recorded_at', { ascending: false }).limit(50),
        supabase.from('assignment_submissions').select('*, assignments(title, title_ar, max_score)').eq('student_id', studentId).order('submitted_at', { ascending: false }).limit(50),
        supabase.from('payments').select('*').eq('student_id', studentId).order('payment_date', { ascending: false }).limit(50),
        supabase.from('subscriptions').select('*, levels(name, name_ar), pricing_plans(name_en, name_ar)').eq('student_id', studentId).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('quiz_submissions').select('*, quiz_assignments(quizzes(title, title_ar, passing_score))').eq('student_id', studentId).order('submitted_at', { ascending: false }).limit(50),
        supabase.from('student_certificates').select('*').eq('student_id', studentId).order('issued_at', { ascending: false }),
        supabase.from('makeup_sessions').select('id, reason, status, scheduled_date, scheduled_time, notes, is_free, created_at, student_confirmed, groups(name, name_ar), levels(name, name_ar)').eq('student_id', studentId).order('created_at', { ascending: false }),
      ]);

      setProfile(profileRes.data);
      setAttendance(attendanceRes.data || []);
      setSubmissions(submissionsRes.data || []);
      setPayments(paymentsRes.data || []);
      setSubscription(subRes.data);
      setQuizResults((quizRes.data as any) || []);
      setCertificates((certRes.data as any) || []);
      setMakeupSessions((makeupRes.data as any) || []);
      setLoading(false);
    };

    fetchData();
  }, [user, studentId]);

  const handleMakeupConfirm = async (session: any, confirmed: boolean) => {
    try {
      const { error } = await supabase
        .from('makeup_sessions')
        .update({ student_confirmed: confirmed })
        .eq('id', session.id);
      if (error) throw error;

      // Notify admins
      const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      const groupName = language === 'ar' ? (session.groups?.name_ar || session.groups?.name) : session.groups?.name;
      const { data: parentProfile } = await supabase.from('profiles').select('full_name, full_name_ar').eq('user_id', user!.id).single();
      const parentName = language === 'ar' ? (parentProfile?.full_name_ar || parentProfile?.full_name) : parentProfile?.full_name;

      if (adminRoles) {
        for (const admin of adminRoles) {
          await notificationService.create({
            user_id: admin.user_id,
            title: confirmed ? 'Makeup Session Confirmed by Parent' : 'Makeup Session Rejected by Parent',
            title_ar: confirmed ? 'تأكيد سيشن تعويضية من ولي الأمر' : 'رفض سيشن تعويضية من ولي الأمر',
            message: `${parentName} has ${confirmed ? 'confirmed' : 'rejected'} the makeup session for "${groupName}"`,
            message_ar: `${parentName} ${confirmed ? 'أكد' : 'رفض'} السيشن التعويضية لمجموعة "${groupName}"`,
            type: confirmed ? 'success' : 'warning',
            category: 'makeup_session',
            action_url: '/makeup-sessions',
          });
        }
      }

      toast({ title: confirmed ? (isRTL ? 'تم التأكيد' : 'Confirmed') : (isRTL ? 'تم الرفض' : 'Rejected') });
      // Update local state
      setMakeupSessions(prev => prev.map(s => s.id === session.id ? { ...s, student_confirmed: confirmed } : s));
    } catch (error: any) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message });
    }
  };

  const handleDownloadCertificate = async (cert: any) => {
    if (!cert.storage_path) return;
    try {
      const { data } = await supabase.functions.invoke('get-certificate-url', { body: { certificate_id: cert.id } });
      if (data?.url) window.open(data.url, '_blank');
    } catch (e) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ في التحميل' : 'Download error' });
    }
  };

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'تحميل...' : 'Loading...'}>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!authorized) {
    return (
      <DashboardLayout title={isRTL ? 'غير مصرح' : 'Unauthorized'}>
        <Card><CardContent className="p-8 text-center">
          <p className="text-muted-foreground">{isRTL ? 'ليس لديك صلاحية لعرض بيانات هذا الطالب' : 'You are not authorized to view this student\'s data'}</p>
          <Button className="mt-4" onClick={() => navigate('/dashboard')}>
            {isRTL ? 'العودة' : 'Go Back'}
          </Button>
        </CardContent></Card>
      </DashboardLayout>
    );
  }

  const studentName = isRTL ? profile?.full_name_ar || profile?.full_name : profile?.full_name;
  const attendancePresent = attendance.filter(a => a.status === 'present').length;
  const attendanceTotal = attendance.length;
  const attendanceRate = attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : 0;
  const pendingMakeups = makeupSessions.filter(s => s.status === 'scheduled' && s.student_confirmed === null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present': return <Badge variant="default" className="bg-green-600">{isRTL ? 'حاضر' : 'Present'}</Badge>;
      case 'absent': return <Badge variant="destructive">{isRTL ? 'غائب' : 'Absent'}</Badge>;
      case 'late': return <Badge variant="secondary">{isRTL ? 'متأخر' : 'Late'}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout title={studentName || ''}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{studentName}</h1>
            <p className="text-muted-foreground">{profile?.email}</p>
          </div>
        </div>

        {/* Pending makeup alert */}
        {pendingMakeups.length > 0 && (
          <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
              <p className="text-sm font-medium">
                {isRTL ? `${pendingMakeups.length} سيشن تعويضية تنتظر تأكيدك` : `${pendingMakeups.length} makeup session(s) awaiting your confirmation`}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{attendanceRate}%</p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'نسبة الحضور' : 'Attendance'}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{submissions.length}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'الواجبات' : 'Submissions'}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{payments.length}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'المدفوعات' : 'Payments'}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">
                  {subscription ? (isRTL ? 'نشط' : 'Active') : (isRTL ? '—' : '—')}
                </p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'الاشتراك' : 'Subscription'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="attendance" dir={isRTL ? 'rtl' : 'ltr'}>
          <ScrollArea className="w-full">
            <TabsList className="inline-flex w-auto min-w-full">
              <TabsTrigger value="attendance">{isRTL ? 'الحضور' : 'Attendance'}</TabsTrigger>
              <TabsTrigger value="grades">{isRTL ? 'الدرجات' : 'Grades'}</TabsTrigger>
              <TabsTrigger value="quizzes">{isRTL ? 'الكويزات' : 'Quizzes'}</TabsTrigger>
              <TabsTrigger value="certificates">{isRTL ? 'الشهادات' : 'Certificates'}</TabsTrigger>
              <TabsTrigger value="makeup" className="relative">
                {isRTL ? 'التعويضية' : 'Makeup'}
                {pendingMakeups.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-yellow-500 text-[10px] text-white flex items-center justify-center">{pendingMakeups.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="payments">{isRTL ? 'المدفوعات' : 'Payments'}</TabsTrigger>
              <TabsTrigger value="subscription">{isRTL ? 'الاشتراك' : 'Subscription'}</TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="mt-4">
            <Card>
              <CardHeader><CardTitle>{isRTL ? 'سجل الحضور' : 'Attendance Record'}</CardTitle></CardHeader>
              <CardContent>
                {attendance.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{isRTL ? 'لا توجد سجلات حضور' : 'No attendance records'}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                        <TableHead>{isRTL ? 'المجموعة' : 'Group'}</TableHead>
                        <TableHead>{isRTL ? 'السيشن' : 'Session'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.map(record => (
                        <TableRow key={record.id}>
                          <TableCell>
                            {record.sessions?.session_date
                              ? format(new Date(record.sessions.session_date), 'dd MMM yyyy', { locale: isRTL ? ar : undefined })
                              : '—'}
                          </TableCell>
                          <TableCell>{isRTL ? record.sessions?.groups?.name_ar : record.sessions?.groups?.name}</TableCell>
                          <TableCell>#{record.sessions?.session_number || '—'}</TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Grades Tab */}
          <TabsContent value="grades" className="mt-4">
            <Card>
              <CardHeader><CardTitle>{isRTL ? 'درجات الواجبات' : 'Assignment Grades'}</CardTitle></CardHeader>
              <CardContent>
                {submissions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{isRTL ? 'لا توجد درجات' : 'No grades yet'}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'الواجب' : 'Assignment'}</TableHead>
                        <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                        <TableHead>{isRTL ? 'الدرجة' : 'Score'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map(sub => (
                        <TableRow key={sub.id}>
                          <TableCell>{isRTL ? sub.assignments?.title_ar : sub.assignments?.title}</TableCell>
                          <TableCell>{format(new Date(sub.submitted_at), 'dd MMM yyyy', { locale: isRTL ? ar : undefined })}</TableCell>
                          <TableCell>{sub.score !== null ? `${sub.score}/${sub.assignments?.max_score || '—'}` : '—'}</TableCell>
                          <TableCell>
                            <Badge variant={sub.status === 'graded' ? 'default' : 'secondary'}>
                              {sub.status === 'graded' ? (isRTL ? 'مُقيّم' : 'Graded') : sub.status === 'submitted' ? (isRTL ? 'مُرسل' : 'Submitted') : sub.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quizzes Tab */}
          <TabsContent value="quizzes" className="mt-4">
            <Card>
              <CardHeader><CardTitle>{isRTL ? 'نتائج الكويزات' : 'Quiz Results'}</CardTitle></CardHeader>
              <CardContent>
                {quizResults.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{isRTL ? 'لا توجد نتائج كويزات' : 'No quiz results'}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'الكويز' : 'Quiz'}</TableHead>
                        <TableHead>{isRTL ? 'الدرجة' : 'Score'}</TableHead>
                        <TableHead>{isRTL ? 'النسبة' : 'Percentage'}</TableHead>
                        <TableHead>{isRTL ? 'النتيجة' : 'Result'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quizResults.map((qr: any) => {
                        const quiz = qr.quiz_assignments?.quizzes;
                        const pct = qr.total_questions > 0 ? Math.round((qr.score / qr.total_questions) * 100) : 0;
                        const passed = pct >= (quiz?.passing_score || 60);
                        return (
                          <TableRow key={qr.id}>
                            <TableCell>{isRTL ? (quiz?.title_ar || quiz?.title) : quiz?.title}</TableCell>
                            <TableCell>{qr.score}/{qr.total_questions}</TableCell>
                            <TableCell>{pct}%</TableCell>
                            <TableCell>
                              <Badge className={passed ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}>
                                {passed ? (isRTL ? 'ناجح' : 'Passed') : (isRTL ? 'راسب' : 'Failed')}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Certificates Tab */}
          <TabsContent value="certificates" className="mt-4">
            <Card>
              <CardHeader><CardTitle>{isRTL ? 'الشهادات' : 'Certificates'}</CardTitle></CardHeader>
              <CardContent>
                {certificates.length === 0 ? (
                  <div className="text-center py-8">
                    <Award className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">{isRTL ? 'لا توجد شهادات بعد' : 'No certificates yet'}</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {certificates.map((cert: any) => (
                      <Card key={cert.id} className="border">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Award className="h-8 w-8 text-yellow-600" />
                            <div>
                              <p className="font-medium">{cert.level_name_snapshot}</p>
                              <p className="text-xs text-muted-foreground">{cert.certificate_code}</p>
                              <p className="text-xs text-muted-foreground">
                                {cert.issued_at ? format(new Date(cert.issued_at), 'dd MMM yyyy', { locale: isRTL ? ar : undefined }) : ''}
                              </p>
                            </div>
                          </div>
                          {cert.status === 'ready' && cert.storage_path && (
                            <Button size="sm" variant="outline" onClick={() => handleDownloadCertificate(cert)}>
                              <Download className="h-4 w-4 mr-1" />
                              {isRTL ? 'تحميل' : 'Download'}
                            </Button>
                          )}
                          {cert.status === 'pending' && (
                            <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{isRTL ? 'قيد الإعداد' : 'Pending'}</Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Makeup Sessions Tab */}
          <TabsContent value="makeup" className="mt-4">
            <Card>
              <CardHeader><CardTitle>{isRTL ? 'السيشنات التعويضية' : 'Makeup Sessions'}</CardTitle></CardHeader>
              <CardContent>
                {makeupSessions.length === 0 ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">{isRTL ? 'لا توجد سيشنات تعويضية' : 'No makeup sessions'}</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {makeupSessions.map((session: any) => {
                      const groupName = language === 'ar' ? (session.groups?.name_ar || session.groups?.name) : session.groups?.name;
                      const needsAction = session.status === 'scheduled' && session.student_confirmed === null;
                      return (
                        <Card key={session.id} className={needsAction ? 'border-yellow-200 dark:border-yellow-800' : ''}>
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{groupName || '—'}</span>
                                  <Badge variant={session.status === 'completed' ? 'default' : session.status === 'scheduled' ? 'secondary' : 'outline'}>
                                    {session.status === 'pending' ? (isRTL ? 'معلق' : 'Pending') :
                                     session.status === 'scheduled' ? (isRTL ? 'مجدول' : 'Scheduled') :
                                     session.status === 'completed' ? (isRTL ? 'مكتمل' : 'Completed') :
                                     session.status === 'cancelled' ? (isRTL ? 'ملغي' : 'Cancelled') : session.status}
                                  </Badge>
                                  {session.is_free && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{isRTL ? 'مجاني' : 'Free'}</Badge>}
                                </div>
                                {session.scheduled_date && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {session.scheduled_date} {session.scheduled_time}
                                  </p>
                                )}
                                {session.student_confirmed === true && (
                                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{isRTL ? 'مؤكد ✓' : 'Confirmed ✓'}</Badge>
                                )}
                                {session.student_confirmed === false && (
                                  <Badge variant="destructive">{isRTL ? 'مرفوض' : 'Rejected'}</Badge>
                                )}
                              </div>
                              {needsAction && (
                                <div className="flex gap-2 shrink-0">
                                  <Button size="sm" onClick={() => handleMakeupConfirm(session, true)}>
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    {isRTL ? 'تأكيد' : 'Confirm'}
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => handleMakeupConfirm(session, false)}>
                                    <XCircle className="h-4 w-4 mr-1" />
                                    {isRTL ? 'رفض' : 'Reject'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardHeader><CardTitle>{isRTL ? 'سجل المدفوعات' : 'Payment History'}</CardTitle></CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{isRTL ? 'لا توجد مدفوعات' : 'No payments'}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                        <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                        <TableHead>{isRTL ? 'الطريقة' : 'Method'}</TableHead>
                        <TableHead>{isRTL ? 'ملاحظات' : 'Notes'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map(payment => (
                        <TableRow key={payment.id}>
                          <TableCell>{format(new Date(payment.payment_date), 'dd MMM yyyy', { locale: isRTL ? ar : undefined })}</TableCell>
                          <TableCell className="font-semibold">{payment.amount} EGP</TableCell>
                          <TableCell>{payment.payment_method || '—'}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{payment.notes || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="mt-4">
            <Card>
              <CardHeader><CardTitle>{isRTL ? 'تفاصيل الاشتراك' : 'Subscription Details'}</CardTitle></CardHeader>
              <CardContent>
                {!subscription ? (
                  <p className="text-muted-foreground text-center py-8">{isRTL ? 'لا يوجد اشتراك نشط' : 'No active subscription'}</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">{isRTL ? 'الباقة' : 'Plan'}</p>
                        <p className="font-medium">{isRTL ? subscription.pricing_plans?.name_ar : subscription.pricing_plans?.name_en}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{isRTL ? 'المستوى' : 'Level'}</p>
                        <p className="font-medium">{isRTL ? subscription.levels?.name_ar : subscription.levels?.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{isRTL ? 'الحالة' : 'Status'}</p>
                        <Badge variant="default">{isRTL ? 'نشط' : 'Active'}</Badge>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">{isRTL ? 'الإجمالي' : 'Total'}</p>
                        <p className="font-medium">{subscription.total_price} EGP</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{isRTL ? 'المدفوع' : 'Paid'}</p>
                        <p className="font-medium">{subscription.paid_amount || 0} EGP</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{isRTL ? 'المتبقي' : 'Remaining'}</p>
                        <p className="font-medium text-destructive">{(subscription.total_price || 0) - (subscription.paid_amount || 0)} EGP</p>
                      </div>
                    </div>
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
