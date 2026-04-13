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
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, Clock, CreditCard, BookOpen, UserCheck, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

export default function ParentStudentView() {
  const { studentId } = useParams<{ studentId: string }>();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);

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

      // Fetch all data in parallel
      const [profileRes, attendanceRes, submissionsRes, paymentsRes, subRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', studentId).maybeSingle(),
        supabase.from('attendance').select('*, sessions(session_date, session_number, groups(name, name_ar))').eq('student_id', studentId).order('recorded_at', { ascending: false }).limit(50),
        supabase.from('assignment_submissions').select('*, assignments(title, title_ar, max_score)').eq('student_id', studentId).order('submitted_at', { ascending: false }).limit(50),
        supabase.from('payments').select('*').eq('student_id', studentId).order('payment_date', { ascending: false }).limit(50),
        supabase.from('subscriptions').select('*, levels(name, name_ar), pricing_plans(name_en, name_ar)').eq('student_id', studentId).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      setProfile(profileRes.data);
      setAttendance(attendanceRes.data || []);
      setSubmissions(submissionsRes.data || []);
      setPayments(paymentsRes.data || []);
      setSubscription(subRes.data);
      setLoading(false);
    };

    fetchData();
  }, [user, studentId]);

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
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="attendance">{isRTL ? 'الحضور' : 'Attendance'}</TabsTrigger>
            <TabsTrigger value="grades">{isRTL ? 'الدرجات' : 'Grades'}</TabsTrigger>
            <TabsTrigger value="payments">{isRTL ? 'المدفوعات' : 'Payments'}</TabsTrigger>
            <TabsTrigger value="subscription">{isRTL ? 'الاشتراك' : 'Subscription'}</TabsTrigger>
          </TabsList>

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
                          <TableCell>
                            {isRTL ? record.sessions?.groups?.name_ar : record.sessions?.groups?.name}
                          </TableCell>
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

          <TabsContent value="grades" className="mt-4">
            <Card>
              <CardHeader><CardTitle>{isRTL ? 'درجات الواجبات والكويزات' : 'Assignment & Quiz Grades'}</CardTitle></CardHeader>
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
                          <TableCell>
                            {isRTL ? sub.assignments?.title_ar : sub.assignments?.title}
                          </TableCell>
                          <TableCell>
                            {format(new Date(sub.submitted_at), 'dd MMM yyyy', { locale: isRTL ? ar : undefined })}
                          </TableCell>
                          <TableCell>
                            {sub.score !== null ? `${sub.score}/${sub.assignments?.max_score || '—'}` : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={sub.status === 'graded' ? 'default' : 'secondary'}>
                              {sub.status === 'graded' ? (isRTL ? 'مُقيّم' : 'Graded') :
                               sub.status === 'submitted' ? (isRTL ? 'مُرسل' : 'Submitted') :
                               sub.status}
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
                          <TableCell>
                            {format(new Date(payment.payment_date), 'dd MMM yyyy', { locale: isRTL ? ar : undefined })}
                          </TableCell>
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