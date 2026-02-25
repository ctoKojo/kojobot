import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { CalendarClock, CalendarCheck, AlertTriangle, Ban, CreditCard, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/timeUtils';
import { notificationService } from '@/lib/notificationService';

interface EnrichedSub {
  id: string;
  student_id: string;
  pricing_plan_id: string;
  payment_type: string;
  start_date: string | null;
  end_date: string | null;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  installment_amount: number | null;
  next_payment_date: string | null;
  is_suspended: boolean;
  status: string;
  profile?: { full_name: string; full_name_ar: string | null };
  plan?: { name: string; name_ar: string };
  lastPaymentDate?: string | null;
  paymentStatus?: 'paid' | 'overdue' | 'upcoming';
}

export function PaymentTrackerTab() {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<EnrichedSub[]>([]);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [selectedSub, setSelectedSub] = useState<EnrichedSub | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  // Pagination
  const [thisMonthPage, setThisMonthPage] = useState(1);
  const [nextMonthPage, setNextMonthPage] = useState(1);
  const [expiringPage, setExpiringPage] = useState(1);
  const pageSize = 10;

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get active subscriptions with remaining > 0 or installment type
      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('status', 'active')
        .not('next_payment_date', 'is', null);

      if (!subsData || subsData.length === 0) {
        setSubs([]);
        setLoading(false);
        return;
      }

      const studentIds = [...new Set(subsData.map((s: any) => s.student_id))];
      const planIds = [...new Set(subsData.map((s: any) => s.pricing_plan_id))];
      const subIds = subsData.map((s: any) => s.id);

      const [profilesRes, plansRes, paymentsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, full_name_ar').in('user_id', studentIds),
        supabase.from('pricing_plans').select('id, name, name_ar').in('id', planIds),
        supabase.from('payments').select('subscription_id, payment_date').in('subscription_id', subIds).order('payment_date', { ascending: false }),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));
      const planMap = new Map((plansRes.data || []).map((p: any) => [p.id, p]));

      // Group payments by subscription, get latest payment_date per sub
      const latestPaymentMap = new Map<string, string>();
      (paymentsRes.data || []).forEach((p: any) => {
        if (!latestPaymentMap.has(p.subscription_id)) {
          latestPaymentMap.set(p.subscription_id, p.payment_date);
        }
      });

      // Build payments-in-cycle map for status determination
      const paymentsBySubInCycle = new Map<string, boolean>();
      (paymentsRes.data || []).forEach((p: any) => {
        const sub = subsData.find((s: any) => s.id === p.subscription_id);
        if (sub?.next_payment_date) {
          const npd = new Date(sub.next_payment_date);
          const cycleStart = new Date(npd.getTime() - 30 * 24 * 60 * 60 * 1000);
          const pd = new Date(p.payment_date);
          if (pd >= cycleStart && pd <= npd) {
            paymentsBySubInCycle.set(p.subscription_id, true);
          }
        }
      });

      const today = new Date();
      const enriched: EnrichedSub[] = subsData.map((s: any) => {
        const hasPaidInCycle = paymentsBySubInCycle.get(s.id) || false;
        let paymentStatus: 'paid' | 'overdue' | 'upcoming' = 'upcoming';
        if (hasPaidInCycle) {
          paymentStatus = 'paid';
        } else if (s.next_payment_date && new Date(s.next_payment_date) < today) {
          paymentStatus = 'overdue';
        }

        return {
          ...s,
          profile: profileMap.get(s.student_id),
          plan: planMap.get(s.pricing_plan_id),
          lastPaymentDate: latestPaymentMap.get(s.id) || null,
          paymentStatus,
        };
      });

      setSubs(enriched);
    } catch (e) {
      console.error('PaymentTracker fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const fifteenDaysLater = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  const dueThisMonth = useMemo(() => subs.filter(s => {
    if (!s.next_payment_date) return false;
    const npd = new Date(s.next_payment_date);
    return npd >= thisMonthStart && npd <= thisMonthEnd;
  }).sort((a, b) => new Date(a.next_payment_date!).getTime() - new Date(b.next_payment_date!).getTime()), [subs]);

  const dueNextMonth = useMemo(() => subs.filter(s => {
    if (!s.next_payment_date) return false;
    const npd = new Date(s.next_payment_date);
    return npd >= nextMonthStart && npd <= nextMonthEnd;
  }).sort((a, b) => new Date(a.next_payment_date!).getTime() - new Date(b.next_payment_date!).getTime()), [subs]);

  const expiringSoon = useMemo(() => subs.filter(s => {
    if (!s.end_date) return false;
    const ed = new Date(s.end_date);
    return ed >= now && ed <= fifteenDaysLater;
  }), [subs]);

  const suspendedCount = useMemo(() => subs.filter(s => s.is_suspended).length, [subs]);

  const thisMonthTotal = dueThisMonth.reduce((sum, s) => sum + (s.installment_amount || 0), 0);
  const nextMonthTotal = dueNextMonth.reduce((sum, s) => sum + (s.installment_amount || 0), 0);

  const openPayDialog = (sub: EnrichedSub) => {
    setSelectedSub(sub);
    setPaymentAmount(sub.installment_amount || sub.remaining_amount || 0);
    setPaymentMethod('cash');
    setPaymentNotes('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentDialog(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedSub || paymentAmount <= 0 || saving) return;
    setSaving(true);
    try {
      await supabase.from('payments').insert({
        subscription_id: selectedSub.id,
        student_id: selectedSub.student_id,
        amount: paymentAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        payment_type: 'regular',
        notes: paymentNotes,
        recorded_by: user?.id,
      } as any);

      const newPaid = Number(selectedSub.paid_amount) + paymentAmount;
      const newRemaining = Number(selectedSub.total_amount) - newPaid;

      let nextPaymentDate = selectedSub.next_payment_date;
      if (selectedSub.installment_amount && selectedSub.installment_amount > 0) {
        const installmentsCovered = Math.floor(paymentAmount / selectedSub.installment_amount);
        if (installmentsCovered >= 1 && selectedSub.next_payment_date) {
          const currentNPD = new Date(selectedSub.next_payment_date);
          nextPaymentDate = new Date(currentNPD.getTime() + installmentsCovered * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }
      }
      if (newRemaining <= 0) nextPaymentDate = null;

      await supabase.from('subscriptions').update({
        paid_amount: newPaid,
        next_payment_date: nextPaymentDate,
        is_suspended: false,
      }).eq('id', selectedSub.id);

      await notificationService.notifyPaymentRecorded(selectedSub.student_id, paymentAmount, Math.max(0, newRemaining));

      toast({ title: isRTL ? 'تم تسجيل الدفعة بنجاح' : 'Payment recorded successfully' });
      setPaymentDialog(false);
      fetchData();
    } catch (e: any) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'paid') return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">{isRTL ? 'مدفوع' : 'Paid'}</Badge>;
    if (status === 'overdue') return <Badge variant="destructive">{isRTL ? 'متأخر' : 'Overdue'}</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{isRTL ? 'قادم' : 'Upcoming'}</Badge>;
  };

  const renderDueTable = (data: EnrichedSub[], page: number, setPage: (p: number) => void) => {
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    const paginated = data.slice((page - 1) * pageSize, page * pageSize);

    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
              <TableHead>{isRTL ? 'الباقة' : 'Plan'}</TableHead>
              <TableHead>{isRTL ? 'نوع الدفع' : 'Type'}</TableHead>
              <TableHead>{isRTL ? 'القسط' : 'Installment'}</TableHead>
              <TableHead>{isRTL ? 'تاريخ الاستحقاق' : 'Due Date'}</TableHead>
              <TableHead>{isRTL ? 'آخر دفعة' : 'Last Payment'}</TableHead>
              <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
              <TableHead>{isRTL ? 'إجراء' : 'Action'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map(sub => (
              <TableRow key={sub.id} className={sub.paymentStatus === 'overdue' ? 'bg-destructive/5' : sub.paymentStatus === 'paid' ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}>
                <TableCell>
                  <button className="text-left hover:underline" onClick={() => navigate(`/student/${sub.student_id}`)}>
                    {language === 'ar' ? sub.profile?.full_name_ar || sub.profile?.full_name : sub.profile?.full_name}
                  </button>
                </TableCell>
                <TableCell>{language === 'ar' ? sub.plan?.name_ar : sub.plan?.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{sub.payment_type === 'installment' ? (isRTL ? 'تقسيط' : 'Installment') : (isRTL ? 'كامل' : 'Full')}</Badge>
                </TableCell>
                <TableCell>{sub.installment_amount || '-'} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                <TableCell>{sub.next_payment_date ? formatDate(sub.next_payment_date, language) : '-'}</TableCell>
                <TableCell className="text-muted-foreground">{sub.lastPaymentDate ? formatDate(sub.lastPaymentDate, language) : '-'}</TableCell>
                <TableCell><StatusBadge status={sub.paymentStatus || 'upcoming'} /></TableCell>
                <TableCell>
                  {sub.paymentStatus !== 'paid' && (
                    <Button size="sm" variant="outline" onClick={() => openPayDialog(sub)}>
                      <CreditCard className="h-3 w-3 mr-1" />{isRTL ? 'دفعة' : 'Pay'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data.length === 0 && <p className="text-center text-muted-foreground py-6">{isRTL ? 'لا توجد بيانات' : 'No data'}</p>}
        {data.length > pageSize && (
          <DataTablePagination currentPage={page} totalPages={totalPages} pageSize={pageSize} totalCount={data.length} hasNextPage={page < totalPages} hasPreviousPage={page > 1} onPageChange={setPage} onPageSizeChange={() => {}} />
        )}
      </>
    );
  };

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30"><CalendarClock className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-2xl font-bold">{dueThisMonth.length}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'مستحق هذا الشهر' : 'Due This Month'}</p>
                <p className="text-xs text-amber-600 font-medium">{thisMonthTotal} {isRTL ? 'ج.م' : 'EGP'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><CalendarCheck className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{dueNextMonth.length}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'مستحق الشهر القادم' : 'Due Next Month'}</p>
                <p className="text-xs text-blue-600 font-medium">{nextMonthTotal} {isRTL ? 'ج.م' : 'EGP'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30"><AlertTriangle className="h-5 w-5 text-orange-600" /></div>
              <div>
                <p className="text-2xl font-bold">{expiringSoon.length}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'تنتهي خلال 15 يوم' : 'Expiring in 15 days'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><Ban className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold">{suspendedCount}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'موقوفين' : 'Suspended'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Due This Month */}
      <Card>
        <CardHeader><CardTitle>{isRTL ? 'مستحق هذا الشهر' : 'Due This Month'}</CardTitle></CardHeader>
        <CardContent>{renderDueTable(dueThisMonth, thisMonthPage, setThisMonthPage)}</CardContent>
      </Card>

      {/* Due Next Month */}
      <Card>
        <CardHeader><CardTitle>{isRTL ? 'مستحق الشهر القادم' : 'Due Next Month'}</CardTitle></CardHeader>
        <CardContent>{renderDueTable(dueNextMonth, nextMonthPage, setNextMonthPage)}</CardContent>
      </Card>

      {/* Expiring Soon */}
      <Card>
        <CardHeader><CardTitle>{isRTL ? 'اشتراكات تنتهي قريباً' : 'Expiring Soon'}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                <TableHead>{isRTL ? 'الباقة' : 'Plan'}</TableHead>
                <TableHead>{isRTL ? 'نوع الدفع' : 'Type'}</TableHead>
                <TableHead>{isRTL ? 'تاريخ الانتهاء' : 'End Date'}</TableHead>
                <TableHead>{isRTL ? 'المتبقي مالياً' : 'Remaining'}</TableHead>
                <TableHead>{isRTL ? 'أيام متبقية' : 'Days Left'}</TableHead>
                <TableHead>{isRTL ? 'إجراء' : 'Action'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expiringSoon.slice((expiringPage - 1) * pageSize, expiringPage * pageSize).map(sub => {
                const daysLeft = sub.end_date ? Math.ceil((new Date(sub.end_date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : 0;
                return (
                  <TableRow key={sub.id}>
                    <TableCell>{language === 'ar' ? sub.profile?.full_name_ar || sub.profile?.full_name : sub.profile?.full_name}</TableCell>
                    <TableCell>{language === 'ar' ? sub.plan?.name_ar : sub.plan?.name}</TableCell>
                    <TableCell><Badge variant="outline">{sub.payment_type === 'installment' ? (isRTL ? 'تقسيط' : 'Installment') : (isRTL ? 'كامل' : 'Full')}</Badge></TableCell>
                    <TableCell>{sub.end_date ? formatDate(sub.end_date, language) : '-'}</TableCell>
                    <TableCell className="text-orange-600 font-medium">{sub.remaining_amount} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                    <TableCell><Badge className={daysLeft <= 5 ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-800'}>{daysLeft} {isRTL ? 'يوم' : 'days'}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/student/${sub.student_id}`)}>
                        <ExternalLink className="h-3 w-3 mr-1" />{isRTL ? 'بروفايل' : 'Profile'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {expiringSoon.length === 0 && <p className="text-center text-muted-foreground py-6">{isRTL ? 'لا توجد اشتراكات تنتهي قريباً' : 'No expiring subscriptions'}</p>}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? 'تسجيل دفعة' : 'Record Payment'}</DialogTitle>
          </DialogHeader>
          {selectedSub && (
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg border bg-muted/50">
                <p className="font-medium">{language === 'ar' ? selectedSub.profile?.full_name_ar : selectedSub.profile?.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'المتبقي: ' : 'Remaining: '}{selectedSub.remaining_amount} {isRTL ? 'ج.م' : 'EGP'}
                </p>
              </div>
              <div><Label>{isRTL ? 'المبلغ' : 'Amount'}</Label>
                <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(+e.target.value)} min={0} /></div>
              <div><Label>{isRTL ? 'تاريخ الدفع الفعلي' : 'Actual Payment Date'}</Label>
                <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} max={new Date().toISOString().split('T')[0]} /></div>
              <div><Label>{isRTL ? 'طريقة الدفع' : 'Payment Method'}</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{isRTL ? 'كاش' : 'Cash'}</SelectItem>
                    <SelectItem value="transfer">{isRTL ? 'تحويل بنكي' : 'Bank Transfer'}</SelectItem>
                  </SelectContent>
                </Select></div>
              <div><Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                <Input value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleRecordPayment} disabled={saving}>{saving ? (isRTL ? 'جاري...' : 'Saving...') : (isRTL ? 'تسجيل الدفعة' : 'Record Payment')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
