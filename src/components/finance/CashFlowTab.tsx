import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, CalendarClock, RefreshCw, Receipt, GraduationCap } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Line, ComposedChart, Legend } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

// Map schedule_day to JS day number (0=Sun)
const DAY_MAP: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

function estimateCompletionDate(scheduleDay: string, remainingSessions: number): Date {
  const dayNum = DAY_MAP[scheduleDay];
  if (dayNum === undefined || remainingSessions <= 0) return new Date();
  const now = new Date();
  let count = 0;
  const d = new Date(now);
  while (count < remainingSessions) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === dayNum) count++;
  }
  return d;
}

interface Projection {
  month: string;
  renewals: number;
  installments: number;
  academicRenewals: number;
  total: number;
}

export function CashFlowTab() {
  const { isRTL, language } = useLanguage();

  const { data: cashFlowData, isLoading: loading } = useQuery({
    queryKey: ['cash-flow'],
    queryFn: async () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
      const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0];

      const [paymentsRes, expensesRes, subsThisMonthRes, subsNextMonthRes, allActiveSubsRes, progressRes] = await Promise.all([
        supabase.from('payments').select('amount, payment_date').gte('payment_date', sixMonthsAgoStr),
        supabase.from('expenses').select('amount, expense_date').gte('expense_date', sixMonthsAgoStr),
        supabase.from('subscriptions').select('id, installment_amount, next_payment_date, payment_type, remaining_amount, end_date').eq('status', 'active').gte('next_payment_date', thisMonthStart).lte('next_payment_date', thisMonthEnd),
        supabase.from('subscriptions').select('id, installment_amount, next_payment_date, payment_type, remaining_amount, end_date').eq('status', 'active').gte('next_payment_date', nextMonthStart).lte('next_payment_date', nextMonthEnd),
        supabase.from('subscriptions').select('id, installment_amount, next_payment_date, payment_type, remaining_amount, end_date, total_amount, paid_amount').eq('status', 'active'),
        // Academic progress: students nearing level completion
        supabase.from('group_student_progress').select(`
          student_id,
          group_id,
          groups!group_student_progress_group_id_fkey (
            id, name, schedule_day, last_delivered_content_number, is_active, status
          ),
          levels!group_student_progress_current_level_id_fkey (
            expected_sessions_count
          )
        `).eq('status', 'in_progress'),
      ]);

      const payments = paymentsRes.data || [];
      const expenses = expensesRes.data || [];
      const thisMonthSubs = subsThisMonthRes.data || [];
      const allActiveSubs = allActiveSubsRes.data || [];

      // Calculate unpaid this month
      let unpaidThisMonth = 0;
      if (thisMonthSubs.length > 0) {
        const subIds = thisMonthSubs.map((s: any) => s.id);
        const { data: recentPayments } = await supabase.from('payments').select('subscription_id, payment_date').in('subscription_id', subIds);

        thisMonthSubs.forEach((sub: any) => {
          const npd = new Date(sub.next_payment_date);
          const cycleStart = new Date(npd.getTime() - 30 * 24 * 60 * 60 * 1000);
          const hasPaid = (recentPayments || []).some((p: any) => {
            if (p.subscription_id !== sub.id) return false;
            const pd = new Date(p.payment_date);
            return pd >= cycleStart && pd <= npd;
          });
          if (!hasPaid) unpaidThisMonth += Number(sub.installment_amount || 0);
        });
      }

      const dueNextMonth = (subsNextMonthRes.data || []).reduce((sum: number, s: any) => sum + Number(s.installment_amount || 0), 0);

      // ---- Academic renewal projections ----
      const progressRows = (progressRes.data || []) as any[];
      // Filter to active groups with remaining sessions that fit within ~3 months (~13 weeks)
      const nearCompletion: { studentId: string; groupId: string; scheduleDay: string; remaining: number }[] = [];
      progressRows.forEach((row: any) => {
        const g = row.groups;
        const l = row.levels;
        if (!g || !l || g.is_active !== true || g.status !== 'active') return;
        const expected = Number(l.expected_sessions_count || 0);
        const delivered = Number(g.last_delivered_content_number || 0);
        const remaining = expected - delivered;
        // Include any group that will finish within ~13 weeks (1 session/week)
        if (remaining > 0 && remaining <= 13) {
          nearCompletion.push({
            studentId: row.student_id,
            groupId: g.id,
            scheduleDay: g.schedule_day,
            remaining,
          });
        }
      });

      // Get active subscriptions for these students to estimate renewal amounts
      const studentIds = [...new Set(nearCompletion.map(r => r.studentId))];
      let studentSubMap: Record<string, number> = {};
      if (studentIds.length > 0) {
        const { data: studentSubs } = await supabase
          .from('subscriptions')
          .select('student_id, total_amount')
          .eq('status', 'active')
          .in('student_id', studentIds);
        (studentSubs || []).forEach((s: any) => {
          // Use latest/highest as estimate
          const prev = studentSubMap[s.student_id] || 0;
          studentSubMap[s.student_id] = Math.max(prev, Number(s.total_amount || 0));
        });
      }

      // Group academic renewals by projected month
      const academicByMonth: Record<string, number> = {};
      nearCompletion.forEach(({ studentId, scheduleDay, remaining }) => {
        const completionDate = estimateCompletionDate(scheduleDay, remaining);
        const monthKey = `${completionDate.getFullYear()}-${completionDate.getMonth()}`;
        const amount = studentSubMap[studentId] || 0;
        if (amount > 0) {
          academicByMonth[monthKey] = (academicByMonth[monthKey] || 0) + amount;
        }
      });

      // Build projections for next 3 months
      const projections: Projection[] = [];
      for (let i = 1; i <= 3; i++) {
        const futureMonth = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const futureMonthEnd = new Date(futureMonth.getFullYear(), futureMonth.getMonth() + 1, 0);
        const monthLabel = futureMonth.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', year: '2-digit' });
        const monthKey = `${futureMonth.getFullYear()}-${futureMonth.getMonth()}`;

        let renewals = 0;
        let installments = 0;

        allActiveSubs.forEach((sub: any) => {
          const remaining = Number(sub.remaining_amount || 0);
          if (remaining <= 0) return;
          const npd = sub.next_payment_date ? new Date(sub.next_payment_date) : null;
          if (!npd) return;
          const installmentAmt = Number(sub.installment_amount || 0);
          if (installmentAmt <= 0) return;
          const monthsDiff = (futureMonth.getFullYear() - npd.getFullYear()) * 12 + (futureMonth.getMonth() - npd.getMonth());
          if (monthsDiff >= 0 && remaining > monthsDiff * installmentAmt) {
            if (sub.payment_type === 'installment') {
              installments += installmentAmt;
            } else {
              renewals += Math.min(installmentAmt, remaining);
            }
          }
          if (sub.end_date) {
            const endDate = new Date(sub.end_date);
            if (endDate >= futureMonth && endDate <= futureMonthEnd && remaining <= 0) {
              renewals += Number(sub.total_amount || 0);
            }
          }
        });

        const academicRenewals = academicByMonth[monthKey] || 0;
        projections.push({ month: monthLabel, renewals, installments, academicRenewals, total: renewals + installments + academicRenewals });
      }

      // Also compute academic renewals for current month
      const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
      const academicThisMonth = academicByMonth[currentMonthKey] || 0;

      return { payments, expenses, unpaidThisMonth, dueNextMonth, projections, academicThisMonth, nearCompletionCount: nearCompletion.length };
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const payments = cashFlowData?.payments || [];
  const expenses = cashFlowData?.expenses || [];
  const unpaidThisMonth = cashFlowData?.unpaidThisMonth || 0;
  const dueNextMonth = cashFlowData?.dueNextMonth || 0;
  const projections = cashFlowData?.projections || [];
  const academicThisMonth = cashFlowData?.academicThisMonth || 0;
  const nearCompletionCount = cashFlowData?.nearCompletionCount || 0;

  const now = new Date();
  const thisMonthStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const cashInThisMonth = useMemo(() => {
    return payments.filter(p => {
      const d = new Date(p.payment_date);
      return d >= thisMonthStartDate && d <= thisMonthEndDate;
    }).reduce((sum, p) => sum + Number(p.amount), 0);
  }, [payments]);

  const expensesThisMonth = useMemo(() => {
    return expenses.filter(e => {
      const d = new Date(e.expense_date);
      return d >= thisMonthStartDate && d <= thisMonthEndDate;
    }).reduce((sum, e) => sum + Number(e.amount), 0);
  }, [expenses]);

  const netFlow = cashInThisMonth - expensesThisMonth;

  const chartData = useMemo(() => {
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const label = d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', year: '2-digit' });
      const income = payments.filter(p => {
        const pd = new Date(p.payment_date);
        return pd >= d && pd <= monthEnd;
      }).reduce((sum, p) => sum + Number(p.amount), 0);
      const expense = expenses.filter(e => {
        const ed = new Date(e.expense_date);
        return ed >= d && ed <= monthEnd;
      }).reduce((sum, e) => sum + Number(e.amount), 0);
      months.push({ month: label, income, expenses: expense, net: income - expense });
    }
    return months;
  }, [payments, expenses, language]);

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {[
          { label: isRTL ? 'الوارد الفعلي هذا الشهر' : 'Actual Cash In (This Month)', value: `${cashInThisMonth} ${isRTL ? 'ج.م' : 'EGP'}`, icon: TrendingUp, gradient: 'from-emerald-500 to-emerald-600' },
          { label: isRTL ? 'المصروفات هذا الشهر' : 'Expenses (This Month)', value: `${expensesThisMonth} ${isRTL ? 'ج.م' : 'EGP'}`, icon: TrendingDown, gradient: 'from-red-500 to-red-600' },
          { label: isRTL ? 'صافي التدفق الفعلي' : 'Net Cash Flow', value: `${netFlow} ${isRTL ? 'ج.م' : 'EGP'}`, icon: DollarSign, gradient: netFlow >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600' },
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
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Expected Revenue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isRTL ? 'الإيرادات المتوقعة' : 'Expected Revenue'}</CardTitle>
          <CardDescription>{isRTL ? 'أقساط مستحقة لم تُدفع بعد' : 'Outstanding installments not yet paid'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="p-4 rounded-lg border bg-muted/30 space-y-1">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">{isRTL ? 'مستحق هذا الشهر (غير مدفوع)' : 'Due This Month (Unpaid)'}</span>
              </div>
              <p className="text-xl font-bold text-amber-600">{unpaidThisMonth} {isRTL ? 'ج.م' : 'EGP'}</p>
            </div>
            <div className="p-4 rounded-lg border bg-muted/30 space-y-1">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">{isRTL ? 'مستحق الشهر القادم' : 'Due Next Month'}</span>
              </div>
              <p className="text-xl font-bold text-blue-600">{dueNextMonth} {isRTL ? 'ج.م' : 'EGP'}</p>
            </div>
            {academicThisMonth > 0 && (
              <div className="p-4 rounded-lg border bg-muted/30 space-y-1">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">{isRTL ? 'تجديدات متوقعة (أكاديمي)' : 'Expected Renewals (Academic)'}</span>
                </div>
                <p className="text-xl font-bold text-purple-600">{academicThisMonth} {isRTL ? 'ج.م' : 'EGP'}</p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? `${nearCompletionCount} طالب قرب ينهي المستوى` : `${nearCompletionCount} students near level completion`}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Projected Cash Flow - Next 3 Months */}
      {projections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isRTL ? 'التدفق النقدي المتوقع - الأشهر القادمة' : 'Projected Cash Flow - Upcoming Months'}</CardTitle>
            <CardDescription>{isRTL ? 'تقدير الإيرادات المتوقعة من تجديد الاشتراكات والأقساط المستحقة والتقدم الأكاديمي' : 'Estimated revenue from subscription renewals, due installments, and academic progress'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-6">
              {projections.map((p) => (
                <div key={p.month} className="p-4 rounded-lg border bg-muted/30 space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground">{p.month}</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-xs text-muted-foreground">{isRTL ? 'تجديدات' : 'Renewals'}</span>
                      </div>
                      <span className="text-sm font-medium text-blue-600">{p.renewals} {isRTL ? 'ج.م' : 'EGP'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Receipt className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-xs text-muted-foreground">{isRTL ? 'أقساط مستحقة' : 'Due Installments'}</span>
                      </div>
                      <span className="text-sm font-medium text-amber-600">{p.installments} {isRTL ? 'ج.م' : 'EGP'}</span>
                    </div>
                    {p.academicRenewals > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="h-3.5 w-3.5 text-purple-500" />
                          <span className="text-xs text-muted-foreground">{isRTL ? 'تجديدات أكاديمية' : 'Academic Renewals'}</span>
                        </div>
                        <span className="text-sm font-medium text-purple-600">{p.academicRenewals} {isRTL ? 'ج.م' : 'EGP'}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex items-center justify-between">
                      <span className="text-xs font-medium">{isRTL ? 'الإجمالي المتوقع' : 'Total Expected'}</span>
                      <span className="text-base font-bold text-primary">{p.total} {isRTL ? 'ج.م' : 'EGP'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <ChartContainer config={{
              renewals: { label: isRTL ? 'تجديدات' : 'Renewals', color: 'hsl(var(--chart-1))' },
              installments: { label: isRTL ? 'أقساط' : 'Installments', color: 'hsl(var(--chart-3))' },
              academicRenewals: { label: isRTL ? 'تجديدات أكاديمية' : 'Academic Renewals', color: 'hsl(270 60% 55%)' },
            }} className="h-[250px] w-full">
              <BarChart data={projections}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="renewals" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} stackId="projected" />
                <Bar dataKey="installments" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} stackId="projected" />
                <Bar dataKey="academicRenewals" fill="hsl(270 60% 55%)" radius={[4, 4, 0, 0]} stackId="projected" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* 6-Month Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isRTL ? 'التدفق النقدي الفعلي - آخر 6 أشهر' : 'Actual Cash Flow - Last 6 Months'}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{
            income: { label: isRTL ? 'الوارد' : 'Income', color: 'hsl(var(--chart-2))' },
            expenses: { label: isRTL ? 'المصروفات' : 'Expenses', color: 'hsl(var(--destructive))' },
            net: { label: isRTL ? 'الصافي' : 'Net', color: 'hsl(var(--primary))' },
          }} className="h-[350px] w-full">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="income" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="net" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
