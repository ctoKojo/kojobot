import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

interface PaymentTrackerTabProps {
  selectedMonth?: string; // 'YYYY-MM' — overrides "this month"
}

export function PaymentTrackerTab({ selectedMonth }: PaymentTrackerTabProps = {}) {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const fetchData = async (): Promise<EnrichedSub[]> => {
    // Get active subscriptions with remaining > 0 or installment type
    const { data: subsData } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .not('next_payment_date', 'is', null);

    if (!subsData || subsData.length === 0) {
      return [];
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

    const latestPaymentMap = new Map<string, string>();
    (paymentsRes.data || []).forEach((p: any) => {
      if (!latestPaymentMap.has(p.subscription_id)) {
        latestPaymentMap.set(p.subscription_id, p.payment_date);
      }
    });

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
    return subsData.map((s: any) => {
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
  };

  const { data: subs = [], isLoading: loading } = useQuery({
    queryKey: ['payment-tracker'],
    queryFn: fetchData,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  // Anchor month: selectedMonth (calendar) or "now"
  const anchor = useMemo(() => {
    if (selectedMonth) {
      const [y, m] = selectedMonth.split('-').map(Number);
      return new Date(y, m - 1, 15); // mid-month for safety
    }
    return new Date();
  }, [selectedMonth]);
  const now = anchor;
  const realNow = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const fifteenDaysLater = new Date(realNow.getTime() + 15 * 24 * 60 * 60 * 1000);

  const dueThisMonth = useMemo(() => subs.filter(s => {
    if (!s.next_payment_date) return false;
    const npd = new Date(s.next_payment_date);
    return npd >= thisMonthStart && npd <= thisMonthEnd;
  }).sort((a, b) => new Date(a.next_payment_date!).getTime() - new Date(b.next_payment_date!).getTime()), [subs, anchor]);

  const dueNextMonth = useMemo(() => subs.filter(s => {
    if (!s.next_payment_date) return false;
    const npd = new Date(s.next_payment_date);
    return npd >= nextMonthStart && npd <= nextMonthEnd;
  }).sort((a, b) => new Date(a.next_payment_date!).getTime() - new Date(b.next_payment_date!).getTime()), [subs, anchor]);

  const expiringSoon = useMemo(() => subs.filter(s => {
    if (!s.end_date) return false;
    const ed = new Date(s.end_date);
    return ed >= realNow && ed <= fifteenDaysLater;
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
      // Use atomic RPC to prevent double payments from concurrent admins
      const { data: result, error } = await supabase.rpc('record_payment_atomic', {
        p_subscription_id: selectedSub.id,
        p_student_id: selectedSub.student_id,
        p_amount: paymentAmount,
        p_payment_method: paymentMethod,
        p_payment_date: paymentDate,
        p_payment_type: 'regular',
        p_notes: paymentNotes || null,
        p_recorded_by: user?.id || null,
      });

      if (error) throw error;
      const res = result as any;
      if (res?.error) throw new Error(res.error);

      await notificationService.notifyPaymentRecorded(selectedSub.student_id, paymentAmount, Math.max(0, res.new_remaining));

      toast({ title: isRTL ? 'تم تسجيل الدفعة بنجاح' : 'Payment recorded successfully' });
      setPaymentDialog(false);
      queryClient.invalidateQueries({ queryKey: ['payment-tracker'] });
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
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead className="font-semibold">{isRTL ? 'الطالب' : 'Student'}</TableHead>
              <TableHead className="font-semibold">{isRTL ? 'الباقة' : 'Plan'}</TableHead>
              <TableHead className="font-semibold">{isRTL ? 'نوع الدفع' : 'Type'}</TableHead>
              <TableHead className="font-semibold">{isRTL ? 'القسط' : 'Installment'}</TableHead>
              <TableHead className="font-semibold">{isRTL ? 'تاريخ الاستحقاق' : 'Due Date'}</TableHead>
              <TableHead className="font-semibold">{isRTL ? 'آخر دفعة' : 'Last Payment'}</TableHead>
              <TableHead className="font-semibold">{isRTL ? 'الحالة' : 'Status'}</TableHead>
              <TableHead className="font-semibold">{isRTL ? 'إجراء' : 'Action'}</TableHead>
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
                      <CreditCard className="h-3 w-3 me-1" />{isRTL ? 'دفعة' : 'Pay'}
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
        {[
          { label: isRTL ? 'مستحق هذا الشهر' : 'Due This Month', value: dueThisMonth.length, sub: `${thisMonthTotal} ${isRTL ? 'ج.م' : 'EGP'}`, icon: CalendarClock, gradient: 'from-amber-500 to-orange-500', subColor: 'text-amber-600' },
          { label: isRTL ? 'مستحق الشهر القادم' : 'Due Next Month', value: dueNextMonth.length, sub: `${nextMonthTotal} ${isRTL ? 'ج.م' : 'EGP'}`, icon: CalendarCheck, gradient: 'from-blue-500 to-blue-600', subColor: 'text-blue-600' },
          { label: isRTL ? 'تنتهي خلال 15 يوم' : 'Expiring in 15 days', value: expiringSoon.length, sub: null, icon: AlertTriangle, gradient: 'from-orange-500 to-red-500', subColor: '' },
          { label: isRTL ? 'موقوفين' : 'Suspended', value: suspendedCount, sub: null, icon: Ban, gradient: 'from-red-500 to-red-600', subColor: '' },
        ].map(stat => (
          <Card key={stat.label} className="relative overflow-hidden hover:shadow-md transition-all duration-300">
            <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  {stat.sub && <p className={`text-xs font-medium ${stat.subColor}`}>{stat.sub}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Due This Month */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b bg-muted/30"><CardTitle className="text-base">{isRTL ? 'مستحق هذا الشهر' : 'Due This Month'}</CardTitle></CardHeader>
        <CardContent className="p-0">{renderDueTable(dueThisMonth, thisMonthPage, setThisMonthPage)}</CardContent>
      </Card>

      {/* Due Next Month */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b bg-muted/30"><CardTitle className="text-base">{isRTL ? 'مستحق الشهر القادم' : 'Due Next Month'}</CardTitle></CardHeader>
        <CardContent className="p-0">{renderDueTable(dueNextMonth, nextMonthPage, setNextMonthPage)}</CardContent>
      </Card>

      {/* Expiring Soon */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b bg-muted/30"><CardTitle className="text-base">{isRTL ? 'اشتراكات تنتهي قريباً' : 'Expiring Soon'}</CardTitle></CardHeader>
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
                        <ExternalLink className="h-3 w-3 me-1" />{isRTL ? 'بروفايل' : 'Profile'}
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
