import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsGrid } from '@/components/shared/StatsGrid';
import {
  BarChart3, Users, Clock, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight, Timer, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { getStudentProgressStatusLabel } from '@/lib/constants';

interface ProgressMetrics {
  statusCounts: Record<string, number>;
  avgDaysPerStage: Record<string, number>;
  conversionRates: { from: string; to: string; rate: number }[];
  totalStudents: number;
  dropOffPoints: { stage: string; count: number }[];
}

const STAGE_COLORS: Record<string, string> = {
  in_progress: '#3b82f6',
  awaiting_exam: '#f59e0b',
  exam_scheduled: '#8b5cf6',
  graded: '#10b981',
  pending_group_assignment: '#06b6d4',
  paused: '#6b7280',
};

export default function ProgressionMetrics() {
  const { isRTL, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ProgressMetrics>({
    statusCounts: {},
    avgDaysPerStage: {},
    conversionRates: [],
    totalStudents: 0,
    dropOffPoints: [],
  });

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // 1. Status distribution
      const { data: progressData } = await supabase
        .from('group_student_progress')
        .select('status, status_changed_at, outcome, student_id');

      const statusCounts: Record<string, number> = {};
      const stageDurations: Record<string, number[]> = {};

      (progressData || []).forEach(p => {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
        if (p.status_changed_at) {
          const days = Math.floor((Date.now() - new Date(p.status_changed_at as string).getTime()) / (1000 * 60 * 60 * 24));
          if (!stageDurations[p.status]) stageDurations[p.status] = [];
          stageDurations[p.status].push(days);
        }
      });

      // Average days per stage
      const avgDaysPerStage: Record<string, number> = {};
      Object.entries(stageDurations).forEach(([status, durations]) => {
        avgDaysPerStage[status] = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      });

      // 2. Conversion rates from transitions
      const { data: transitions } = await supabase
        .from('student_level_transitions')
        .select('from_level_id, to_level_id, reason')
        .order('created_at', { ascending: false })
        .limit(500);

      const totalTransitions = transitions?.length || 0;
      const passedCount = transitions?.filter(t => t.reason === 'passed').length || 0;
      const repeatCount = transitions?.filter(t => t.reason === 'repeat').length || 0;

      const conversionRates = [
        { from: isRTL ? 'في التقدم' : 'In Progress', to: isRTL ? 'انتظار الامتحان' : 'Awaiting Exam', rate: totalTransitions > 0 ? 100 : 0 },
        { from: isRTL ? 'انتظار الامتحان' : 'Awaiting Exam', to: isRTL ? 'تم التقييم' : 'Graded', rate: totalTransitions > 0 ? Math.round(((passedCount + repeatCount) / Math.max(totalTransitions, 1)) * 100) : 0 },
        { from: isRTL ? 'تم التقييم' : 'Graded', to: isRTL ? 'ناجح' : 'Passed', rate: (passedCount + repeatCount) > 0 ? Math.round((passedCount / (passedCount + repeatCount)) * 100) : 0 },
      ];

      // 3. Drop-off points (students stuck > 14 days)
      const dropOffPoints = Object.entries(stageDurations)
        .map(([stage, durations]) => ({
          stage,
          count: durations.filter(d => d > 14).length,
        }))
        .filter(d => d.count > 0)
        .sort((a, b) => b.count - a.count);

      const uniqueStudents = new Set((progressData || []).map(p => p.student_id));

      setMetrics({
        statusCounts,
        avgDaysPerStage,
        conversionRates,
        totalStudents: uniqueStudents.size,
        dropOffPoints,
      });
    } catch (err) {
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusChartData = useMemo(() =>
    Object.entries(metrics.statusCounts).map(([status, count]) => ({
      name: getStudentProgressStatusLabel(status, isRTL),
      value: count,
      fill: STAGE_COLORS[status] || '#94a3b8',
    })),
    [metrics.statusCounts, isRTL]
  );

  const avgTimeChartData = useMemo(() =>
    Object.entries(metrics.avgDaysPerStage)
      .filter(([status]) => status !== 'in_progress') // in_progress is expected to be long
      .map(([status, days]) => ({
        stage: getStudentProgressStatusLabel(status, isRTL),
        days,
        fill: STAGE_COLORS[status] || '#94a3b8',
      })),
    [metrics.avgDaysPerStage, isRTL]
  );

  const totalActive = Object.values(metrics.statusCounts).reduce((a, b) => a + b, 0);
  const awaitingCount = (metrics.statusCounts['awaiting_exam'] || 0) + (metrics.statusCounts['exam_scheduled'] || 0);
  const pendingAssignment = metrics.statusCounts['pending_group_assignment'] || 0;
  const stuckCount = metrics.dropOffPoints.reduce((a, b) => a + b.count, 0);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader
          title={isRTL ? 'تحليلات تقدم الطلاب' : 'Student Progression Analytics'}
          subtitle={isRTL ? 'نظرة شاملة على رحلة الطلاب عبر المستويات' : 'Comprehensive view of student journey across levels'}
          icon={BarChart3}
          gradient="from-indigo-500 to-purple-600"
        />

        {loading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats */}
            <StatsGrid
              columns={4}
              stats={[
                { label: isRTL ? 'إجمالي السجلات' : 'Total Records', value: totalActive, icon: Users, gradient: 'from-blue-500 to-blue-600' },
                { label: isRTL ? 'في انتظار امتحان' : 'Awaiting Exam', value: awaitingCount, icon: Clock, gradient: 'from-amber-500 to-orange-500' },
                { label: isRTL ? 'في انتظار جروب' : 'Pending Group', value: pendingAssignment, icon: TrendingUp, gradient: 'from-cyan-500 to-cyan-600' },
                { label: isRTL ? 'متأخرين (>14 يوم)' : 'Stuck (>14d)', value: stuckCount, icon: AlertTriangle, gradient: 'from-red-500 to-red-600' },
              ]}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Status Distribution Pie */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {isRTL ? 'توزيع الحالات' : 'Status Distribution'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Average Time Per Stage */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    {isRTL ? 'متوسط الأيام في كل مرحلة' : 'Average Days Per Stage'}
                  </CardTitle>
                  <CardDescription>
                    {isRTL ? 'باستثناء "جاري" لأنها المرحلة الطبيعية الطويلة' : 'Excluding "In Progress" as it is the naturally long stage'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={avgTimeChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="stage" type="category" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => [`${value} ${isRTL ? 'يوم' : 'days'}`, isRTL ? 'المتوسط' : 'Average']} />
                      <Bar dataKey="days" radius={[0, 4, 4, 0]}>
                        {avgTimeChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Conversion Funnel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {isRTL ? 'معدلات التحويل' : 'Conversion Rates'}
                </CardTitle>
                <CardDescription>
                  {isRTL ? 'نسبة الانتقال من كل مرحلة للتالية' : 'Rate of transition from each stage to the next'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {metrics.conversionRates.map((cr, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="text-center px-4 py-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">{cr.from}</p>
                      </div>
                      <div className="flex flex-col items-center">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge variant={cr.rate >= 80 ? 'default' : cr.rate >= 50 ? 'secondary' : 'destructive'} className="text-xs mt-0.5">
                          {cr.rate}%
                        </Badge>
                      </div>
                      <div className="text-center px-4 py-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">{cr.to}</p>
                      </div>
                      {i < metrics.conversionRates.length - 1 && <div className="w-4" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Drop-off Points */}
            {metrics.dropOffPoints.length > 0 && (
              <Card className="border-destructive/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {isRTL ? 'نقاط التعثر' : 'Drop-off Points'}
                  </CardTitle>
                  <CardDescription>
                    {isRTL ? 'طلاب متأخرين أكثر من 14 يوم في مرحلة واحدة' : 'Students stuck more than 14 days in a single stage'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {metrics.dropOffPoints.map(dp => (
                      <div key={dp.stage} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {getStudentProgressStatusLabel(dp.stage, isRTL)}
                          </Badge>
                        </div>
                        <span className="text-sm font-bold text-destructive">
                          {dp.count} {isRTL ? 'طالب' : 'students'}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
