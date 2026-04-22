import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, Banknote, Smartphone, TrendingUp, TrendingDown, DollarSign,
  Users, AlertTriangle, Ban, ArrowRight, PiggyBank, ReceiptText, LineChart as LineChartIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface OverviewStats {
  totalRevenue: number;
  netProfit: number;
  totalOutstanding: number;
  activeCount: number;
  overdueCount: number;
  suspendedCount: number;
  thisMonthExpenses: number;
  thisMonthSalaries: number;
}

interface FinanceOverviewTabProps {
  stats: OverviewStats;
  loading: boolean;
  selectedMonth: string;
  isCurrentMonth: boolean;
  onTabChange: (value: string) => void;
  role?: string | null;
}

interface TreasuryBalance {
  account_code: string;
  account_name: string;
  account_name_ar: string;
  balance: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

export function FinanceOverviewTab({
  stats, loading, selectedMonth, isCurrentMonth, onTabChange, role,
}: FinanceOverviewTabProps) {
  const { isRTL, language } = useLanguage();
  const isAdmin = role === 'admin';
  const navigate = useNavigate();

  // Treasury balances
  const treasuryQuery = useQuery({
    queryKey: ['finance-overview-treasury'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_treasury_balances');
      if (error) throw error;
      return (data ?? []) as TreasuryBalance[];
    },
    staleTime: 60_000,
  });

  // 6-month revenue / profit trend
  const trendQuery = useQuery({
    queryKey: ['finance-overview-trend'],
    queryFn: async () => {
      const [pay, exp, sal] = await Promise.all([
        supabase.from('payments').select('amount, payment_date'),
        supabase.from('expenses').select('amount, expense_date'),
        supabase.from('salary_payments').select('net_amount, month, status').eq('status', 'paid'),
      ]);
      return { payments: pay.data || [], expenses: exp.data || [], salaries: sal.data || [] };
    },
    staleTime: 60_000,
  });

  const treasury = useMemo(() => {
    const raw = treasuryQuery.data ?? [];
    const cash = raw.find(b => b.account_code === '1110');
    const bank = raw.find(b => b.account_code === '1120');
    const insta = raw.find(b => b.account_code === '1130');
    const bankTotal = (bank?.balance || 0) + (insta?.balance || 0);
    const cashTotal = cash?.balance || 0;
    return { cashTotal, bankTotal, total: cashTotal + bankTotal };
  }, [treasuryQuery.data]);

  const trendData = useMemo(() => {
    if (!trendQuery.data) return [];
    const { payments, expenses, salaries } = trendQuery.data;
    const out: any[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short' });
      const inMonth = (date: string) => {
        const dt = new Date(date);
        return dt.getMonth() === d.getMonth() && dt.getFullYear() === d.getFullYear();
      };
      const revenue = payments.filter((p: any) => inMonth(p.payment_date)).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const expense = expenses.filter((e: any) => inMonth(e.expense_date)).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      const salary = salaries.filter((s: any) => inMonth(s.month)).reduce((sum: number, s: any) => sum + Number(s.net_amount || 0), 0);
      out.push({ month: label, revenue, expense, salary, profit: revenue - expense - salary });
    }
    return out;
  }, [trendQuery.data, language]);

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth, language]);

  const SectionHeader = ({ icon: Icon, title, subtitle, action, gradient }: any) => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg bg-gradient-to-br shadow-sm', gradient)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* === Treasury Section === */}
      <section>
        <SectionHeader
          icon={Wallet}
          title={isRTL ? 'الخزنة' : 'Treasury'}
          subtitle={isRTL ? 'الأرصدة الحالية' : 'Current balances'}
          gradient="from-emerald-500 to-teal-600"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate('/finance/treasury')} className="text-xs gap-1">
              {isRTL ? 'فتح الخزنة' : 'Open Treasury'} <ArrowRight className={cn('h-3 w-3', isRTL && 'rotate-180')} />
            </Button>
          }
        />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {[
            { label: isRTL ? 'إجمالي الخزنة' : 'Total Balance', value: treasury.total, icon: PiggyBank, gradient: 'from-emerald-500 to-emerald-600', glow: 'shadow-emerald-500/20' },
            { label: isRTL ? 'كاش' : 'Cash', value: treasury.cashTotal, icon: Banknote, gradient: 'from-amber-500 to-orange-500', glow: 'shadow-amber-500/20' },
            { label: isRTL ? 'بنك + إنستاباي' : 'Bank + InstaPay', value: treasury.bankTotal, icon: Smartphone, gradient: 'from-blue-500 to-indigo-600', glow: 'shadow-blue-500/20' },
          ].map(item => (
            <Card key={item.label} className={cn('relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all', item.glow)}>
              <div className={cn('absolute inset-0 bg-gradient-to-br opacity-[0.06]', item.gradient)} />
              <CardContent className="p-5 relative">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground font-medium mb-2">{item.label}</p>
                    {treasuryQuery.isLoading ? (
                      <Skeleton className="h-8 w-32" />
                    ) : (
                      <p className="text-2xl font-bold tabular-nums">
                        {fmt(item.value)} <span className="text-sm text-muted-foreground font-normal">{isRTL ? 'ج.م' : 'EGP'}</span>
                      </p>
                    )}
                  </div>
                  <div className={cn('p-2.5 rounded-xl bg-gradient-to-br shadow-md', item.gradient)}>
                    <item.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* === Subscriptions Section === */}
      <section>
        <SectionHeader
          icon={Users}
          title={isRTL ? 'الاشتراكات' : 'Subscriptions'}
          subtitle={isRTL ? 'حالة الطلاب والمستحقات' : 'Students and dues status'}
          gradient="from-blue-500 to-indigo-600"
          action={
            <Button variant="ghost" size="sm" onClick={() => onTabChange('subscriptions')} className="text-xs gap-1">
              {isRTL ? 'عرض الكل' : 'View all'} <ArrowRight className={cn('h-3 w-3', isRTL && 'rotate-180')} />
            </Button>
          }
        />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[
            { label: isRTL ? 'اشتراكات نشطة' : 'Active', value: stats.activeCount, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', ring: 'ring-blue-500/20' },
            { label: isRTL ? 'مستحقات' : 'Outstanding', value: `${fmt(stats.totalOutstanding)}`, suffix: isRTL ? 'ج.م' : 'EGP', icon: DollarSign, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20', onClick: () => onTabChange('tracker') },
            { label: isRTL ? 'متأخرين' : 'Overdue', value: stats.overdueCount, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/20', onClick: () => onTabChange('tracker') },
            { label: isRTL ? 'موقوفين' : 'Suspended', value: stats.suspendedCount, icon: Ban, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-500/10', ring: 'ring-slate-500/20' },
          ].map((item: any) => (
            <Card
              key={item.label}
              className={cn(
                'border hover:shadow-md transition-all',
                item.onClick && 'cursor-pointer hover:-translate-y-0.5'
              )}
              onClick={item.onClick}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2.5 rounded-xl ring-1 ring-inset', item.bg, item.ring)}>
                    <item.icon className={cn('h-4 w-4', item.color)} />
                  </div>
                  <div className="min-w-0">
                    {loading ? (
                      <Skeleton className="h-6 w-16 mb-1" />
                    ) : (
                      <p className="text-xl font-bold tabular-nums">
                        {item.value}
                        {item.suffix && <span className="text-xs text-muted-foreground font-normal ms-1">{item.suffix}</span>}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{item.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* === Reports / KPIs Section === */}
      <section>
        <SectionHeader
          icon={LineChartIcon}
          title={isRTL ? 'التقارير المالية' : 'Financial Reports'}
          subtitle={`${isRTL ? 'بيانات' : 'For'} ${monthLabel}${!isCurrentMonth ? ` · ${isRTL ? 'شهر سابق' : 'past month'}` : ''}`}
          gradient="from-purple-500 to-pink-600"
          action={
            <Button variant="ghost" size="sm" onClick={() => onTabChange('profit')} className="text-xs gap-1">
              {isRTL ? 'صافي الربح' : 'Net Profit'} <ArrowRight className={cn('h-3 w-3', isRTL && 'rotate-180')} />
            </Button>
          }
        />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[
            { label: isRTL ? 'إيرادات' : 'Revenue', value: stats.totalRevenue, icon: TrendingUp, gradient: 'from-emerald-500 to-emerald-600' },
            { label: isRTL ? 'مصروفات' : 'Expenses', value: stats.thisMonthExpenses, icon: TrendingDown, gradient: 'from-red-500 to-rose-600', onClick: () => onTabChange('expenses') },
            { label: isRTL ? 'رواتب' : 'Salaries', value: stats.thisMonthSalaries, icon: ReceiptText, gradient: 'from-orange-500 to-amber-600', onClick: () => onTabChange('salaries') },
            { label: isRTL ? 'صافي الربح' : 'Net Profit', value: stats.netProfit, icon: DollarSign, gradient: stats.netProfit >= 0 ? 'from-emerald-500 to-teal-600' : 'from-red-500 to-rose-600', onClick: () => onTabChange('profit') },
          ].map((item) => (
            <Card
              key={item.label}
              className={cn(
                'relative overflow-hidden border hover:shadow-md transition-all',
                item.onClick && 'cursor-pointer hover:-translate-y-0.5'
              )}
              onClick={item.onClick}
            >
              <div className={cn('absolute top-0 inset-x-0 h-1 bg-gradient-to-r', item.gradient)} />
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2.5 rounded-xl bg-gradient-to-br shadow-md', item.gradient)}>
                    <item.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    {loading ? (
                      <Skeleton className="h-7 w-20 mb-1" />
                    ) : (
                      <p className="text-xl font-bold tabular-nums">
                        {fmt(item.value)} <span className="text-xs text-muted-foreground font-normal">{isRTL ? 'ج.م' : 'EGP'}</span>
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{item.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trend charts */}
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{isRTL ? 'الإيرادات (آخر 6 أشهر)' : 'Revenue (last 6 months)'}</CardTitle>
              <CardDescription className="text-xs">{isRTL ? 'مدفوعات شهرية' : 'Monthly payments collected'}</CardDescription>
            </CardHeader>
            <CardContent>
              {trendQuery.isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <ChartContainer
                  config={{ revenue: { label: isRTL ? 'إيرادات' : 'Revenue', color: 'hsl(var(--primary))' } }}
                  className="h-[200px] w-full"
                >
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{isRTL ? 'صافي الربح (آخر 6 أشهر)' : 'Net Profit (last 6 months)'}</CardTitle>
              <CardDescription className="text-xs">{isRTL ? 'إيرادات − مصروفات − رواتب' : 'Revenue − Expenses − Salaries'}</CardDescription>
            </CardHeader>
            <CardContent>
              {trendQuery.isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <ChartContainer
                  config={{ profit: { label: isRTL ? 'صافي الربح' : 'Net Profit', color: 'hsl(142, 76%, 36%)' } }}
                  className="h-[200px] w-full"
                >
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="profit" stroke="hsl(142, 76%, 36%)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
