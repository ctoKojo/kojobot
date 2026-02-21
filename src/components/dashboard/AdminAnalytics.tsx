import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { getGroupTypeLabel } from '@/lib/constants';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { Loader2 } from 'lucide-react';

const COLORS = ['hsl(197, 70%, 64%)', 'hsl(249, 86%, 64%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)'];

export function AdminAnalytics() {
  const { isRTL } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [groupTypeData, setGroupTypeData] = useState<any[]>([]);
  const [studentGrowth, setStudentGrowth] = useState<any[]>([]);

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
      ]);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRevenueData = async () => {
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString();

      const [{ data: payments }, { data: expenses }] = await Promise.all([
        supabase.from('payments').select('amount').gte('payment_date', startOfMonth.split('T')[0]).lte('payment_date', endOfMonth.split('T')[0]),
        supabase.from('expenses').select('amount').gte('expense_date', startOfMonth.split('T')[0]).lte('expense_date', endOfMonth.split('T')[0]),
      ]);

      const revenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const expense = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const monthName = d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short' });
      months.push({ month: monthName, revenue, expenses: expense, profit: revenue - expense });
    }
    setRevenueData(months);
  };

  const fetchAttendanceData = async () => {
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data } = await supabase
        .from('attendance')
        .select('status, session_id')
        .gte('recorded_at', startOfMonth)
        .lte('recorded_at', endOfMonth);

      const total = data?.length || 0;
      const present = data?.filter(a => a.status === 'present').length || 0;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      const monthName = d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short' });
      months.push({ month: monthName, rate });
    }
    setAttendanceData(months);
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
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString();

      const { count } = await supabase
        .from('user_roles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student')
        .lte('created_at', endOfMonth);

      const monthName = d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short' });
      months.push({ month: monthName, students: count || 0 });
    }
    setStudentGrowth(months);
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
