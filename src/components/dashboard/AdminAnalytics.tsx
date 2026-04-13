import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { getGroupTypeLabel } from '@/lib/constants';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, LineChart, Line,
  ComposedChart,
} from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const COLORS = ['hsl(197, 70%, 64%)', 'hsl(249, 86%, 64%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)'];

interface MonthlyComparison {
  metric: string;
  current: number;
  previous: number;
  change: number;
  unit?: string;
}

export function AdminAnalytics() {
  const { isRTL } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [groupTypeData, setGroupTypeData] = useState<any[]>([]);
  const [studentGrowth, setStudentGrowth] = useState<any[]>([]);
  const [retentionData, setRetentionData] = useState<any[]>([]);
  const [revenueGrowthData, setRevenueGrowthData] = useState<any[]>([]);
  const [levelCompletionData, setLevelCompletionData] = useState<any[]>([]);
  const [monthlyComparison, setMonthlyComparison] = useState<MonthlyComparison[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      await Promise.all([
        fetchRevenueData(),
        fetchAttendanceData(),
        fetchGroupTypeDistribution(),
        fetchStudentGrowth(),
        fetchRetentionData(),
        fetchLevelCompletionData(),
      ]);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMonthRange = (monthsAgo: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    const name = d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short' });
    return { start, end, name, date: d };
  };

  const fetchRevenueData = async () => {
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const { start, end, name } = getMonthRange(i);

      const [{ data: payments }, { data: expenses }] = await Promise.all([
        supabase.from('payments').select('amount').gte('payment_date', start).lte('payment_date', end),
        supabase.from('expenses').select('amount').gte('expense_date', start).lte('expense_date', end),
      ]);

      const revenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const expense = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      months.push({ month: name, revenue, expenses: expense, profit: revenue - expense });
    }
    setRevenueData(months);

    // Compute revenue growth % (MoM)
    const growthData = months.map((m, i) => {
      if (i === 0) return { month: m.month, growth: 0 };
      const prev = months[i - 1].revenue;
      const growth = prev > 0 ? Math.round(((m.revenue - prev) / prev) * 100) : 0;
      return { month: m.month, growth };
    }).slice(1); // skip first (no previous)
    setRevenueGrowthData(growthData);

    // Monthly comparison (current vs previous)
    if (months.length >= 2) {
      const current = months[months.length - 1];
      const previous = months[months.length - 2];
      const revChange = previous.revenue > 0
        ? Math.round(((current.revenue - previous.revenue) / previous.revenue) * 100)
        : 0;
      const expChange = previous.expenses > 0
        ? Math.round(((current.expenses - previous.expenses) / previous.expenses) * 100)
        : 0;
      const profitChange = previous.profit !== 0
        ? Math.round(((current.profit - previous.profit) / Math.abs(previous.profit)) * 100)
        : 0;

      setMonthlyComparison(prev => [
        ...prev.filter(p => !['revenue', 'expenses', 'profit'].includes(p.metric)),
        { metric: 'revenue', current: current.revenue, previous: previous.revenue, change: revChange, unit: isRTL ? 'ج.م' : 'EGP' },
        { metric: 'expenses', current: current.expenses, previous: previous.expenses, change: expChange, unit: isRTL ? 'ج.م' : 'EGP' },
        { metric: 'profit', current: current.profit, previous: previous.profit, change: profitChange, unit: isRTL ? 'ج.م' : 'EGP' },
      ]);
    }
  };

  const fetchAttendanceData = async () => {
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const { start, end, name } = getMonthRange(i);

      const { data } = await supabase
        .from('attendance')
        .select('status, session_id')
        .gte('recorded_at', start)
        .lte('recorded_at', end);

      const total = data?.length || 0;
      const present = data?.filter(a => a.status === 'present').length || 0;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      months.push({ month: name, rate });
    }
    setAttendanceData(months);

    // Add attendance to monthly comparison
    if (months.length >= 2) {
      const current = months[months.length - 1];
      const previous = months[months.length - 2];
      setMonthlyComparison(prev => [
        ...prev.filter(p => p.metric !== 'attendance'),
        { metric: 'attendance', current: current.rate, previous: previous.rate, change: current.rate - previous.rate, unit: '%' },
      ]);
    }
  };

  const fetchGroupTypeDistribution = async () => {
    const { data: groups } = await supabase
      .from('groups')
      .select('group_type')
      .eq('is_active', true);

    if (groups) {
      const counts: Record<string, number> = {};
      groups.forEach(g => { counts[g.group_type] = (counts[g.group_type] || 0) + 1; });
      setGroupTypeData(Object.entries(counts).map(([key, value]) => ({
        name: getGroupTypeLabel(key, false),
        value,
      })));
    }
  };

  const fetchStudentGrowth = async () => {
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const { name } = getMonthRange(i);
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString();

      const { count } = await supabase
        .from('user_roles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student')
        .lte('created_at', endOfMonth);

      months.push({ month: name, students: count || 0 });
    }
    setStudentGrowth(months);

    // Add student growth to comparison
    if (months.length >= 2) {
      const current = months[months.length - 1];
      const previous = months[months.length - 2];
      const newStudents = current.students - previous.students;
      setMonthlyComparison(prev => [
        ...prev.filter(p => p.metric !== 'newStudents'),
        { metric: 'newStudents', current: newStudents, previous: previous.students > 0 ? months.length >= 3 ? months[months.length - 2].students - months[months.length - 3].students : 0 : 0, change: 0 },
      ]);
    }
  };

  const fetchRetentionData = async () => {
    // Retention = students who had active subscription last month AND still have active subscription this month
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      const name = d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short' });

      // Active subscriptions that started before end of month and end after start of month (overlapping)
      const { count: activeCount } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .in('status', ['active', 'completed'])
        .lte('start_date', endOfMonth)
        .gte('end_date', startOfMonth);

      // New subscriptions created this month
      const { count: newCount } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth + 'T23:59:59');

      const total = activeCount || 0;
      const newSubs = newCount || 0;
      const retained = Math.max(0, total - newSubs);
      const rate = total > 0 ? Math.round((retained / total) * 100) : 0;

      months.push({ month: name, rate, total, retained, new: newSubs });
    }
    setRetentionData(months);
  };

  const fetchLevelCompletionData = async () => {
    // Get level grades grouped by level with pass/fail counts
    const { data: grades } = await supabase
      .from('level_grades')
      .select('level_id, outcome, levels!level_grades_level_id_fkey(name, name_ar)');

    if (!grades || grades.length === 0) return;

    const levelMap: Record<string, { name: string; passed: number; failed: number; total: number }> = {};
    grades.forEach((g: any) => {
      const levelId = g.level_id;
      if (!levelMap[levelId]) {
        const levelData = g.levels;
        levelMap[levelId] = {
          name: isRTL ? (levelData?.name_ar || levelData?.name || 'Unknown') : (levelData?.name || 'Unknown'),
          passed: 0,
          failed: 0,
          total: 0,
        };
      }
      levelMap[levelId].total++;
      if (g.outcome === 'passed') {
        levelMap[levelId].passed++;
      } else {
        levelMap[levelId].failed++;
      }
    });

    const data = Object.values(levelMap).map(l => ({
      level: l.name,
      passed: l.passed,
      failed: l.failed,
      rate: l.total > 0 ? Math.round((l.passed / l.total) * 100) : 0,
    }));

    setLevelCompletionData(data);
  };

  const getComparisonLabel = (metric: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      revenue: { ar: 'الإيرادات', en: 'Revenue' },
      expenses: { ar: 'المصروفات', en: 'Expenses' },
      profit: { ar: 'صافي الربح', en: 'Net Profit' },
      attendance: { ar: 'معدل الحضور', en: 'Attendance Rate' },
      newStudents: { ar: 'طلاب جدد', en: 'New Students' },
    };
    return isRTL ? labels[metric]?.ar || metric : labels[metric]?.en || metric;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">{isRTL ? 'إحصائيات متقدمة' : 'Advanced Analytics'}</h2>

      {/* Monthly Comparison Cards */}
      {monthlyComparison.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {isRTL ? 'مقارنة شهرية (الشهر الحالي vs السابق)' : 'Monthly Comparison (Current vs Previous)'}
          </h3>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {monthlyComparison.filter(m => m.metric !== 'newStudents').map((item) => (
              <Card key={item.metric} className="relative overflow-hidden">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">{getComparisonLabel(item.metric)}</p>
                  <p className="text-lg font-bold tabular-nums">
                    {item.unit === '%' ? `${item.current}%` : item.current.toLocaleString()}
                  </p>
                  <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${
                    item.metric === 'expenses'
                      ? (item.change <= 0 ? 'text-emerald-600' : 'text-destructive')
                      : (item.change >= 0 ? 'text-emerald-600' : 'text-destructive')
                  }`}>
                    {item.change > 0 ? <TrendingUp className="h-3 w-3" /> :
                     item.change < 0 ? <TrendingDown className="h-3 w-3" /> :
                     <Minus className="h-3 w-3" />}
                    <span>{item.change > 0 ? '+' : ''}{item.change}{item.unit === '%' ? 'pp' : '%'}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {isRTL ? 'الشهر السابق' : 'Previous'}: {item.unit === '%' ? `${item.previous}%` : item.previous.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isRTL ? 'الإيرادات والمصروفات' : 'Revenue & Expenses'}</CardTitle>
            <CardDescription>{isRTL ? 'آخر 6 أشهر' : 'Last 6 months'}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" name={isRTL ? 'الإيرادات' : 'Revenue'} fill="hsl(197, 70%, 64%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name={isRTL ? 'المصروفات' : 'Expenses'} fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue Growth Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isRTL ? 'معدل نمو الإيرادات' : 'Revenue Growth Rate'}</CardTitle>
            <CardDescription>{isRTL ? 'النسبة المئوية شهر-على-شهر' : 'Month-over-Month %'}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={revenueGrowthData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" unit="%" />
                <Tooltip formatter={(value: number) => [`${value}%`, isRTL ? 'النمو' : 'Growth']} />
                <Bar dataKey="growth" name={isRTL ? 'النمو' : 'Growth'} radius={[4, 4, 0, 0]}>
                  {revenueGrowthData.map((entry, i) => (
                    <Cell key={i} fill={entry.growth >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="growth" stroke="hsl(249, 86%, 64%)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Student Retention */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isRTL ? 'معدل الاحتفاظ بالطلاب' : 'Student Retention Rate'}</CardTitle>
            <CardDescription>{isRTL ? 'نسبة الطلاب المستمرين شهرياً' : 'Percentage of returning students monthly'}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={retentionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" unit="%" />
                <Tooltip formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    rate: isRTL ? 'معدل الاحتفاظ' : 'Retention %',
                  };
                  return [`${value}%`, labels[name] || name];
                }} />
                <Area type="monotone" dataKey="rate" name={isRTL ? 'معدل الاحتفاظ' : 'Retention %'} stroke="hsl(249, 86%, 64%)" fill="hsl(249, 86%, 64%)" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Level Completion Rate */}
        {levelCompletionData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{isRTL ? 'معدل إكمال المستويات' : 'Level Completion Rate'}</CardTitle>
              <CardDescription>{isRTL ? 'نسبة النجاح لكل مستوى' : 'Pass rate per level'}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={levelCompletionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis type="category" dataKey="level" className="text-xs" width={80} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="passed" name={isRTL ? 'ناجح' : 'Passed'} fill="hsl(142, 76%, 36%)" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="failed" name={isRTL ? 'راسب' : 'Failed'} fill="hsl(0, 84%, 60%)" stackId="a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Attendance Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isRTL ? 'معدل الحضور' : 'Attendance Rate'}</CardTitle>
            <CardDescription>{isRTL ? 'النسبة المئوية شهرياً' : 'Monthly percentage'}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" />
                <Tooltip />
                <Area type="monotone" dataKey="rate" name={isRTL ? 'نسبة الحضور' : 'Attendance %'} stroke="hsl(142, 76%, 36%)" fill="hsl(142, 76%, 36%)" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Group Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isRTL ? 'توزيع أنواع المجموعات' : 'Group Type Distribution'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={groupTypeData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {groupTypeData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Student Growth */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isRTL ? 'نمو عدد الطلاب' : 'Student Growth'}</CardTitle>
            <CardDescription>{isRTL ? 'إجمالي الطلاب شهرياً' : 'Total students over time'}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={studentGrowth}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Area type="monotone" dataKey="students" name={isRTL ? 'الطلاب' : 'Students'} stroke="hsl(249, 86%, 64%)" fill="hsl(249, 86%, 64%)" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
