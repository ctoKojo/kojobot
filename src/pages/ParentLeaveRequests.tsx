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
import { Plus, Calendar, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
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
  const [form, setForm] = useState({ student_id: '', request_date: '', end_date: '', reason: '' });

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

  const handleSubmit = async () => {
    if (!form.student_id || !form.request_date || !form.reason) {
      toast({ variant: 'destructive', title: isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('leave_requests').insert({
        student_id: form.student_id,
        parent_id: user!.id,
        request_date: form.request_date,
        end_date: form.end_date || null,
        reason: form.reason,
      });
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
          await notificationService.create({
            user_id: admin.user_id,
            title: 'New Leave Request',
            title_ar: 'طلب إجازة جديد',
            message: `Leave request for "${studentName}" on ${form.request_date}`,
            message_ar: `طلب إجازة للطالب "${studentName}" بتاريخ ${form.request_date}`,
            type: 'info',
            category: 'leave_request',
            action_url: '/leave-requests',
          });
        }
      }

      toast({ title: isRTL ? 'تم إرسال الطلب' : 'Request Submitted' });
      setDialogOpen(false);
      setForm({ student_id: '', request_date: '', end_date: '', reason: '' });
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
    <DashboardLayout title={isRTL ? 'طلبات الإجازة' : 'Leave Requests'}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">{isRTL ? 'طلبات الإجازة' : 'Leave Requests'}</h2>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {isRTL ? 'طلب إجازة جديد' : 'New Leave Request'}
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
              <DialogTitle>{isRTL ? 'طلب إجازة جديد' : 'New Leave Request'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{isRTL ? 'الطالب' : 'Student'}</Label>
                <Select value={form.student_id} onValueChange={v => setForm(f => ({ ...f, student_id: v }))}>
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
              <div>
                <Label>{isRTL ? 'السبب' : 'Reason'}</Label>
                <Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder={isRTL ? 'اكتب سبب الإجازة...' : 'Write the reason...'} />
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
