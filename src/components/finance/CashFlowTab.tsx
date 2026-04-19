import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, CalendarClock, RefreshCw, Receipt, GraduationCap, ChevronDown, ChevronUp, User } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Line, ComposedChart, Legend } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

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

interface AcademicRenewalDetail {
  studentId: string;
  studentName: string;
  groupName: string;
  remaining: number;
  amount: number;
  estimatedDate: Date;
  renewalStatus: 'renewed' | 'not_renewed';
  paidOnNew: number;       // for renewed
  remainingOnNew: number;  // for not_renewed (= amount)
  totalNew: number;        // for not_renewed (full new package price)
}

interface Projection {
  month: string;
  monthKey: string;
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

      const [paymentsRes, expensesRes, subsThisMonthRes, subsNextMonthRes, allActiveSubsRes, progressRes, attendanceRes, levelsRes, plansRes] = await Promise.all([
        supabase.from('payments').select('amount, payment_date').gte('payment_date', sixMonthsAgoStr),
        supabase.from('expenses').select('amount, expense_date').gte('expense_date', sixMonthsAgoStr),
        supabase.from('subscriptions').select('id, installment_amount, next_payment_date, payment_type, remaining_amount, end_date').eq('status', 'active').gte('next_payment_date', thisMonthStart).lte('next_payment_date', thisMonthEnd),
        supabase.from('subscriptions').select('id, installment_amount, next_payment_date, payment_type, remaining_amount, end_date').eq('status', 'active').gte('next_payment_date', nextMonthStart).lte('next_payment_date', nextMonthEnd),
        supabase.from('subscriptions').select('id, installment_amount, next_payment_date, payment_type, remaining_amount, end_date, total_amount, paid_amount').eq('status', 'active'),
        supabase.from('group_student_progress').select(`
          student_id,
          group_id,
          status,
          current_level_id,
          groups!group_student_progress_group_id_fkey (
            id, name, schedule_day, last_delivered_content_number, is_active, status
          ),
          levels!group_student_progress_current_level_id_fkey (
            expected_sessions_count, level_order, track_id
          )
        `).in('status', ['in_progress', 'awaiting_exam', 'exam_scheduled', 'graded']),
        // For per-student last attended content
        supabase.from('attendance').select('student_id, status, sessions!attendance_session_id_fkey(group_id, content_number)').eq('status', 'present'),
        // All levels for next-level lookup
        supabase.from('levels').select('id, name, name_ar, level_order, track_id, is_active').eq('is_active', true).order('level_order'),
        // Pricing plans for new-package amount estimate
        supabase.from('subscriptions').select('student_id, level_id, total_amount, paid_amount, remaining_amount, status').in('status', ['active']),
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

      // ---- Per-student last attended content map: key = `${studentId}::${groupId}` ----
      const attendanceRows = (attendanceRes.data || []) as any[];
      const studentLastContentMap: Record<string, number> = {};
      attendanceRows.forEach((row: any) => {
        const sess = row.sessions;
        if (!sess || sess.content_number == null) return;
        const key = `${row.student_id}::${sess.group_id}`;
        const prev = studentLastContentMap[key] || 0;
        if (Number(sess.content_number) > prev) studentLastContentMap[key] = Number(sess.content_number);
      });

      // ---- Levels: map level_order → next level id (per track) ----
      const allLevels = (levelsRes.data || []) as any[];
      const findNextLevelId = (currentOrder: number, trackId: string | null): string | null => {
        const candidates = allLevels
          .filter((l: any) => l.level_order > currentOrder && (trackId == null || l.track_id == null || l.track_id === trackId))
          .sort((a: any, b: any) => a.level_order - b.level_order);
        return candidates[0]?.id ?? null;
      };

      // Index all student subscriptions by student_id (for renewal lookup)
      const allStudentSubs = (plansRes.data || []) as any[];

      // ---- Academic renewal projections ----
      const progressRows = (progressRes.data || []) as any[];
      const nearCompletion: { studentId: string; groupId: string; groupName: string; scheduleDay: string; remaining: number; immediate: boolean; nextLevelId: string | null }[] = [];
      progressRows.forEach((row: any) => {
        const g = row.groups;
        const l = row.levels;
        if (!g || !l || g.is_active !== true || g.status !== 'active') return;

        const nextLevelId = findNextLevelId(Number(l.level_order || 0), l.track_id || null);

        // Students past in_progress (awaiting/scheduled/graded) → renewal expected this month
        const advancedStatuses = ['awaiting_exam', 'exam_scheduled', 'graded'];
        if (advancedStatuses.includes(row.status)) {
          nearCompletion.push({
            studentId: row.student_id,
            groupId: g.id,
            groupName: g.name || '',
            scheduleDay: g.schedule_day,
            remaining: 0,
            immediate: true,
            nextLevelId,
          });
          return;
        }

        const expected = Number(l.expected_sessions_count || 0);
        // Use student's actual last attended content (fallback to group delivered if no attendance)
        const studentDelivered = studentLastContentMap[`${row.student_id}::${g.id}`] ?? Number(g.last_delivered_content_number || 0);
        const remaining = expected - studentDelivered;
        if (remaining > 0 && remaining <= 13) {
          nearCompletion.push({
            studentId: row.student_id,
            groupId: g.id,
            groupName: g.name || '',
            scheduleDay: g.schedule_day,
            remaining,
            immediate: false,
            nextLevelId,
          });
        }
      });

      // Get student names + subscriptions
      const studentIds = [...new Set(nearCompletion.map(r => r.studentId))];
      let studentSubMap: Record<string, number> = {};
      let studentNameMap: Record<string, string> = {};

      if (studentIds.length > 0) {
        const [subsRes, profilesRes] = await Promise.all([
          supabase.from('subscriptions').select('student_id, total_amount').eq('status', 'active').in('student_id', studentIds),
          supabase.from('profiles').select('user_id, full_name').in('user_id', studentIds),
        ]);
        (subsRes.data || []).forEach((s: any) => {
          const prev = studentSubMap[s.student_id] || 0;
          studentSubMap[s.student_id] = Math.max(prev, Number(s.total_amount || 0));
        });
        (profilesRes.data || []).forEach((p: any) => {
          studentNameMap[p.user_id] = p.full_name || '';
        });
      }

      // Build detailed academic renewals by month
      const academicDetailsByMonth: Record<string, AcademicRenewalDetail[]> = {};
      const academicByMonth: Record<string, number> = {};
      // Per-month aggregates: total expected, total paid, remaining to collect
      const academicTotalsByMonth: Record<string, { totalExpected: number; totalPaid: number; totalRemaining: number; renewedCount: number; notRenewedCount: number }> = {};

      nearCompletion.forEach(({ studentId, groupName, scheduleDay, remaining, immediate, nextLevelId }) => {
        const completionDate = immediate ? new Date() : estimateCompletionDate(scheduleDay, remaining);
        const monthKey = `${completionDate.getFullYear()}-${completionDate.getMonth()}`;
        const expectedNewPackage = studentSubMap[studentId] || 0;
        if (expectedNewPackage <= 0) return;

        // Determine renewal status — does student already have an active sub for the next level?
        const newSub = nextLevelId
          ? allStudentSubs.find((s: any) => s.student_id === studentId && s.level_id === nextLevelId)
          : null;

        const renewalStatus: 'renewed' | 'not_renewed' = newSub ? 'renewed' : 'not_renewed';
        const totalNew = newSub ? Number(newSub.total_amount || 0) : expectedNewPackage;
        const paidOnNew = newSub ? Number(newSub.paid_amount || 0) : 0;
        const remainingOnNew = newSub ? Number(newSub.remaining_amount || 0) : expectedNewPackage;

        // Amount that still needs to come in (for cash-flow projection):
        // - If renewed → remaining on new sub (could be 0)
        // - If not renewed → full expected package
        const amount = renewalStatus === 'renewed' ? remainingOnNew : expectedNewPackage;
        if (amount <= 0 && renewalStatus === 'renewed') {
          // fully paid renewal — still show in detail table (status only) but don't add to projection
        }

        academicByMonth[monthKey] = (academicByMonth[monthKey] || 0) + amount;
        if (!academicTotalsByMonth[monthKey]) {
          academicTotalsByMonth[monthKey] = { totalExpected: 0, totalPaid: 0, totalRemaining: 0, renewedCount: 0, notRenewedCount: 0 };
        }
        academicTotalsByMonth[monthKey].totalExpected += totalNew;
        academicTotalsByMonth[monthKey].totalPaid += paidOnNew;
        academicTotalsByMonth[monthKey].totalRemaining += amount;
        if (renewalStatus === 'renewed') academicTotalsByMonth[monthKey].renewedCount += 1;
        else academicTotalsByMonth[monthKey].notRenewedCount += 1;
        if (!academicDetailsByMonth[monthKey]) academicDetailsByMonth[monthKey] = [];
        academicDetailsByMonth[monthKey].push({
          studentId,
          studentName: studentNameMap[studentId] || 'Unknown',
          groupName,
          remaining,
          amount,
          estimatedDate: completionDate,
          renewalStatus,
          paidOnNew,
          remainingOnNew,
          totalNew,
        });
      });

      // Build projections for current month + next 3 months
      const projections: Projection[] = [];
      for (let i = 0; i <= 3; i++) {
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
        projections.push({ month: monthLabel, monthKey, renewals, installments, academicRenewals, total: renewals + installments + academicRenewals });
      }

      const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
      const academicThisMonth = academicByMonth[currentMonthKey] || 0;

      return { payments, expenses, unpaidThisMonth, dueNextMonth, projections, academicThisMonth, nearCompletionCount: nearCompletion.length, academicDetailsByMonth };
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
  const academicDetailsByMonth = cashFlowData?.academicDetailsByMonth || {};

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
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 mb-6">
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

      {/* Academic Renewal Details - Per Month */}
      {projections.some(p => p.academicRenewals > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-purple-600" />
              {isRTL ? 'تفاصيل التجديدات الأكاديمية المتوقعة' : 'Academic Renewal Details'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'طلاب متوقع يجددوا اشتراكهم بناءً على تقدمهم الأكاديمي' : 'Students expected to renew based on their academic progress'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {projections.map((p) => {
              const details = academicDetailsByMonth[p.monthKey] || [];
              if (details.length === 0) return null;
              return (
                <AcademicMonthSection
                  key={p.monthKey}
                  monthLabel={p.month}
                  details={details}
                  total={p.academicRenewals}
                  isRTL={isRTL}
                />
              );
            })}
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

function AcademicMonthSection({ monthLabel, details, total, isRTL }: {
  monthLabel: string;
  details: AcademicRenewalDetail[];
  total: number;
  isRTL: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-3 h-auto rounded-lg border bg-muted/20 hover:bg-muted/40">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              {monthLabel}
            </Badge>
            <span className="text-sm font-medium">
              {isRTL ? `${details.length} طالب` : `${details.length} student${details.length > 1 ? 's' : ''}`}
            </span>
            <span className="text-sm font-bold text-purple-600">
              {total} {isRTL ? 'ج.م' : 'EGP'}
            </span>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                <TableHead>{isRTL ? 'المجموعة' : 'Group'}</TableHead>
                <TableHead className="text-center">{isRTL ? 'سيشنات متبقية' : 'Remaining'}</TableHead>
                <TableHead className="text-center">{isRTL ? 'تاريخ الانتهاء المتوقع' : 'Est. Completion'}</TableHead>
                <TableHead className="text-center">{isRTL ? 'حالة التجديد' : 'Renewal Status'}</TableHead>
                <TableHead className={isRTL ? 'text-left' : 'text-right'}>{isRTL ? 'تفاصيل المبلغ' : 'Amount Details'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.sort((a, b) => a.remaining - b.remaining).map((d) => {
                const isRenewed = d.renewalStatus === 'renewed';
                return (
                  <TableRow key={`${d.studentId}-${d.groupName}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{d.studentName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{d.groupName}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={d.remaining <= 2 ? 'destructive' : 'secondary'} className="text-xs">
                        {d.remaining} {isRTL ? 'سيشن' : 'sessions'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {d.estimatedDate.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })}
                    </TableCell>
                    <TableCell className="text-center">
                      {isRenewed ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">
                          {isRTL ? 'تم التجديد' : 'Renewed'}
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs">
                          {isRTL ? 'لم يتم التجديد' : 'Not Renewed'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={`font-semibold ${isRTL ? 'text-left' : 'text-right'}`}>
                      {isRenewed ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-emerald-600 text-sm">
                            {isRTL ? 'مدفوع: ' : 'Paid: '}{d.paidOnNew} {isRTL ? 'ج.م' : 'EGP'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {isRTL ? 'من ' : 'of '}{d.totalNew} {isRTL ? 'ج.م' : 'EGP'}
                          </span>
                          {d.remainingOnNew > 0 && (
                            <span className="text-xs text-amber-600">
                              {isRTL ? 'متبقي: ' : 'Remaining: '}{d.remainingOnNew} {isRTL ? 'ج.م' : 'EGP'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-amber-600 text-sm">
                            {isRTL ? 'متبقي: ' : 'Remaining: '}{d.remainingOnNew} {isRTL ? 'ج.م' : 'EGP'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {isRTL ? 'من ' : 'of '}{d.totalNew} {isRTL ? 'ج.م' : 'EGP'}
                          </span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
