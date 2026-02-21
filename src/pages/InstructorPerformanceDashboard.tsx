import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/timeUtils';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Award, AlertTriangle, Activity, Clock, Users, Shield, CheckCircle } from 'lucide-react';

interface MetricRow {
  id: string;
  instructor_id: string;
  month: string;
  avg_reply_time_hours: number;
  avg_grading_time_hours: number;
  total_warnings: number;
  total_reminders: number;
  total_students: number;
  total_groups: number;
  quality_score: number;
}

interface InstructorMetric extends MetricRow {
  profile?: { full_name: string; full_name_ar: string | null; avatar_url: string | null; email: string };
  prevScore?: number;
  riskIndex: number;
  warningsBySeverity: { minor: number; major: number; critical: number };
}

interface PerformanceEvent {
  id: string;
  instructor_id: string;
  event_type: string;
  details: any;
  created_at: string;
  profile?: { full_name: string };
}

interface HealthMetric {
  date: string;
  total_reminders: number;
  total_warnings: number;
  total_deductions: number;
  avg_execution_time_ms: number;
  errors_count: number;
}

export default function InstructorPerformanceDashboard() {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<InstructorMetric[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [events, setEvents] = useState<PerformanceEvent[]>([]);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [bonusRecommendations, setBonusRecommendations] = useState<PerformanceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      await Promise.all([fetchMetrics(), fetchEvents(), fetchHealth(), fetchBonusRecs()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    const { data: currentMetrics } = await supabase
      .from('instructor_performance_metrics')
      .select('*')
      .eq('month', currentMonth)
      .order('quality_score', { ascending: false });

    if (!currentMetrics || currentMetrics.length === 0) { setMetrics([]); return; }

    const ids = currentMetrics.map(m => m.instructor_id);
    const [{ data: profiles }, { data: prevMetrics }, { data: warnings }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, full_name_ar, avatar_url, email').in('user_id', ids),
      supabase.from('instructor_performance_metrics').select('instructor_id, quality_score')
        .in('instructor_id', ids)
        .lt('month', currentMonth)
        .order('month', { ascending: false }),
      supabase.from('instructor_warnings').select('instructor_id, severity')
        .in('instructor_id', ids).eq('is_active', true)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    const prevMap = new Map<string, number>();
    prevMetrics?.forEach(pm => { if (!prevMap.has(pm.instructor_id)) prevMap.set(pm.instructor_id, pm.quality_score); });

    const warningMap = new Map<string, { minor: number; major: number; critical: number }>();
    warnings?.forEach(w => {
      const existing = warningMap.get(w.instructor_id) || { minor: 0, major: 0, critical: 0 };
      const sev = (w.severity || 'minor') as 'minor' | 'major' | 'critical';
      existing[sev]++;
      warningMap.set(w.instructor_id, existing);
    });

    const enriched: InstructorMetric[] = currentMetrics.map(m => {
      const ws = warningMap.get(m.instructor_id) || { minor: 0, major: 0, critical: 0 };
      return {
        ...m,
        profile: profileMap.get(m.instructor_id),
        prevScore: prevMap.get(m.instructor_id),
        riskIndex: ws.critical * 3 + ws.major * 2 + ws.minor * 1,
        warningsBySeverity: ws,
      };
    });

    setMetrics(enriched);

    // Trend data - last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const { data: allMetrics } = await supabase
      .from('instructor_performance_metrics')
      .select('month, quality_score')
      .gte('month', sixMonthsAgo.toISOString().slice(0, 10))
      .order('month');

    if (allMetrics) {
      const monthMap = new Map<string, number[]>();
      allMetrics.forEach(m => {
        const key = m.month.slice(0, 7);
        if (!monthMap.has(key)) monthMap.set(key, []);
        monthMap.get(key)!.push(m.quality_score);
      });
      const trend = Array.from(monthMap.entries()).map(([month, scores]) => ({
        month,
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }));
      setTrendData(trend);
    }
  };

  const fetchEvents = async () => {
    const { data } = await supabase
      .from('performance_events')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data && data.length > 0) {
      const ids = [...new Set(data.map(e => e.instructor_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
      const pMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      setEvents(data.map(e => ({ ...e, profile: pMap.get(e.instructor_id) })));
    }
  };

  const fetchHealth = async () => {
    const { data } = await supabase
      .from('system_health_metrics')
      .select('*')
      .order('date', { ascending: false })
      .limit(7);
    setHealthMetrics(data || []);
  };

  const fetchBonusRecs = async () => {
    const { data } = await supabase
      .from('performance_events')
      .select('*')
      .eq('event_type', 'bonus_recommended')
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      const ids = [...new Set(data.map(e => e.instructor_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
      const pMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      setBonusRecommendations(data.map(e => ({ ...e, profile: pMap.get(e.instructor_id) })));
    }
  };

  const handleApproveBonus = async (event: PerformanceEvent) => {
    try {
      const details = event.details as any;
      const amount = details?.bonus_amount || 200;
      const month = new Date().toISOString().slice(0, 7) + '-01';

      await supabase.from('salary_events').insert({
        employee_id: event.instructor_id,
        event_type: 'bonus',
        amount,
        month,
        source: 'performance_bonus',
        description: 'Performance bonus - approved by admin',
        description_ar: 'مكافأة أداء - معتمدة من المدير',
        created_by: user!.id,
      } as any);

      await supabase.from('performance_events').insert({
        instructor_id: event.instructor_id,
        event_type: 'bonus_approved',
        reference_id: event.id,
        reference_type: 'performance_event',
        details: { ...details, approved_by: user!.id, approved_amount: amount },
      });

      await supabase.from('performance_events').update({ is_archived: true }).eq('id', event.id);

      toast.success(isRTL ? 'تم اعتماد المكافأة' : 'Bonus approved');
      fetchBonusRecs();
    } catch (error) {
      toast.error(isRTL ? 'حدث خطأ' : 'Error approving bonus');
    }
  };

  const bestInstructor = metrics[0];
  const worstInstructor = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const avgScore = metrics.length > 0 ? Math.round(metrics.reduce((a, m) => a + m.quality_score, 0) / metrics.length) : 0;

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRiskBg = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  };

  const getEventLabel = (type: string) => {
    const labels: Record<string, string> = {
      reminder_sent: isRTL ? 'تذكير' : 'Reminder',
      warning_created: isRTL ? 'إنذار' : 'Warning',
      deduction_pending: isRTL ? 'خصم معلق' : 'Pending Deduction',
      deduction_applied: isRTL ? 'خصم مطبق' : 'Deduction Applied',
      bonus_recommended: isRTL ? 'مكافأة مقترحة' : 'Bonus Recommended',
      bonus_approved: isRTL ? 'مكافأة معتمدة' : 'Bonus Approved',
      suspension_recommended: isRTL ? 'توصية إيقاف' : 'Suspension Rec.',
      escalation_event: isRTL ? 'تصعيد' : 'Escalation',
    };
    return labels[type] || type;
  };

  return (
    <DashboardLayout title={isRTL ? 'أداء المدربين' : 'Instructor Performance'}>
      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Award className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'أفضل مدرب' : 'Best Instructor'}</p>
                  <p className="font-semibold truncate max-w-[140px]">
                    {bestInstructor?.profile?.full_name || '-'}
                  </p>
                  <p className="text-xs text-green-600">{bestInstructor?.quality_score || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'يحتاج متابعة' : 'Needs Attention'}</p>
                  <p className="font-semibold truncate max-w-[140px]">
                    {worstInstructor?.profile?.full_name || '-'}
                  </p>
                  <p className="text-xs text-red-600">{worstInstructor?.quality_score || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Activity className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'متوسط الأداء' : 'Avg Score'}</p>
                  <p className="text-2xl font-bold">{avgScore}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Award className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'توصيات معلقة' : 'Pending Recs'}</p>
                  <p className="text-2xl font-bold">{bonusRecommendations.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trend Chart */}
        {trendData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'تطور متوسط الأداء' : 'Performance Trend'}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Area type="monotone" dataKey="avgScore" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Instructor Rankings Table */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'ترتيب المدربين' : 'Instructor Rankings'}</CardTitle>
            <CardDescription>{isRTL ? 'الشهر الحالي' : 'Current Month'}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
            ) : metrics.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{isRTL ? 'لا توجد بيانات بعد' : 'No data yet'}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'المدرب' : 'Instructor'}</TableHead>
                      <TableHead>{isRTL ? 'الأداء' : 'Score'}</TableHead>
                      <TableHead>{isRTL ? 'الاتجاه' : 'Trend'}</TableHead>
                      <TableHead>{isRTL ? 'الحمل' : 'Workload'}</TableHead>
                      <TableHead>{isRTL ? 'متوسط الرد' : 'Avg Reply'}</TableHead>
                      <TableHead>{isRTL ? 'متوسط التقييم' : 'Avg Grade'}</TableHead>
                      <TableHead>{isRTL ? 'إنذارات' : 'Warnings'}</TableHead>
                      <TableHead>{isRTL ? 'مؤشر الخطر' : 'Risk'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.map(m => {
                      const trajectory = m.prevScore !== undefined
                        ? m.quality_score > m.prevScore ? 'up' : m.quality_score < m.prevScore ? 'down' : 'stable'
                        : 'stable';
                      return (
                        <TableRow key={m.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={m.profile?.avatar_url || undefined} />
                                <AvatarFallback>{m.profile?.full_name?.charAt(0) || '?'}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium truncate max-w-[120px]">
                                {language === 'ar' ? m.profile?.full_name_ar || m.profile?.full_name : m.profile?.full_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getRiskBg(m.quality_score)}>
                              <span className={getRiskColor(m.quality_score)}>{m.quality_score}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {trajectory === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
                            {trajectory === 'down' && <TrendingDown className="h-4 w-4 text-red-600" />}
                            {trajectory === 'stable' && <Minus className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Users className="h-3 w-3" />
                              {m.total_students}/{m.total_groups}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-3 w-3" />
                              {m.avg_reply_time_hours.toFixed(0)}h
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-3 w-3" />
                              {m.avg_grading_time_hours.toFixed(0)}h
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{m.total_warnings}</TableCell>
                          <TableCell>
                            <Badge variant={m.riskIndex > 5 ? 'destructive' : m.riskIndex > 2 ? 'secondary' : 'outline'}>
                              {m.riskIndex}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bonus Recommendations */}
        {bonusRecommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                {isRTL ? 'توصيات المكافآت' : 'Bonus Recommendations'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bonusRecommendations.map(rec => (
                  <div key={rec.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{rec.profile?.full_name || rec.instructor_id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? 'أداء متميز - 0 إنذارات' : 'Outstanding - 0 warnings'}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => handleApproveBonus(rec)}>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      {isRTL ? 'موافقة' : 'Approve'}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Health + Events side by side */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {isRTL ? 'صحة النظام (7 أيام)' : 'System Health (7 days)'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {healthMetrics.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">{isRTL ? 'لا توجد بيانات' : 'No data'}</p>
              ) : (
                <div className="space-y-3">
                  {healthMetrics.slice(0, 5).map(h => (
                    <div key={h.date} className="flex items-center justify-between text-sm p-2 rounded border">
                      <span className="text-muted-foreground">{h.date}</span>
                      <div className="flex gap-3">
                        <span>{h.total_warnings} {isRTL ? 'إنذار' : 'warn'}</span>
                        <span>{h.total_reminders} {isRTL ? 'تذكير' : 'rem'}</span>
                        <span>{h.avg_execution_time_ms}ms</span>
                        {h.errors_count > 0 && <Badge variant="destructive">{h.errors_count} err</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Events */}
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'آخر الأحداث' : 'Recent Events'}</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">{isRTL ? 'لا توجد أحداث' : 'No events'}</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {events.slice(0, 20).map(e => (
                    <div key={e.id} className="flex items-center justify-between text-sm p-2 rounded border">
                      <div>
                        <Badge variant="outline" className="text-xs">{getEventLabel(e.event_type)}</Badge>
                        <span className="ml-2 text-muted-foreground">{e.profile?.full_name || ''}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(e.created_at, language)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
