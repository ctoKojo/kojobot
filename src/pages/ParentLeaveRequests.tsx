import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Calendar, Clock, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/lib/notificationService';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function ParentLeaveRequests() {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ student_id: '', request_type: 'leave' as 'leave' | 'absence_excuse', request_date: '', end_date: '', reason: '', session_id: '' });
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    const [reqRes, childRes] = await Promise.all([
      supabase
        .from('leave_requests')
        .select('*')
        .eq('parent_id', user!.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('parent_students')
        .select('student_id, profiles!parent_students_student_id_fkey(full_name, full_name_ar)')
        .eq('parent_id', user!.id),
    ]);
    setRequests(reqRes.data || []);
    setChildren((childRes.data as any) || []);
    setLoading(false);
  };

  // Fetch upcoming sessions when student changes and type is absence_excuse
  const fetchUpcomingSessions = async (studentId: string) => {
    if (!studentId) { setUpcomingSessions([]); return; }
    setLoadingSessions(true);
    // Get student's active groups
    const { data: gs } = await supabase
      .from('group_students')
      .select('group_id')
      .eq('student_id', studentId)
      .eq('is_active', true);
    
    if (!gs?.length) { setUpcomingSessions([]); setLoadingSessions(false); return; }

    const today = new Date().toISOString().split('T')[0];
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, session_date, session_time, content_number, session_number, group_id, groups(name, name_ar)')
      .in('group_id', gs.map(g => g.group_id))
      .gte('session_date', today)
      .eq('status', 'scheduled')
      .order('session_date', { ascending: true })
      .limit(20);

    setUpcomingSessions(sessions || []);
    setLoadingSessions(false);
  };

  useEffect(() => {
    if (form.request_type === 'absence_excuse' && form.student_id) {
      fetchUpcomingSessions(form.student_id);
    }
  }, [form.student_id, form.request_type]);

  const handleSubmit = async () => {
    if (form.request_type === 'absence_excuse') {
      if (!form.student_id || !form.session_id || !form.reason) {
        toast({ variant: 'destructive', title: isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields' });
        return;
      }
    } else {
      if (!form.student_id || !form.request_date || !form.reason) {
        toast({ variant: 'destructive', title: isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields' });
        return;
      }
      // Prevent today or past dates for leave requests
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const fromDate = new Date(form.request_date + 'T00:00:00');
      if (fromDate <= today) {
        toast({ variant: 'destructive', title: isRTL ? 'تاريخ الإجازة يجب أن يكون بعد اليوم' : 'Leave date must be after today' });
        return;
      }
      if (form.end_date) {
        const toDate = new Date(form.end_date + 'T00:00:00');
        if (toDate <= today) {
          toast({ variant: 'destructive', title: isRTL ? 'تاريخ النهاية يجب أن يكون بعد اليوم' : 'End date must be after today' });
          return;
        }
        if (toDate < fromDate) {
          toast({ variant: 'destructive', title: isRTL ? 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' : 'End date must be after start date' });
          return;
        }
      }
    }
    setSubmitting(true);
    try {
      // For absence excuse, get date from the selected session
      let requestDate = form.request_date;
      if (form.request_type === 'absence_excuse') {
        const selectedSession = upcomingSessions.find(s => s.id === form.session_id);
        requestDate = selectedSession?.session_date || form.request_date;
      }

      const { error } = await supabase.from('leave_requests').insert({
        student_id: form.student_id,
        parent_id: user!.id,
        request_type: form.request_type,
        request_date: requestDate,
        end_date: form.request_type === 'leave' ? (form.end_date || null) : null,
        session_id: form.request_type === 'absence_excuse' ? form.session_id : null,
        reason: form.reason,
      } as any);
      if (error) throw error;

      // Get student name for notification
      const child = children.find((c: any) => c.student_id === form.student_id);
      const studentName = isRTL
        ? (child?.profiles?.full_name_ar || child?.profiles?.full_name)
        : child?.profiles?.full_name;

      // Notify admins and reception
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'reception']);

      if (adminRoles) {
        for (const admin of adminRoles) {
          const typeLabel = form.request_type === 'leave' ? 'Leave' : 'Absence Excuse';
          const typeLabelAr = form.request_type === 'leave' ? 'إجازة' : 'عذر غياب';
          await notificationService.create({
            user_id: admin.user_id,
            title: `New ${typeLabel} Request`,
            title_ar: `طلب ${typeLabelAr} جديد`,
            message: `${typeLabel} request for "${studentName}" on ${form.request_date}`,
            message_ar: `طلب ${typeLabelAr} للطالب "${studentName}" بتاريخ ${form.request_date}`,
            type: 'info',
            category: 'leave_request',
            action_url: '/leave-requests',
          });
        }
      }

      toast({ title: isRTL ? 'تم إرسال الطلب' : 'Request Submitted' });
      setDialogOpen(false);
      setForm({ student_id: '', request_type: 'leave', request_date: '', end_date: '', reason: '', session_id: '' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">{isRTL ? 'معلق' : 'Pending'}</Badge>;
      case 'approved': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{isRTL ? 'موافق' : 'Approved'}</Badge>;
      case 'rejected': return <Badge variant="destructive">{isRTL ? 'مرفوض' : 'Rejected'}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getChildName = (studentId: string) => {
    const child = children.find((c: any) => c.student_id === studentId);
    return isRTL
      ? (child?.profiles?.full_name_ar || child?.profiles?.full_name || '—')
      : (child?.profiles?.full_name || '—');
  };

  return (
    <DashboardLayout title={isRTL ? 'طلبات الإجازة والأعذار' : 'Leave & Absence Requests'}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">{isRTL ? 'طلبات الإجازة والأعذار' : 'Leave & Absence Requests'}</h2>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {isRTL ? 'طلب جديد' : 'New Request'}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-3">
          {[
            { label: isRTL ? 'معلق' : 'Pending', value: requests.filter(r => r.status === 'pending').length, icon: AlertTriangle, color: 'text-yellow-600' },
            { label: isRTL ? 'موافق' : 'Approved', value: requests.filter(r => r.status === 'approved').length, icon: CheckCircle, color: 'text-green-600' },
            { label: isRTL ? 'مرفوض' : 'Rejected', value: requests.filter(r => r.status === 'rejected').length, icon: XCircle, color: 'text-red-600' },
          ].map((stat, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-3">
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
                <div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Requests List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
            ) : requests.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{isRTL ? 'لا توجد طلبات' : 'No requests yet'}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                     <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                     <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                     <TableHead>{isRTL ? 'السبب' : 'Reason'}</TableHead>
                     <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                     <TableHead>{isRTL ? 'ملاحظات الإدارة' : 'Admin Notes'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map(req => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{getChildName(req.student_id)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {req.request_type === 'absence_excuse' ? (isRTL ? 'عذر غياب' : 'Absence Excuse') : (isRTL ? 'إجازة' : 'Leave')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {req.request_date}
                          {req.end_date && ` → ${req.end_date}`}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{req.reason}</TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground">{req.admin_notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* New Request Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? 'طلب جديد' : 'New Request'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Request Type */}
              <div>
                <Label>{isRTL ? 'نوع الطلب' : 'Request Type'}</Label>
                <Select value={form.request_type} onValueChange={(v: 'leave' | 'absence_excuse') => setForm(f => ({ ...f, request_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leave">{isRTL ? 'طلب إجازة' : 'Leave Request'}</SelectItem>
                    <SelectItem value="absence_excuse">{isRTL ? 'عذر غياب' : 'Absence Excuse'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{isRTL ? 'الطالب' : 'Student'}</Label>
                <Select value={form.student_id} onValueChange={v => setForm(f => ({ ...f, student_id: v, session_id: '' }))}>
                  <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر الطالب' : 'Select student'} /></SelectTrigger>
                  <SelectContent>
                    {children.map((child: any) => (
                      <SelectItem key={child.student_id} value={child.student_id}>
                        {isRTL ? (child.profiles?.full_name_ar || child.profiles?.full_name) : child.profiles?.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Leave: date range */}
              {form.request_type === 'leave' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{isRTL ? 'من تاريخ' : 'From Date'}</Label>
                    <Input type="date" value={form.request_date} onChange={e => setForm(f => ({ ...f, request_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>{isRTL ? 'إلى تاريخ (اختياري)' : 'To Date (optional)'}</Label>
                    <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>
              )}

              {/* Absence excuse: session dropdown */}
              {form.request_type === 'absence_excuse' && form.student_id && (
                <div>
                  <Label>{isRTL ? 'اختر الجلسة' : 'Select Session'}</Label>
                  {loadingSessions ? (
                    <p className="text-sm text-muted-foreground py-2">{isRTL ? 'جاري تحميل الجلسات...' : 'Loading sessions...'}</p>
                  ) : upcomingSessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">{isRTL ? 'لا توجد جلسات قادمة' : 'No upcoming sessions'}</p>
                  ) : (
                    <Select value={form.session_id} onValueChange={v => setForm(f => ({ ...f, session_id: v }))}>
                      <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر جلسة' : 'Select a session'} /></SelectTrigger>
                      <SelectContent>
                        {upcomingSessions.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.session_date} — {isRTL ? (s.groups?.name_ar || s.groups?.name) : s.groups?.name} ({isRTL ? `محتوى ${s.content_number}` : `Content ${s.content_number}`})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* 24h Warning */}
              {(() => {
                let checkDate = '';
                if (form.request_type === 'leave' && form.request_date) {
                  checkDate = form.request_date;
                } else if (form.request_type === 'absence_excuse' && form.session_id) {
                  const s = upcomingSessions.find(s => s.id === form.session_id);
                  checkDate = s?.session_date || '';
                }
                if (!checkDate) return null;
                const requestDate = new Date(checkDate + 'T00:00:00');
                const now = new Date();
                const hoursUntil = (requestDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                if (hoursUntil < 24 && hoursUntil > -24) {
                  return (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {isRTL
                          ? 'يُنصح بتقديم الطلب قبل موعد الجلسة بـ 24 ساعة على الأقل لضمان المعالجة في الوقت المناسب.'
                          : 'It is recommended to submit requests at least 24 hours before the session for timely processing.'}
                      </AlertDescription>
                    </Alert>
                  );
                }
                return null;
              })()}

              <div>
                <Label>{isRTL ? 'السبب' : 'Reason'}</Label>
                <Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder={isRTL ? 'اكتب السبب...' : 'Write the reason...'} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (isRTL ? 'جاري الإرسال...' : 'Submitting...') : (isRTL ? 'إرسال الطلب' : 'Submit')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
