import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@/lib/timeUtils';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Users, AlertTriangle, TrendingUp, CreditCard, Ban, Search } from 'lucide-react';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/lib/notificationService';
import { ExpensesTab } from '@/components/finance/ExpensesTab';
import { SalariesTab } from '@/components/finance/SalariesTab';
import { NetProfitTab } from '@/components/finance/NetProfitTab';
import { PaymentTrackerTab } from '@/components/finance/PaymentTrackerTab';
import { CashFlowTab } from '@/components/finance/CashFlowTab';
import { MonthSelector, getCurrentMonthKey, getMonthRange, isCurrentMonth } from '@/components/finance/MonthSelector';
import { PaymentMethodFields, PaymentMethodValue, initialPaymentMethodValue, PaymentMethodFieldsHandle } from '@/components/finance/PaymentMethodFields';
import { ReceiptViewButton } from '@/components/finance/ReceiptViewButton';
import { useRef } from 'react';

export default function Finance() {
  const { isRTL, language } = useLanguage();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethodValue, setPaymentMethodValue] = useState<PaymentMethodValue>(initialPaymentMethodValue);
  const paymentMethodRef = useRef<PaymentMethodFieldsHandle>(null);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportPeriod, setReportPeriod] = useState('6');
  const [reportPlan, setReportPlan] = useState('all');
  const [pricingPlans, setPricingPlans] = useState<any[]>([]);
  const [subPage, setSubPage] = useState(1);
  const [subPageSize, setSubPageSize] = useState(10);
  const [payPage, setPayPage] = useState(1);
  const [payPageSize, setPayPageSize] = useState(10);
  const [detailDialog, setDetailDialog] = useState<'outstanding' | 'overdue' | 'revenue' | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const monthRange = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const viewingCurrentMonth = isCurrentMonth(selectedMonth);

  const fetchFinanceData = async () => {
    const { data: plans } = await supabase.from('pricing_plans').select('id, name, name_ar').eq('is_active', true);
    setPricingPlans(plans || []);

    const { data: subs } = await supabase
      .from('subscriptions')
      .select('*, pricing_plans(name, name_ar, attendance_mode, group_type)')
      .order('created_at', { ascending: false });

    const studentIds = [...new Set((subs || []).map((s: any) => s.student_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, full_name_ar, email, phone')
      .in('user_id', studentIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    const enriched = (subs || []).map((s: any) => ({ ...s, profile: profileMap.get(s.student_id) }));

    const [payRes, expRes, salRes] = await Promise.all([
      supabase.from('payments').select('*, subscriptions(student_id)').order('created_at', { ascending: false }),
      supabase.from('expenses').select('amount, expense_date'),
      supabase.from('salary_payments').select('net_amount, month, status').eq('status', 'paid'),
    ]);

    const payData = payRes.data || [];
    const expData = expRes.data || [];
    const salData = salRes.data || [];

    const active = enriched.filter((s: any) => s.status === 'active');

    // Use SELECTED month range for monthly stats
    const { start: monthStart, end: monthEnd } = monthRange;
    const totalRevenue = payData.reduce((sum: number, p: any) => {
      const pd = new Date(p.payment_date);
      if (pd >= monthStart && pd <= monthEnd) return sum + Number(p.amount || 0);
      return sum;
    }, 0);

    // Selected month expenses
    const thisMonthExpenses = expData.reduce((sum: number, e: any) => {
      const ed = new Date(e.expense_date);
      if (ed >= monthStart && ed <= monthEnd) return sum + Number(e.amount || 0);
      return sum;
    }, 0);

    // Selected month salaries
    const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthSalaries = salData.reduce((sum: number, s: any) => {
      const sd = new Date(s.month);
      const sKey = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}`;
      if (sKey === monthKey) return sum + Number(s.net_amount || 0);
      return sum;
    }, 0);

    const netProfit = totalRevenue - thisMonthExpenses - thisMonthSalaries;
    
    const totalOutstanding = active.reduce((sum: number, s: any) => sum + Number(s.remaining_amount || 0), 0);
    const suspendedCount = active.filter((s: any) => s.is_suspended).length;
    const overdueCount = active.filter((s: any) => s.next_payment_date && new Date(s.next_payment_date) < new Date() && Number(s.remaining_amount) > 0).length;

    // Enrich payments with student profile
    const enrichedPayments = payData.map((p: any) => {
      const studentId = p.subscriptions?.student_id || p.student_id;
      return { ...p, profile: profileMap.get(studentId) };
    });

    return {
      subscriptions: enriched,
      payments: enrichedPayments,
      stats: { totalRevenue, totalOutstanding, activeCount: active.length, suspendedCount, overdueCount, netProfit, thisMonthExpenses, thisMonthSalaries },
    };
  };

  const { data: financeData, isLoading: loading } = useQuery({
    queryKey: ['finance-data', selectedMonth],
    queryFn: fetchFinanceData,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const subscriptions = financeData?.subscriptions || [];
  const payments = financeData?.payments || [];
  const stats = financeData?.stats || { totalRevenue: 0, totalOutstanding: 0, activeCount: 0, suspendedCount: 0, overdueCount: 0, netProfit: 0, thisMonthExpenses: 0, thisMonthSalaries: 0 };

  // Build filtered monthly data based on reportPeriod and reportPlan
  const filteredMonthlyData = useMemo(() => {
    const periodMonths = Number(reportPeriod);
    
    // Filter payments by plan if needed
    const filteredPayments = reportPlan === 'all' ? payments : payments.filter((p: any) => {
      const sub = subscriptions.find((s: any) => s.id === p.subscription_id);
      return sub?.pricing_plan_id === reportPlan;
    });

    // Filter subscriptions by plan
    const filteredSubs = reportPlan === 'all' 
      ? subscriptions.filter((s: any) => s.status === 'active')
      : subscriptions.filter((s: any) => s.status === 'active' && s.pricing_plan_id === reportPlan);

    const monthlyMap = new Map<string, { revenue: number; count: number }>();
    filteredPayments.forEach((p: any) => {
      const d = new Date(p.payment_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthlyMap.get(key) || { revenue: 0, count: 0 };
      monthlyMap.set(key, { revenue: existing.revenue + Number(p.amount), count: existing.count + 1 });
    });

    const now = new Date();
    const months: any[] = [];
    for (let i = periodMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', year: '2-digit' });
      const mp = monthlyMap.get(key) || { revenue: 0, count: 0 };
      const overdueInMonth = filteredSubs.filter((s: any) => {
        if (!s.next_payment_date || Number(s.remaining_amount) <= 0) return false;
        const npd = new Date(s.next_payment_date);
        return npd.getMonth() === d.getMonth() && npd.getFullYear() === d.getFullYear() && npd < now;
      }).length;
      months.push({ month: monthLabel, revenue: mp.revenue, payments: mp.count, overdue: overdueInMonth });
    }
    return months;
  }, [payments, subscriptions, reportPeriod, reportPlan, language]);

  const openPaymentDialog = (sub: any) => {
    setSelectedSub(sub);
    setPaymentAmount(sub.installment_amount || sub.remaining_amount || 0);
    setPaymentMethodValue(initialPaymentMethodValue);
    setPaymentNotes('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentDialog(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedSub || paymentAmount <= 0 || savingPayment) return;
    if (!paymentMethodRef.current?.validate()) return;
    setSavingPayment(true);
    try {
      const wasSuspended = selectedSub.is_suspended;
      const isTransfer = paymentMethodValue.payment_method === 'transfer';

      // 1) Insert payment via RPC (returns payment_id; for transfer status='pending_receipt')
      const { data: result, error } = await (supabase.rpc as any)('record_payment_atomic', {
        p_subscription_id: selectedSub.id,
        p_student_id: selectedSub.student_id,
        p_amount: paymentAmount,
        p_payment_method: paymentMethodValue.payment_method,
        p_payment_date: paymentDate,
        p_payment_type: 'regular',
        p_notes: paymentNotes || null,
        p_recorded_by: user?.id || null,
        p_transfer_type: paymentMethodValue.transfer_type,
      });

      if (error) throw new Error(error.message);
      const res = result as any;
      if (res?.error) throw new Error(res.error);

      // 2) Transfer flow: upload receipt, then attach
      if (isTransfer && res.payment_id) {
        const path = await paymentMethodRef.current!.uploadReceipt('payments', res.payment_id);
        const { error: attachErr } = await (supabase.rpc as any)('attach_payment_receipt', {
          p_payment_id: res.payment_id,
          p_receipt_path: path,
        });
        if (attachErr) throw new Error(attachErr.message);
      }

      await notificationService.notifyPaymentRecorded(selectedSub.student_id, paymentAmount, Math.max(0, res.new_remaining));
      if (wasSuspended) {
        await notificationService.notifyAccountReactivated(selectedSub.student_id);
      }

      toast({ title: isRTL ? 'تم تسجيل الدفعة بنجاح' : 'Payment recorded successfully' });
      setPaymentDialog(false);
      queryClient.invalidateQueries({ queryKey: ['finance-data'] });
      queryClient.invalidateQueries({ queryKey: ['payment-tracker'] });
    } catch (e: any) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingPayment(false);
    }
  };

  const filtered = subscriptions.filter(s => {
    if (filter === 'active') return s.status === 'active' && !s.is_suspended;
    if (filter === 'suspended') return s.is_suspended;
    if (filter === 'overdue') return s.next_payment_date && new Date(s.next_payment_date) < new Date() && Number(s.remaining_amount) > 0;
    if (filter === 'expired') return s.status === 'expired';
    return true;
  }).filter(s => {
    if (!search) return true;
    const name = s.profile?.full_name?.toLowerCase() || '';
    const nameAr = s.profile?.full_name_ar?.toLowerCase() || '';
    return name.includes(search.toLowerCase()) || nameAr.includes(search.toLowerCase());
  });

  // Reset page on filter/search change
  useEffect(() => { setSubPage(1); }, [filter, search]);

  // Detail lists for outstanding / overdue dialogs
  const outstandingStudents = useMemo(() => {
    return subscriptions
      .filter((s: any) => s.status === 'active' && Number(s.remaining_amount) > 0)
      .map((s: any) => ({
        id: s.id,
        student_id: s.student_id,
        name: language === 'ar' ? s.profile?.full_name_ar || s.profile?.full_name : s.profile?.full_name,
        remaining: Number(s.remaining_amount),
        nextPayment: s.next_payment_date,
        planName: language === 'ar' ? s.pricing_plans?.name_ar : s.pricing_plans?.name,
        installment: s.installment_amount,
      }))
      .sort((a: any, b: any) => b.remaining - a.remaining);
  }, [subscriptions, language]);

  const overdueStudents = useMemo(() => {
    const now = new Date();
    return subscriptions
      .filter((s: any) => s.status === 'active' && s.next_payment_date && new Date(s.next_payment_date) < now && Number(s.remaining_amount) > 0)
      .map((s: any) => {
        const dueDate = new Date(s.next_payment_date);
        const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: s.id,
          student_id: s.student_id,
          name: language === 'ar' ? s.profile?.full_name_ar || s.profile?.full_name : s.profile?.full_name,
          remaining: Number(s.remaining_amount),
          nextPayment: s.next_payment_date,
          planName: language === 'ar' ? s.pricing_plans?.name_ar : s.pricing_plans?.name,
          installment: s.installment_amount,
          daysOverdue: diffDays,
        };
      })
      .sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);
  }, [subscriptions, language]);

  // Paginated subscriptions
  const subTotalPages = Math.max(1, Math.ceil(filtered.length / subPageSize));
  const paginatedSubs = filtered.slice((subPage - 1) * subPageSize, subPage * subPageSize);

  // Paginated payments — filtered by selected month
  const monthFilteredPayments = useMemo(() => {
    const { start, end } = monthRange;
    return payments.filter((p: any) => {
      const pd = new Date(p.payment_date);
      return pd >= start && pd <= end;
    });
  }, [payments, monthRange]);
  const payTotalPages = Math.max(1, Math.ceil(monthFilteredPayments.length / payPageSize));
  const paginatedPayments = monthFilteredPayments.slice((payPage - 1) * payPageSize, payPage * payPageSize);

  // formatDate centralized in timeUtils.ts (SSOT)

  return (
    <DashboardLayout title={isRTL ? 'الإدارة المالية' : 'Finance Management'}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{isRTL ? 'الإدارة المالية' : 'Finance Management'}</h1>
              <p className="text-sm text-muted-foreground">{isRTL ? 'إدارة الاشتراكات والمدفوعات والتقارير المالية' : 'Manage subscriptions, payments and financial reports'}</p>
            </div>
          </div>
          {/* Month Selector — controls expenses, salaries, payments, net profit views */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">{isRTL ? 'الشهر المالي' : 'Financial month'}</span>
            <MonthSelector value={selectedMonth} onChange={setSelectedMonth} monthsBack={24} monthsForward={0} />
            {!viewingCurrentMonth && (
              <span className="text-xs text-amber-600 dark:text-amber-400">{isRTL ? 'عرض شهر سابق — العمليات معطلة' : 'Viewing past month — actions disabled'}</span>
            )}
          </div>
        </div>

        {/* Stats — reflect the SELECTED month */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
          {[
            { key: 'revenue', label: isRTL ? `إيرادات ${viewingCurrentMonth ? 'الشهر الحالي' : 'الشهر المختار'}` : `${viewingCurrentMonth ? 'This Month' : 'Selected Month'} Revenue`, value: `${stats.totalRevenue} ${isRTL ? 'ج.م' : 'EGP'}`, icon: TrendingUp, gradient: 'from-emerald-500 to-emerald-600', adminOnly: true, clickable: true },
            { key: 'netprofit', label: isRTL ? 'صافي ربح الشهر' : 'Net Profit', value: `${stats.netProfit} ${isRTL ? 'ج.م' : 'EGP'}`, icon: stats.netProfit >= 0 ? TrendingUp : TrendingUp, gradient: stats.netProfit >= 0 ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600', adminOnly: true, clickable: false },
            { key: 'outstanding', label: isRTL ? 'المبالغ المستحقة' : 'Outstanding', value: `${stats.totalOutstanding} ${isRTL ? 'ج.م' : 'EGP'}`, icon: DollarSign, gradient: 'from-amber-500 to-orange-500', adminOnly: true, clickable: true },
            { key: 'active', label: isRTL ? 'اشتراكات نشطة' : 'Active', value: stats.activeCount, icon: Users, gradient: 'from-blue-500 to-blue-600', adminOnly: false, clickable: false },
            { key: 'overdue', label: isRTL ? 'متأخرين' : 'Overdue', value: stats.overdueCount, icon: AlertTriangle, gradient: 'from-red-500 to-red-600', adminOnly: false, clickable: true },
            { key: 'suspended', label: isRTL ? 'موقوفين' : 'Suspended', value: stats.suspendedCount, icon: Ban, gradient: 'from-gray-500 to-gray-600', adminOnly: false, clickable: false },
          ].filter(stat => !stat.adminOnly || role === 'admin').map(stat => (
            <Card
              key={stat.label}
              className={`relative overflow-hidden hover:shadow-md transition-all duration-300 ${stat.clickable ? 'cursor-pointer hover:ring-2 hover:ring-primary/30' : ''}`}
              onClick={() => {
                if (stat.key === 'outstanding') setDetailDialog('outstanding');
                if (stat.key === 'overdue') setDetailDialog('overdue');
                if (stat.key === 'revenue') setDetailDialog('revenue');
              }}
            >
              <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{loading ? '...' : stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="subscriptions">
          <TabsList className="flex-wrap h-auto gap-1 bg-muted/60 p-1.5 rounded-xl">
            <TabsTrigger value="subscriptions" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2 text-sm">{isRTL ? 'الاشتراكات' : 'Subscriptions'}</TabsTrigger>
            <TabsTrigger value="payments" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2 text-sm">{isRTL ? 'سجل المدفوعات' : 'Payment History'}</TabsTrigger>
            <TabsTrigger value="expenses" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2 text-sm">{isRTL ? 'المصروفات' : 'Expenses'}</TabsTrigger>
            {role === 'admin' && <TabsTrigger value="salaries" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2 text-sm">{isRTL ? 'الرواتب' : 'Salaries'}</TabsTrigger>}
            {role === 'admin' && <TabsTrigger value="profit" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2 text-sm">{isRTL ? 'صافي الربح' : 'Net Profit'}</TabsTrigger>}
            {role === 'admin' && <TabsTrigger value="reports" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2 text-sm">{isRTL ? 'التقارير' : 'Reports'}</TabsTrigger>}
            <TabsTrigger value="tracker" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2 text-sm">{isRTL ? 'متابعة الأقساط' : 'Payment Tracker'}</TabsTrigger>
            {role === 'admin' && <TabsTrigger value="cashflow" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2 text-sm">{isRTL ? 'التدفق النقدي' : 'Cash Flow'}</TabsTrigger>}
          </TabsList>

          <TabsContent value="subscriptions">
            <Card className="border-0 shadow-sm">
              <CardHeader className="border-b bg-muted/30">
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder={isRTL ? 'بحث عن طالب...' : 'Search student...'} value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
                  </div>
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                      <SelectItem value="active">{isRTL ? 'نشط' : 'Active'}</SelectItem>
                      <SelectItem value="overdue">{isRTL ? 'متأخر' : 'Overdue'}</SelectItem>
                      <SelectItem value="suspended">{isRTL ? 'موقوف' : 'Suspended'}</SelectItem>
                      <SelectItem value="expired">{isRTL ? 'منتهي' : 'Expired'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableHead className="font-semibold">{isRTL ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead className="font-semibold">{isRTL ? 'الباقة' : 'Plan'}</TableHead>
                      <TableHead className="font-semibold">{isRTL ? 'نوع الدفع' : 'Payment Type'}</TableHead>
                      <TableHead className="font-semibold">{isRTL ? 'المدفوع' : 'Paid'}</TableHead>
                      <TableHead className="font-semibold">{isRTL ? 'المتبقي' : 'Remaining'}</TableHead>
                      <TableHead className="font-semibold">{isRTL ? 'الدفع القادم' : 'Next Payment'}</TableHead>
                      <TableHead className="font-semibold">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead className="font-semibold">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSubs.map((sub: any) => {
                      const isOverdue = sub.next_payment_date && new Date(sub.next_payment_date) < new Date() && Number(sub.remaining_amount) > 0;
                      return (
                        <TableRow key={sub.id} className={sub.is_suspended ? 'bg-destructive/5' : isOverdue ? 'bg-warning/5' : ''}>
                          <TableCell>
                            <button className="text-left hover:underline" onClick={() => navigate(`/student/${sub.student_id}`)}>
                              <p className="font-medium">{language === 'ar' ? sub.profile?.full_name_ar || sub.profile?.full_name : sub.profile?.full_name}</p>
                              <p className="text-xs text-muted-foreground">{sub.profile?.email}</p>
                            </button>
                          </TableCell>
                          <TableCell>{language === 'ar' ? sub.pricing_plans?.name_ar : sub.pricing_plans?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {sub.payment_type === 'installment' ? (isRTL ? 'تقسيط' : 'Installment') : (isRTL ? 'كامل' : 'Full')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-green-600 font-medium">{sub.paid_amount} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                          <TableCell className={Number(sub.remaining_amount) > 0 ? 'text-orange-600 font-medium' : ''}>{sub.remaining_amount || 0} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                          <TableCell>{sub.next_payment_date ? formatDate(sub.next_payment_date, language) : '-'}</TableCell>
                          <TableCell>
                            {sub.is_suspended ? <Badge variant="destructive">{isRTL ? 'موقوف' : 'Suspended'}</Badge>
                              : isOverdue ? <Badge className="bg-orange-100 text-orange-800">{isRTL ? 'متأخر' : 'Overdue'}</Badge>
                              : Number(sub.remaining_amount) <= 0 ? <Badge className="bg-green-100 text-green-800">{isRTL ? 'مدفوع' : 'Paid'}</Badge>
                              : <Badge className="bg-blue-100 text-blue-800">{isRTL ? 'نشط' : 'Active'}</Badge>}
                          </TableCell>
                          <TableCell>
                            {Number(sub.remaining_amount) > 0 && (
                              <Button size="sm" variant="outline" onClick={() => openPaymentDialog(sub)}>
                                <CreditCard className="h-3 w-3 mr-1" />{isRTL ? 'دفعة' : 'Pay'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">{isRTL ? 'لا توجد اشتراكات' : 'No subscriptions found'}</p>}
                {filtered.length > 0 && (
                  <DataTablePagination
                    currentPage={subPage}
                    totalPages={subTotalPages}
                    pageSize={subPageSize}
                    totalCount={filtered.length}
                    hasNextPage={subPage < subTotalPages}
                    hasPreviousPage={subPage > 1}
                    onPageChange={setSubPage}
                    onPageSizeChange={(size) => { setSubPageSize(size); setSubPage(1); }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card className="border-0 shadow-sm">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-base">{isRTL ? 'آخر المدفوعات' : 'Recent Payments'}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableHead className="font-semibold">{isRTL ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead className="font-semibold">{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      <TableHead className="font-semibold">{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                      <TableHead className="font-semibold">{isRTL ? 'طريقة الدفع' : 'Method'}</TableHead>
                      <TableHead className="font-semibold">{isRTL ? 'النوع' : 'Type'}</TableHead>
                      <TableHead className="font-semibold">{isRTL ? 'ملاحظات' : 'Notes'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPayments.map((p: any) => (
                      <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <button className="text-start hover:underline font-medium" onClick={() => navigate(`/student/${p.subscriptions?.student_id || p.student_id}`)}>
                            {language === 'ar' ? p.profile?.full_name_ar || p.profile?.full_name || '-' : p.profile?.full_name || '-'}
                          </button>
                        </TableCell>
                        <TableCell>{formatDate(p.payment_date, language)}</TableCell>
                        <TableCell className="font-medium text-emerald-600">{p.amount} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {p.payment_method === 'cash' ? (isRTL ? 'كاش' : 'Cash') : (isRTL ? 'تحويل' : 'Transfer')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {p.payment_type === 'prior_payment' ? (isRTL ? 'دفعة سابقة' : 'Prior') : (isRTL ? 'عادي' : 'Regular')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">{p.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {monthFilteredPayments.length > 0 && (
                  <DataTablePagination
                    currentPage={payPage}
                    totalPages={payTotalPages}
                    pageSize={payPageSize}
                    totalCount={monthFilteredPayments.length}
                    hasNextPage={payPage < payTotalPages}
                    hasPreviousPage={payPage > 1}
                    onPageChange={setPayPage}
                    onPageSizeChange={(size) => { setPayPageSize(size); setPayPage(1); }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses"><ExpensesTab selectedMonth={selectedMonth} /></TabsContent>
          <TabsContent value="salaries"><SalariesTab selectedMonth={selectedMonth} /></TabsContent>
          <TabsContent value="profit"><NetProfitTab selectedMonth={selectedMonth} /></TabsContent>

          <TabsContent value="reports">
            <div className="space-y-4">
              {/* Report Filters */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">{isRTL ? 'الفترة الزمنية' : 'Time Period'}</Label>
                      <Select value={reportPeriod} onValueChange={setReportPeriod}>
                        <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">{isRTL ? '3 أشهر' : '3 Months'}</SelectItem>
                          <SelectItem value="6">{isRTL ? '6 أشهر' : '6 Months'}</SelectItem>
                          <SelectItem value="12">{isRTL ? 'سنة' : '1 Year'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">{isRTL ? 'الباقة' : 'Plan'}</Label>
                      <Select value={reportPlan} onValueChange={setReportPlan}>
                        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{isRTL ? 'كل الباقات' : 'All Plans'}</SelectItem>
                          {pricingPlans.map((plan: any) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {language === 'ar' ? plan.name_ar : plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Monthly Revenue Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{isRTL ? 'الإيرادات الشهرية' : 'Monthly Revenue'}</CardTitle>
                    <CardDescription>{isRTL ? `آخر ${reportPeriod} أشهر` : `Last ${reportPeriod} months`}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={{ revenue: { label: isRTL ? 'الإيرادات' : 'Revenue', color: 'hsl(var(--primary))' } }} className="h-[300px] w-full">
                      <BarChart data={filteredMonthlyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Overdue Trend Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{isRTL ? 'المتأخرات الشهرية' : 'Monthly Overdue'}</CardTitle>
                    <CardDescription>{isRTL ? 'عدد الطلاب المتأخرين شهرياً' : 'Overdue students per month'}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={{ overdue: { label: isRTL ? 'متأخرين' : 'Overdue', color: 'hsl(var(--destructive))' } }} className="h-[300px] w-full">
                      <LineChart data={filteredMonthlyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="overdue" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Payment Count Chart */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">{isRTL ? 'عدد الدفعات الشهرية' : 'Monthly Payment Count'}</CardTitle>
                    <CardDescription>{isRTL ? 'عدد عمليات الدفع لكل شهر' : 'Number of payments per month'}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={{ payments: { label: isRTL ? 'دفعات' : 'Payments', color: 'hsl(var(--secondary))' } }} className="h-[250px] w-full">
                      <BarChart data={filteredMonthlyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="payments" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="tracker"><PaymentTrackerTab selectedMonth={selectedMonth} /></TabsContent>
          <TabsContent value="cashflow"><CashFlowTab /></TabsContent>
        </Tabs>

        {/* Detail Dialog */}
        <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {detailDialog === 'outstanding' ? (
                  <><DollarSign className="h-5 w-5 text-amber-500" />{isRTL ? 'تفاصيل المبالغ المستحقة' : 'Outstanding Amounts Details'}</>
                ) : detailDialog === 'overdue' ? (
                  <><AlertTriangle className="h-5 w-5 text-red-500" />{isRTL ? 'تفاصيل المتأخرين' : 'Overdue Details'}</>
                ) : (
                  <><TrendingUp className="h-5 w-5 text-emerald-500" />{isRTL ? 'تفاصيل إيرادات الشهر الحالي' : 'This Month Revenue Details'}</>
                )}
              </DialogTitle>
            </DialogHeader>

            {detailDialog === 'revenue' ? (
              <>
                {/* Revenue summary */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 rounded-lg border bg-emerald-50 dark:bg-emerald-900/20">
                    <p className="text-xs text-muted-foreground">{isRTL ? 'الإيرادات' : 'Revenue'}</p>
                    <p className="text-lg font-bold text-emerald-600">{stats.totalRevenue} {isRTL ? 'ج.م' : 'EGP'}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-900/20">
                    <p className="text-xs text-muted-foreground">{isRTL ? 'المصروفات + الرواتب' : 'Expenses + Salaries'}</p>
                    <p className="text-lg font-bold text-red-600">{stats.thisMonthExpenses + stats.thisMonthSalaries} {isRTL ? 'ج.م' : 'EGP'}</p>
                  </div>
                  <div className={`p-3 rounded-lg border ${stats.netProfit >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <p className="text-xs text-muted-foreground">{isRTL ? 'صافي الربح' : 'Net Profit'}</p>
                    <p className={`text-lg font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stats.netProfit} {isRTL ? 'ج.م' : 'EGP'}</p>
                  </div>
                </div>
                {/* Revenue payments list */}
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableHead className="font-semibold">{isRTL ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead className="font-semibold">{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                      <TableHead className="font-semibold">{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      <TableHead className="font-semibold">{isRTL ? 'الطريقة' : 'Method'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthFilteredPayments.map((p: any) => (
                      <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <button className="text-start hover:underline font-medium" onClick={() => { setDetailDialog(null); navigate(`/student/${p.subscriptions?.student_id || p.student_id}`); }}>
                            {language === 'ar' ? p.profile?.full_name_ar || p.profile?.full_name || '-' : p.profile?.full_name || '-'}
                          </button>
                        </TableCell>
                        <TableCell className="font-semibold text-emerald-600">{p.amount} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                        <TableCell className="text-sm">{formatDate(p.payment_date, language)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="font-normal">
                              {p.payment_method === 'cash'
                                ? (isRTL ? 'كاش' : 'Cash')
                                : p.transfer_type === 'bank' ? (isRTL ? 'تحويل بنكي' : 'Bank')
                                : p.transfer_type === 'instapay' ? 'InstaPay'
                                : p.transfer_type === 'wallet' ? (isRTL ? 'محفظة' : 'Wallet')
                                : (isRTL ? 'تحويل' : 'Transfer')}
                            </Badge>
                            <ReceiptViewButton path={p.receipt_url} size="icon" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableHead className="font-semibold">{isRTL ? 'الطالب' : 'Student'}</TableHead>
                    <TableHead className="font-semibold">{isRTL ? 'الباقة' : 'Plan'}</TableHead>
                    <TableHead className="font-semibold">{isRTL ? 'المتبقي' : 'Remaining'}</TableHead>
                    <TableHead className="font-semibold">{isRTL ? 'القسط' : 'Installment'}</TableHead>
                    <TableHead className="font-semibold">{isRTL ? 'تاريخ الاستحقاق' : 'Due Date'}</TableHead>
                    {detailDialog === 'overdue' && (
                      <TableHead className="font-semibold">{isRTL ? 'أيام التأخير' : 'Days Late'}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detailDialog === 'outstanding' ? outstandingStudents : overdueStudents).map((s: any) => (
                    <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <button className="text-start hover:underline font-medium" onClick={() => { setDetailDialog(null); navigate(`/student/${s.student_id}`); }}>
                          {s.name || '-'}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm">{s.planName || '-'}</TableCell>
                      <TableCell className="font-semibold text-orange-600">{s.remaining} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                      <TableCell className="text-sm">{s.installment ? `${s.installment} ${isRTL ? 'ج.م' : 'EGP'}` : '-'}</TableCell>
                      <TableCell className="text-sm">{s.nextPayment ? formatDate(s.nextPayment, language) : '-'}</TableCell>
                      {detailDialog === 'overdue' && (
                        <TableCell>
                          <Badge variant="destructive" className="font-mono">
                            {s.daysOverdue} {isRTL ? 'يوم' : 'days'}
                          </Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {(detailDialog === 'outstanding' ? outstandingStudents : overdueStudents).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {isRTL ? 'لا توجد بيانات' : 'No data'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>
        {/* Payment Dialog */}
        <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? 'تسجيل دفعة جديدة' : 'Record Payment'}</DialogTitle>
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
                  <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(+e.target.value)} /></div>
                <PaymentMethodFields
                  ref={paymentMethodRef}
                  value={paymentMethodValue}
                  onChange={setPaymentMethodValue}
                  disabled={savingPayment}
                />
                <div><Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                  <Input value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} /></div>
                <div><Label>{isRTL ? 'تاريخ الدفع الفعلي' : 'Actual Payment Date'}</Label>
                  <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} max={new Date().toISOString().split('T')[0]} /></div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentDialog(false)} disabled={savingPayment}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleRecordPayment} disabled={savingPayment}>{savingPayment ? (isRTL ? 'جاري التسجيل...' : 'Saving...') : (isRTL ? 'تسجيل الدفعة' : 'Record Payment')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
