import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, AlertTriangle, Calendar, Filter } from 'lucide-react';
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

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!reviewDialog) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString(), admin_notes: adminNotes || null })
        .eq('id', reviewDialog.id);
      if (error) throw error;

      // Notify parent
      await notificationService.create({
        user_id: reviewDialog.parent_id,
        title: status === 'approved' ? 'Leave Request Approved' : 'Leave Request Rejected',
        title_ar: status === 'approved' ? 'تمت الموافقة على طلب الإجازة' : 'تم رفض طلب الإجازة',
        message: `Your leave request for ${reviewDialog.request_date} has been ${status}`,
        message_ar: `طلب الإجازة بتاريخ ${reviewDialog.request_date} تم ${status === 'approved' ? 'الموافقة عليه' : 'رفضه'}`,
        type: status === 'approved' ? 'success' : 'warning',
        category: 'leave_request',
        action_url: '/parent-leave-requests',
      });

      toast({ title: isRTL ? 'تم التحديث' : 'Updated' });
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

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  return (
    <DashboardLayout title={isRTL ? 'طلبات الإجازة' : 'Leave Requests'}>
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
              <DialogTitle>{isRTL ? 'مراجعة طلب الإجازة' : 'Review Leave Request'}</DialogTitle>
            </DialogHeader>
            {reviewDialog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">{isRTL ? 'الطالب:' : 'Student:'}</span> <span className="font-medium">{getName(reviewDialog.student_id)}</span></div>
                  <div><span className="text-muted-foreground">{isRTL ? 'ولي الأمر:' : 'Parent:'}</span> <span className="font-medium">{getName(reviewDialog.parent_id)}</span></div>
                  <div><span className="text-muted-foreground">{isRTL ? 'التاريخ:' : 'Date:'}</span> {reviewDialog.request_date}{reviewDialog.end_date && ` → ${reviewDialog.end_date}`}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{isRTL ? 'السبب:' : 'Reason:'}</p>
                  <p className="text-sm bg-muted p-3 rounded">{reviewDialog.reason}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{isRTL ? 'ملاحظات (اختياري):' : 'Notes (optional):'}</p>
                  <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder={isRTL ? 'أضف ملاحظة...' : 'Add a note...'} />
                </div>
              </div>
            )}
            <DialogFooter className="flex gap-2">
              <Button variant="destructive" onClick={() => handleReview('rejected')} disabled={submitting}>
                <XCircle className="h-4 w-4 mr-1" />
                {isRTL ? 'رفض' : 'Reject'}
              </Button>
              <Button onClick={() => handleReview('approved')} disabled={submitting}>
                <CheckCircle className="h-4 w-4 mr-1" />
                {isRTL ? 'موافقة' : 'Approve'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
