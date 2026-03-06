import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

export function NetProfitTab() {
  const { isRTL, language } = useLanguage();
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('6');

  useEffect(() => {
    const fetch = async () => {
      const [paymentsRes, expensesRes, salariesRes] = await Promise.all([
        supabase.from('payments').select('amount, payment_date').order('payment_date', { ascending: false }),
        supabase.from('expenses').select('amount, expense_date').order('expense_date', { ascending: false }),
        supabase.from('salary_payments').select('net_amount, month, status').eq('status', 'paid'),
      ]);
      setPayments(paymentsRes.data || []);
      setExpenses(expensesRes.data || []);
      setSalaryPayments(salariesRes.data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const monthlyData = useMemo(() => {
    const months = Number(period);
    const now = new Date();
    const data: any[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', year: '2-digit' });

      const revenue = payments.filter(p => {
        const pd = new Date(p.payment_date);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
      }).reduce((sum, p) => sum + Number(p.amount), 0);

      const expenseTotal = expenses.filter(e => {
        const ed = new Date(e.expense_date);
        return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
      }).reduce((sum, e) => sum + Number(e.amount), 0);

      const salaryTotal = salaryPayments.filter(s => {
        const sd = new Date(s.month);
        return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
      }).reduce((sum, s) => sum + Number(s.net_amount || 0), 0);

      const profit = revenue - expenseTotal - salaryTotal;
      data.push({ month: label, key, revenue, expenses: expenseTotal, salaries: salaryTotal, profit });
    }
    return data;
  }, [payments, expenses, salaryPayments, period, language]);

  // Current month totals
  const current = monthlyData[monthlyData.length - 1] || { revenue: 0, expenses: 0, salaries: 0, profit: 0 };
  const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = monthlyData.reduce((s, m) => s + m.expenses, 0);
  const totalSalaries = monthlyData.reduce((s, m) => s + m.salaries, 0);
  const totalProfit = totalRevenue - totalExpenses - totalSalaries;

  if (loading) return <div className="text-center py-8 text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex justify-end">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3">{isRTL ? '3 أشهر' : '3 Months'}</SelectItem>
            <SelectItem value="6">{isRTL ? '6 أشهر' : '6 Months'}</SelectItem>
            <SelectItem value="12">{isRTL ? 'سنة' : '1 Year'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: isRTL ? 'إجمالي الإيرادات' : 'Total Revenue', value: `${totalRevenue} ${isRTL ? 'ج.م' : 'EGP'}`, icon: TrendingUp, gradient: 'from-emerald-500 to-emerald-600' },
          { label: isRTL ? 'إجمالي المصروفات' : 'Total Expenses', value: `${totalExpenses} ${isRTL ? 'ج.م' : 'EGP'}`, icon: TrendingDown, gradient: 'from-red-500 to-red-600' },
          { label: isRTL ? 'إجمالي الرواتب' : 'Total Salaries', value: `${totalSalaries} ${isRTL ? 'ج.م' : 'EGP'}`, icon: Minus, gradient: 'from-orange-500 to-amber-500' },
          { label: isRTL ? 'صافي الربح' : 'Net Profit', value: `${totalProfit} ${isRTL ? 'ج.م' : 'EGP'}`, icon: DollarSign, gradient: totalProfit >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600' },
        ].map(stat => (
          <Card key={stat.label} className="relative overflow-hidden hover:shadow-md transition-all duration-300">
            <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isRTL ? 'صافي الربح الشهري' : 'Monthly Net Profit'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ profit: { label: isRTL ? 'صافي الربح' : 'Net Profit', color: 'hsl(var(--primary))' } }} className="h-[300px] w-full">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="profit" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isRTL ? 'مقارنة شهرية' : 'Monthly Comparison'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{
              revenue: { label: isRTL ? 'إيرادات' : 'Revenue', color: 'hsl(142, 76%, 36%)' },
              expenses: { label: isRTL ? 'مصروفات' : 'Expenses', color: 'hsl(var(--destructive))' },
              salaries: { label: isRTL ? 'رواتب' : 'Salaries', color: 'hsl(25, 95%, 53%)' },
            }} className="h-[300px] w-full">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="salaries" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b bg-muted/30"><CardTitle className="text-base">{isRTL ? 'التفاصيل الشهرية' : 'Monthly Breakdown'}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead className="font-semibold">{isRTL ? 'الشهر' : 'Month'}</TableHead>
                <TableHead className="font-semibold">{isRTL ? 'الإيرادات' : 'Revenue'}</TableHead>
                <TableHead className="font-semibold">{isRTL ? 'المصروفات' : 'Expenses'}</TableHead>
                <TableHead className="font-semibold">{isRTL ? 'الرواتب' : 'Salaries'}</TableHead>
                <TableHead className="font-semibold">{isRTL ? 'صافي الربح' : 'Net Profit'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map(m => (
                <TableRow key={m.key}>
                  <TableCell className="font-medium">{m.month}</TableCell>
                  <TableCell className="text-green-600">{m.revenue} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                  <TableCell className="text-destructive">{m.expenses} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                  <TableCell className="text-orange-600">{m.salaries} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                  <TableCell className={`font-bold ${m.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{m.profit} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
