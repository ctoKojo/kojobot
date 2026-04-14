import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, AlertTriangle, Calendar, Filter, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/lib/notificationService';

export default function LeaveRequests() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [reviewDialog, setReviewDialog] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setRequests(data || []);
    setLoading(false);
  };

  // Fetch student and parent names
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  useEffect(() => {
    if (requests.length === 0) return;
    const ids = [...new Set([...requests.map(r => r.student_id), ...requests.map(r => r.parent_id)])];
    supabase.from('profiles').select('user_id, full_name, full_name_ar').in('user_id', ids).then(({ data }) => {
      const map: Record<string, any> = {};
      data?.forEach(p => { map[p.user_id] = p; });
      setProfiles(map);
    });
  }, [requests]);

  const getName = (id: string) => {
    const p = profiles[id];
    if (!p) return '—';
    return isRTL ? (p.full_name_ar || p.full_name) : p.full_name;
  };

  const createMakeupSessionsForLeave = async (req: any) => {
    // If absence_excuse with specific session_id, just create one makeup
    if (req.request_type === 'absence_excuse' && req.session_id) {
      const { data: session } = await supabase
        .from('sessions')
        .select('id, group_id, groups(attendance_mode, session_link)')
        .eq('id', req.session_id)
        .maybeSingle();
      
      if (!session) return 0;

      const { data: existing } = await supabase
        .from('makeup_sessions')
        .select('id')
        .eq('student_id', req.student_id)
        .eq('original_session_id', session.id)
        .maybeSingle();

      if (existing) return 0;

      const group = session.groups as any;
      const { error } = await supabase.from('makeup_sessions').insert({
        student_id: req.student_id,
        group_id: session.group_id,
        original_session_id: session.id,
        reason: isRTL ? 'عذر غياب معتمد' : 'Approved absence excuse',
        status: 'pending',
        attendance_mode: group?.attendance_mode || 'offline',
        session_link: group?.session_link || null,
      } as any);

      return error ? 0 : 1;
    }

    // Leave request: find sessions in date range
    const { data: groupStudents } = await supabase
      .from('group_students')
      .select('group_id, groups(id, name, name_ar, instructor_id, duration_minutes, schedule_day, schedule_time, attendance_mode, session_link)')
      .eq('student_id', req.student_id)
      .eq('is_active', true);

    if (!groupStudents?.length) return 0;

    const startDate = req.request_date;
    const endDate = req.end_date || req.request_date;

    const groupIds = groupStudents.map((gs: any) => gs.group_id);
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, group_id, session_date, session_time, content_number, session_number')
      .in('group_id', groupIds)
      .gte('session_date', startDate)
      .lte('session_date', endDate)
      .in('status', ['scheduled', 'completed']);

    if (!sessions?.length) return 0;

    let created = 0;
    for (const session of sessions) {
      const group = groupStudents.find((gs: any) => gs.group_id === session.group_id)?.groups as any;
      if (!group) continue;

      const { data: existing } = await supabase
        .from('makeup_sessions')
        .select('id')
        .eq('student_id', req.student_id)
        .eq('original_session_id', session.id)
        .maybeSingle();

      if (existing) continue;

      const { error } = await supabase.from('makeup_sessions').insert({
        student_id: req.student_id,
        group_id: session.group_id,
        original_session_id: session.id,
        reason: isRTL ? 'إجازة معتمدة' : 'Approved leave',
        status: 'pending',
        attendance_mode: group.attendance_mode || 'offline',
        session_link: group.session_link || null,
      } as any);

      if (!error) created++;
    }
    return created;
  };

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!reviewDialog) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString(), admin_notes: adminNotes || null })
        .eq('id', reviewDialog.id);
      if (error) throw error;

      // If approved, create makeup sessions
      let makeupCount = 0;
      if (status === 'approved') {
        makeupCount = await createMakeupSessionsForLeave(reviewDialog);
      }

      // Notify parent
      const typeLabel = reviewDialog.request_type === 'absence_excuse' ? 'Absence Excuse' : 'Leave';
      const typeLabelAr = reviewDialog.request_type === 'absence_excuse' ? 'عذر الغياب' : 'الإجازة';
      
      const makeupMsg = makeupCount > 0
        ? (isRTL ? ` وتم إنشاء ${makeupCount} جلسة تعويضية` : ` and ${makeupCount} makeup session(s) created`)
        : '';

      await notificationService.create({
        user_id: reviewDialog.parent_id,
        title: status === 'approved' ? `${typeLabel} Approved` : `${typeLabel} Rejected`,
        title_ar: status === 'approved' ? `تمت الموافقة على ${typeLabelAr}` : `تم رفض ${typeLabelAr}`,
        message: `Your ${typeLabel.toLowerCase()} request for ${reviewDialog.request_date} has been ${status}${makeupMsg}`,
        message_ar: `طلب ${typeLabelAr} بتاريخ ${reviewDialog.request_date} تم ${status === 'approved' ? 'الموافقة عليه' : 'رفضه'}${makeupMsg}`,
        type: status === 'approved' ? 'success' : 'warning',
        category: 'leave_request',
        action_url: '/parent-leave-requests',
      });

      const successMsg = makeupCount > 0
        ? (isRTL ? `تم التحديث وإنشاء ${makeupCount} جلسة تعويضية` : `Updated & created ${makeupCount} makeup session(s)`)
        : (isRTL ? 'تم التحديث' : 'Updated');
      toast({ title: successMsg });
      setReviewDialog(null);
      setAdminNotes('');
      fetchRequests();
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

  const getTypeBadge = (type: string) => {
    return type === 'absence_excuse'
      ? <Badge variant="outline" className="border-orange-300 text-orange-700 dark:text-orange-300">{isRTL ? 'عذر غياب' : 'Absence Excuse'}</Badge>
      : <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-300">{isRTL ? 'إجازة' : 'Leave'}</Badge>;
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  return (
    <DashboardLayout title={isRTL ? 'طلبات الإجازة والأعذار' : 'Leave & Absence Requests'}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            { label: isRTL ? 'الكل' : 'All', value: requests.length, icon: Calendar, color: 'text-blue-600' },
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

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
              <SelectItem value="pending">{isRTL ? 'معلق' : 'Pending'}</SelectItem>
              <SelectItem value="approved">{isRTL ? 'موافق' : 'Approved'}</SelectItem>
              <SelectItem value="rejected">{isRTL ? 'مرفوض' : 'Rejected'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{isRTL ? 'لا توجد طلبات' : 'No requests'}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'ولي الأمر' : 'Parent'}</TableHead>
                    <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                    <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                    <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{isRTL ? 'السبب' : 'Reason'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{isRTL ? 'إجراء' : 'Action'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(req => (
                    <TableRow key={req.id}>
                      <TableCell>{getName(req.parent_id)}</TableCell>
                      <TableCell className="font-medium">{getName(req.student_id)}</TableCell>
                      <TableCell>{getTypeBadge(req.request_type || 'leave')}</TableCell>
                      <TableCell>
                        {req.request_date}
                        {req.end_date && ` → ${req.end_date}`}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{req.reason}</TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                      <TableCell>
                        {req.status === 'pending' && (
                          <Button size="sm" variant="outline" onClick={() => { setReviewDialog(req); setAdminNotes(''); }}>
                            {isRTL ? 'مراجعة' : 'Review'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Review Dialog */}
        <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? 'مراجعة الطلب' : 'Review Request'}</DialogTitle>
            </DialogHeader>
            {reviewDialog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">{isRTL ? 'الطالب:' : 'Student:'}</span> <span className="font-medium">{getName(reviewDialog.student_id)}</span></div>
                  <div><span className="text-muted-foreground">{isRTL ? 'ولي الأمر:' : 'Parent:'}</span> <span className="font-medium">{getName(reviewDialog.parent_id)}</span></div>
                  <div><span className="text-muted-foreground">{isRTL ? 'النوع:' : 'Type:'}</span> {getTypeBadge(reviewDialog.request_type || 'leave')}</div>
                  <div><span className="text-muted-foreground">{isRTL ? 'التاريخ:' : 'Date:'}</span> {reviewDialog.request_date}{reviewDialog.end_date && ` → ${reviewDialog.end_date}`}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{isRTL ? 'السبب:' : 'Reason:'}</p>
                  <p className="text-sm bg-muted p-3 rounded">{reviewDialog.reason}</p>
                </div>
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  {isRTL
                    ? '⚡ في حالة الموافقة، سيتم تلقائياً إنشاء جلسات تعويضية للسيشنات خلال فترة الإجازة/العذر.'
                    : '⚡ On approval, makeup sessions will be auto-created for sessions during the leave/excuse period.'}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{isRTL ? 'ملاحظات (اختياري):' : 'Notes (optional):'}</p>
                  <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder={isRTL ? 'أضف ملاحظة...' : 'Add a note...'} />
                </div>
              </div>
            )}
            <DialogFooter className="flex gap-2">
              <Button variant="destructive" onClick={() => handleReview('rejected')} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                {isRTL ? 'رفض' : 'Reject'}
              </Button>
              <Button onClick={() => handleReview('approved')} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                {isRTL ? 'موافقة' : 'Approve'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
