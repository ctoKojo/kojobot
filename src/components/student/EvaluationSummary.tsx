import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Star, TrendingUp, Tag, Loader2, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/timeUtils';
import { CurrentLevelStatus } from '@/components/student/CurrentLevelStatus';
import { useStudentLifecycle } from '@/hooks/useStudentLifecycle';

interface EvaluationSummaryProps {
  studentId: string;
}

interface EvalRecord {
  id: string;
  session_id: string;
  total_behavior_score: number;
  max_behavior_score: number;
  quiz_score: number | null;
  quiz_max_score: number | null;
  assignment_score: number | null;
  assignment_max_score: number | null;
  total_score: number | null;
  max_total_score: number | null;
  percentage: number | null;
  student_feedback_tags: string[] | null;
  notes: string | null;
  created_at: string;
  sessions?: {
    session_date: string;
    session_number: number | null;
    topic: string | null;
    topic_ar: string | null;
  };
}

function getPercentColor(pct: number) {
  if (pct >= 85) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 70) return 'text-lime-600 dark:text-lime-400';
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-destructive';
}

function getPercentBadge(pct: number) {
  if (pct >= 85) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (pct >= 70) return 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400';
  if (pct >= 50) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
}

export function EvaluationSummary({ studentId }: EvaluationSummaryProps) {
  const { isRTL, language } = useLanguage();
  const [evaluations, setEvaluations] = useState<EvalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvaluations();
  }, [studentId]);

  const fetchEvaluations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('session_evaluations')
        .select('*, sessions(session_date, session_number, topic, topic_ar)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setEvaluations((data || []) as unknown as EvalRecord[]);
    } catch (err) {
      console.error('Error fetching evaluations:', err);
    } finally {
      setLoading(false);
    }
  };

  // Computed stats
  const stats = useMemo(() => {
    if (evaluations.length === 0) return null;

    const withPercentage = evaluations.filter(e => e.percentage != null);
    const avgPercentage = withPercentage.length > 0
      ? Math.round(withPercentage.reduce((sum, e) => sum + (e.percentage || 0), 0) / withPercentage.length)
      : 0;

    const avgBehavior = evaluations.length > 0
      ? Math.round(evaluations.reduce((sum, e) => sum + e.total_behavior_score, 0) / evaluations.length)
      : 0;

    const maxBehavior = evaluations.length > 0 ? evaluations[0].max_behavior_score : 0;
    const behaviorPct = maxBehavior > 0 ? Math.round((avgBehavior / maxBehavior) * 100) : 0;

    // Tag frequency
    const tagCounts: Record<string, number> = {};
    evaluations.forEach(e => {
      (e.student_feedback_tags || []).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return { avgPercentage, avgBehavior, maxBehavior, behaviorPct, topTags, totalEvaluations: evaluations.length };
  }, [evaluations]);

  // Chart data (chronological)
  const chartData = useMemo(() => {
    return [...evaluations]
      .filter(e => e.percentage != null)
      .reverse()
      .map((e, i) => ({
        name: e.sessions?.session_number ? `S${e.sessions.session_number}` : `#${i + 1}`,
        percentage: e.percentage || 0,
        behavior: e.max_behavior_score > 0
          ? Math.round((e.total_behavior_score / e.max_behavior_score) * 100)
          : 0,
      }));
  }, [evaluations]);

  // Tag label mapping
  const TAG_LABELS: Record<string, { en: string; ar: string }> = {
    'Hardworking': { en: 'Hardworking', ar: 'مجتهد' },
    'Needs Focus': { en: 'Needs Focus', ar: 'يحتاج تركيز' },
    'Creative': { en: 'Creative', ar: 'مبدع' },
    'Great Teamwork': { en: 'Great Teamwork', ar: 'تعاون ممتاز' },
    'Improving': { en: 'Improving', ar: 'يتحسن' },
    'Excellent': { en: 'Excellent', ar: 'ممتاز' },
    'Keep It Up': { en: 'Keep It Up', ar: 'استمر' },
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (evaluations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            {isRTL ? 'ملخص التقييم' : 'Evaluation Summary'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-6">
            {isRTL ? 'لا توجد تقييمات بعد' : 'No evaluations yet'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Level Status */}
      <CurrentLevelStatus studentId={studentId} />

      {/* Overview Card */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            {isRTL ? 'ملخص التقييم السلوكي' : 'Behavioral Evaluation Summary'}
          </CardTitle>
          <CardDescription>
            {isRTL ? `${stats?.totalEvaluations} تقييم مسجل` : `${stats?.totalEvaluations} evaluations recorded`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-3">
            {/* Average Score */}
            <div className="text-center p-4 rounded-xl bg-muted/50">
              <p className={cn('text-4xl font-bold', getPercentColor(stats?.avgPercentage || 0))}>
                {stats?.avgPercentage}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {isRTL ? 'متوسط الدرجة الشاملة' : 'Avg. Overall Score'}
              </p>
            </div>

            {/* Behavior Score */}
            <div className="text-center p-4 rounded-xl bg-muted/50">
              <p className={cn('text-4xl font-bold', getPercentColor(stats?.behaviorPct || 0))}>
                {stats?.behaviorPct}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {isRTL ? 'متوسط السلوك' : 'Avg. Behavior Score'}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats?.avgBehavior}/{stats?.maxBehavior}
              </p>
            </div>

            {/* Total Evaluations */}
            <div className="text-center p-4 rounded-xl bg-muted/50">
              <p className="text-4xl font-bold text-primary">
                {stats?.totalEvaluations}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {isRTL ? 'عدد التقييمات' : 'Total Evaluations'}
              </p>
            </div>
          </div>

          {/* Top Feedback Tags */}
          {stats?.topTags && stats.topTags.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {isRTL ? 'الوسوم الأكثر تكراراً' : 'Most Frequent Tags'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {stats.topTags.map(([tag, count]) => {
                  const label = TAG_LABELS[tag];
                  return (
                    <Badge key={tag} variant="secondary" className="gap-1 text-sm px-3 py-1">
                      {label ? (isRTL ? label.ar : label.en) : tag}
                      <span className="text-xs text-muted-foreground ms-1">×{count}</span>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trend Chart + Recent Evaluations */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Performance Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {isRTL ? 'تطور الأداء' : 'Performance Trend'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="evalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="behaviorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="percentage"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#evalGradient)"
                    name={isRTL ? 'الشاملة' : 'Overall'}
                  />
                  <Area
                    type="monotone"
                    dataKey="behavior"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#behaviorGradient)"
                    name={isRTL ? 'السلوك' : 'Behavior'}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                {isRTL ? 'تحتاج تقييمين على الأقل لعرض الرسم البياني' : 'Need at least 2 evaluations for chart'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Evaluations Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {isRTL ? 'آخر التقييمات' : 'Recent Evaluations'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{isRTL ? 'السيشن' : 'Session'}</TableHead>
                  <TableHead className="text-center">{isRTL ? 'السلوك' : 'Behavior'}</TableHead>
                  <TableHead className="text-center">{isRTL ? 'الشاملة' : 'Overall'}</TableHead>
                  <TableHead className="text-center">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.slice(0, 10).map(ev => {
                  const pct = ev.percentage || 0;
                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="text-sm">
                        <div>
                          {ev.sessions?.session_number
                            ? `${isRTL ? 'سيشن' : 'Session'} ${ev.sessions.session_number}`
                            : formatDate(ev.created_at)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(ev.sessions?.session_date || ev.created_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium">
                        {ev.total_behavior_score}/{ev.max_behavior_score}
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium">
                        {ev.total_score != null ? `${ev.total_score}/${ev.max_total_score}` : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn('text-xs', getPercentBadge(pct))}>
                          {pct}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
